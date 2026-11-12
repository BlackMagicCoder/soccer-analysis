"""Read-only HTTP API with versioned representation caches."""

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

app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1000)
EMPTY = "Noch keine Daten geladen. Bitte zuerst den Startbestand einspielen: uv run python -m soccer_api.seed"


@app.middleware("http")
async def headers_and_data(request: Request, call_next):
    if request.url.path.startswith("/api/"):
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
                stadiums = pd.read_sql_query("SELECT * FROM stadiums ORDER BY team", con)
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


@lru_cache(maxsize=4)
def match_body(path, version):
    df = prepared(path, version).sort_values(["date", "game_id"])
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
            or ghost not in ("include", "exclude", "only")
        ):
            raise ValueError()
    except ValueError:
        return JSONResponse(
            {
                "detail": "Ungültiger Filter: Ligen 1–5, ganze Saisonjahre in aufsteigender "
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
