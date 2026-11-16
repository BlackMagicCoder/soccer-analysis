"""Read-only HTTP API with versioned representation caches."""

import csv
import hashlib
import json
import sqlite3
from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.gzip import GZipMiddleware
from starlette.staticfiles import StaticFiles

from soccer_api.db import ROOT, connect, data_dir
from soccer_api.models import compute
from soccer_api.prepare import LEAGUES, prepared
from soccer_api.policy import ANALYSIS_END, LATEST_SEASON, EARLIEST_SEASON, stadium_frame
from soccer_api.operations import read_status

app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1000)
EMPTY = "Noch keine Daten geladen. Bitte zuerst den Startbestand einspielen: uv run python -m soccer_api.seed"


@app.middleware("http")
async def headers_and_data(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.url.path != "/api/status":
        try:
            with connect() as con:
                con.execute("BEGIN")
                meta = dict(con.execute("SELECT key,value FROM meta"))
                if not con.execute("SELECT COUNT(*) FROM matches").fetchone()[0]:
                    raise sqlite3.OperationalError()
                version = int(meta["data_version"])
                path = (data_dir() / "soccer.db").resolve().as_uri()
                # Load while the version's read transaction is held, avoiding mixed snapshots.
                df = prepared(path, version)
                if df.empty:
                    raise sqlite3.OperationalError()
                stadiums = stadium_frame(df)
            request.state.snapshot = (path, version, meta, df, stadiums)
        except (sqlite3.Error, KeyError, ValueError, OSError):
            return JSONResponse({"detail": EMPTY}, status_code=503, headers={"Cache-Control": "no-cache"})
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache"
    return response


def clean(value):
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def respond(request, payload, query=(), body=None):
    path, version, *_ = request.state.snapshot
    tag = (
        '"'
        + hashlib.sha256(
            json.dumps([path, version, request.url.path, query], sort_keys=True).encode()
        ).hexdigest()
        + '"'
    )
    headers = {"ETag": tag, "Cache-Control": "no-cache"}
    if tag in [v.strip() for v in request.headers.get("if-none-match", "").split(",")] or (
        request.headers.get("if-none-match") == "*"
    ):
        return Response(status_code=304, headers=headers)
    body = (
        body if body is not None else json.dumps(clean(payload), ensure_ascii=False, allow_nan=False).encode()
    )
    return Response(body, media_type="application/json", headers=headers)


@app.get("/api/meta")
def meta(request: Request):
    _, version, metadata, df, stadiums = request.state.snapshot
    return respond(
        request,
        dict(
            analysis_end=ANALYSIS_END,
            latest_season=LATEST_SEASON,
            data_version=version,
            updated_at=metadata["updated_at"],
            n_matches=len(df),
            n_teams=len(set(df.home_team) | set(df.away_team)),
            n_stadiums=len(stadiums[["lat", "lon"]].dropna().drop_duplicates()),
            date_min=df.date.min().strftime("%Y-%m-%d"),
            date_max=df.date.max().strftime("%Y-%m-%d"),
            seasons=sorted(df.season_id.astype(int).unique()),
            ghost_period=["2020-03-15", "2021-06-30"],
            leagues=[dict(id=k, key=v, name="Premier League" if k == 1 else v) for k, v in LEAGUES.items()],
        ),
    )


@app.get("/api/status")
def status():
    payload = dict(analysis_end=ANALYSIS_END, latest_season=LATEST_SEASON,
                   available=False, n_matches=0, missing_weather=0, missing_coordinates=0,
                   refresh=read_status())
    try:
        with connect() as con:
            metadata = dict(con.execute("SELECT key,value FROM meta"))
            version = int(metadata.get("data_version", 0))
            path = (data_dir() / "soccer.db").resolve().as_uri()
            frame = prepared(path, version)
            payload.update(available=not frame.empty, n_matches=len(frame), data_version=version,
                           missing_weather=int(frame[["w_temp", "w_wind", "w_precip_2h", "w_temp_diff_away"]].isna().any(axis=1).sum()),
                           missing_coordinates=int(frame[["home_lat", "home_lon", "away_lat", "away_lon"]].isna().any(axis=1).sum()),
                           updated_at=metadata.get("updated_at"))
    except (sqlite3.Error, OSError, KeyError, ValueError):
        pass
    files = list((data_dir() / "source-cache").glob("*.txt"))
    payload["cache"] = dict(files=len(files), bytes=sum(f.stat().st_size for f in files if f.exists()),
                            league_ttl_hours=20, weather_model="Open-Meteo Standardmodell (best_match)", weather_delay_days=5)
    return JSONResponse(clean(payload), headers={"Cache-Control": "no-cache"})


def understat_columns(df):
    """Shared source columns, preserving the matches representation's order."""
    teams = sorted(set(df.home_team) | set(df.away_team))
    indices = {t: i for i, t in enumerate(teams)}
    cols = dict(
        game_id=df.game_id.tolist(),
        date=df.date.dt.strftime("%Y-%m-%dT%H:%M").tolist(),
        league=pd.to_numeric(df.league_id).astype(int).tolist(),
        season=df.season_id.astype(int).tolist(),
    )
    for side in ("home", "away"):
        cols[f"{side}_team"] = df[f"{side}_team"].map(indices).tolist()
        for short, original in [
            ("goals", "goals"),
            ("points", "points"),
            ("xg", "xg"),
            ("xpts", "expected_points"),
            ("ppda", "ppda"),
            ("deep", "deep_completions"),
        ]:
            vals = df[f"{side}_{original}"]
            cols[f"{side}_{short}"] = (
                [None if pd.isna(v) else int(v) for v in vals]
                if short in ("goals", "points", "deep")
                else vals.round(4).tolist()
            )
    return teams, cols


@lru_cache(maxsize=4)
def match_body(path, version):
    df = prepared(path, version).sort_values(["date", "game_id"])
    teams, cols = understat_columns(df)
    for col in [
        "travel_km",
        "is_derby",
        "ghost",
        "strdiff",
        "w_temp",
        "w_wind",
        "w_precip_2h",
        "w_temp_diff_away",
    ]:
        cols[col] = df[col].round(4 if col == "strdiff" else 2).tolist()
    for col in ("is_derby", "ghost"):
        cols[col] = [None if pd.isna(v) else int(v) for v in cols[col]]
    return json.dumps(
        clean(dict(data_version=version, n=len(df), teams=teams, columns=cols)),
        ensure_ascii=False,
        allow_nan=False,
    ).encode()


@app.get("/api/matches")
def matches(request: Request):
    path, version, *_ = request.state.snapshot
    return respond(request, None, body=match_body(path, version))


SOURCES = {
    "understat": dict(name="Understat", url="https://understat.com/",
                      content="Spielstatistiken der Top-5-Ligen",
                      retrieval="Alle Werte aus der Datei Match_statistics_enriched.parquet (zwölf Saisondateien); eigener Abruf bei Understat liefert derzeit nur eine Fehlerseite",
                      license="keine dokumentierte API oder Lizenz"),
    "wikidata": dict(name="Wikidata", url="https://www.wikidata.org/wiki/Property:P625",
                     content="Heimstadion, Ort und Koordinaten je Team",
                     retrieval="Alle Werte aus der Datei Match_statistics_enriched.parquet; Herkunft per SPARQL-Abgleich vom 13.11.2026 belegt (docs/stadien-wikidata.csv)",
                     license="CC0"),
    "open-meteo": dict(name="Open-Meteo", url="https://open-meteo.com/en/docs/historical-weather-api",
                       content="Stündliches Wetter am Heimspielort",
                       retrieval="Alle Werte aus der Datei Match_statistics_enriched.parquet; Methode per Stichprobe vom 13.11.2026 belegt, kein Wert ersetzt",
                       license="CC BY 4.0"),
}


@lru_cache(maxsize=1)
def wikidata_ids():
    try:
        with (ROOT / "docs" / "stadien-wikidata.csv").open(encoding="utf-8", newline="") as stream:
            return {row["team"]: row.get("wikidata") or None for row in csv.DictReader(stream)}
    except FileNotFoundError:
        return {}


def weather_example():
    for file in sorted((data_dir() / "source-cache").glob("*.txt")):
        try:
            raw = json.loads(file.read_text(encoding="utf-8"))
            if not isinstance(raw, dict) or not isinstance(raw.get("hourly"), dict):
                continue
            return dict(latitude=raw.get("latitude"), longitude=raw.get("longitude"),
                        timezone=raw.get("timezone"), hourly_units=raw.get("hourly_units"),
                        hourly={key: value[:6] if isinstance(value, list) else value
                                for key, value in raw["hourly"].items()}, truncated=True)
        except (OSError, ValueError, UnicodeError):
            continue
    return None


@lru_cache(maxsize=12)
def source_body(path, version, source):
    df = prepared(path, version)
    payload = dict(data_version=version)
    if source == "understat":
        teams, columns = understat_columns(df.sort_values(["date", "game_id"]))
        payload.update(n=len(df), source=SOURCES[source], teams=teams, columns=columns)
    elif source == "wikidata":
        frame = stadium_frame(df).drop(columns="league_id")
        frame["wikidata"] = frame.team.map(wikidata_ids())
        payload.update(n_teams=len(frame),
                       n_venues=len(frame[["venue", "lat", "lon"]].drop_duplicates()),
                       source=SOURCES[source], stadiums=frame.to_dict("records"))
    else:
        frame = df.dropna(subset=["home_lat", "home_lon"]).copy()
        frame["time"] = frame.date.dt.floor("h").dt.strftime("%Y-%m-%dT%H:00")
        frame["lat"] = frame.home_lat.round(5)
        frame["lon"] = frame.home_lon.round(5)
        frame = frame.sort_values(["time", "lat", "lon"])
        columns = {key: frame[key].tolist() for key in ("time", "lat", "lon")}
        columns.update({key: frame[key].round(1).tolist()
                        for key in ("w_temp", "w_wind", "w_precip_2h")})
        payload.update(n=len(frame), source=SOURCES[source], columns=columns,
                       query=dict(endpoint="https://archive-api.open-meteo.com/v1/archive",
                                  model="Standardmodell (best_match, kein models-Parameter)",
                                  variables={"w_temp": "temperature_2m, °C, Stunde des Anstoßes",
                                             "w_wind": "wind_speed_10m, km/h, Stunde des Anstoßes",
                                             "w_precip_2h": "precipitation, mm, Summe aus Anstoßstunde und Folgestunde"},
                                  timezone="UTC", delay_days=5),
                       example=weather_example())
    return json.dumps(clean(payload), ensure_ascii=False, allow_nan=False).encode()


@app.get("/api/source/understat")
def source_understat(request: Request):
    path, version, *_ = request.state.snapshot
    return respond(request, None, body=source_body(path, version, "understat"))


@app.get("/api/source/wikidata")
def source_wikidata(request: Request):
    path, version, *_ = request.state.snapshot
    return respond(request, None, body=source_body(path, version, "wikidata"))


@app.get("/api/source/open-meteo")
def source_open_meteo(request: Request):
    path, version, *_ = request.state.snapshot
    return respond(request, None, body=source_body(path, version, "open-meteo"))


@app.get("/api/stadiums")
def stadiums(request: Request):
    _, version, _, _, frame = request.state.snapshot
    frame = frame.rename(columns={"league_id": "league"})
    frame["league"] = pd.to_numeric(frame.league).astype(int)
    return respond(request, dict(data_version=version, stadiums=frame.to_dict("records")))


@lru_cache(maxsize=64)
def model_response(path, version, leagues, start, end, ghost):
    df = prepared(path, version)
    d = df[pd.to_numeric(df.league_id).isin(leagues) & df.season_id.between(start, end)]
    if ghost != "include":
        d = d[d.ghost == (1 if ghost == "only" else 0)]
    models, errors = compute(d)
    return dict(
        data_version=version,
        filter=dict(leagues=list(leagues), season_from=start, season_to=end, ghost=ghost),
        n=len(d),
        models=models,
        errors=errors,
    )


@app.get("/api/models")
def models(
    request: Request,
    leagues: str | None = None,
    season_from: str | None = None,
    season_to: str | None = None,
    ghost: str = "include",
):
    path, version, _, df, _ = request.state.snapshot
    try:
        ids = tuple(sorted({int(x) for x in leagues.split(",")})) if leagues is not None else tuple(LEAGUES)
        start = int(season_from) if season_from is not None else int(df.season_id.min())
        end = int(season_to) if season_to is not None else int(df.season_id.max())
        if (
            not ids
            or not set(ids) <= set(LEAGUES)
            or start > end
            or start < EARLIEST_SEASON
            or end > LATEST_SEASON
            or ghost not in ("include", "exclude", "only")
        ):
            raise ValueError()
    except ValueError:
        return JSONResponse(
            {
                "detail": "Ungültiger Filter: Ligen 1–5, Saisonstartjahre 2014–2025 in aufsteigender "
                "Reihenfolge und ghost=include, exclude oder only verwenden."
            },
            status_code=422,
        )
    return respond(request, model_response(path, version, ids, start, end, ghost), (ids, start, end, ghost))


if (ROOT / "web/dist").is_dir():
    app.mount("/", StaticFiles(directory=ROOT / "web/dist", html=True), name="frontend")
else:

    @app.get("/")
    def root():
        return {"detail": "Die API ist bereit. Die Dokumentation finden Sie unter /docs."}
