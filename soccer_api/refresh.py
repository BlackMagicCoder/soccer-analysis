"""Incremental source refresh. Run daily locally; no source failure deletes cached matches.

Understat has no documented API: embedded datesData/teamsData are validated strictly.
Weather uses the Open-Meteo archive default model, UTC hourly (five-day delay), cached by URL on disk.
Known team stadium coordinates (Wikidata P625, see docs/stadien-wikidata.csv) are reused; unknown teams keep missing geodata.
"""

import argparse
import ast
import hashlib
import json
import math
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from email.utils import parsedate_to_datetime

import pandas as pd

from soccer_api.db import connect, data_dir, quote
from soccer_api.prepare import LEAGUES
from soccer_api.seed import NUMBERS, REQUIRED
from soccer_api.policy import ANALYSIS_END, LATEST_SEASON, EARLIEST_SEASON, bounded, stadium_frame
from soccer_api.operations import writer_lock, write_status, stamp

SOURCE_LEAGUES = {1: "EPL", 2: "Serie_A", 3: "Bundesliga", 4: "La_liga", 5: "Ligue_1"}
WEATHER_COLUMNS = ("w_temp", "w_wind", "w_precip_2h", "w_temp_diff_away")


class SourceError(ValueError):
    """Source is unavailable or its response cannot be trusted."""


def embedded(html, name):
    match = re.search(r"\b" + name + r"\s*=\s*JSON\.parse\(\s*('(?:\\.|[^'\\])*')\s*\)", html)
    if not match:
        raise SourceError(f"Understat: {name} fehlt (Wartung, Sperre oder geändertes Format).")
    try:
        return json.loads(ast.literal_eval(match[1]))
    except (ValueError, SyntaxError, TypeError) as exc:
        raise SourceError(f"Understat: ungültiges {name}.") from exc


def numeric(value):
    if value is None:
        return None
    number = float(value)
    if not math.isfinite(number):
        raise SourceError("Nicht endlicher Zahlenwert in Quelldaten.")
    return number


def parse_league(html, league, season):
    validate_scope([league], [season], 0)
    matches, teams = embedded(html, "datesData"), embedded(html, "teamsData")
    if not isinstance(matches, list) or not isinstance(teams, dict):
        raise SourceError("Understat: unerwartete Datenstruktur.")
    histories = {}
    try:
        for team in teams.values():
            for item in team["history"]:
                histories[(team["title"], item["date"], item["h_a"])] = item
        rows = []
        seen = set()
        for match in matches:
            if match.get("isResult") is not True:
                continue
            row = dict(game_id=int(match["id"]), league_id=str(league), season_id=season,
                       date=datetime.fromisoformat(match["datetime"]).isoformat(), source="understat")
            if row["game_id"] in seen:
                raise SourceError("Understat: doppelte Spiel-ID.")
            seen.add(row["game_id"])
            goals = {s: int(match["goals"][s]) for s in ("h", "a")}
            if any(v < 0 for v in goals.values()):
                raise SourceError("Understat: negative Torzahl.")
            if row["date"][:10] > ANALYSIS_END:
                continue
            for side, key, other in (("home", "h", "a"), ("away", "a", "h")):
                team = match[key]["title"]
                history = histories.get((team, match["datetime"], key), {})
                row[f"{side}_team"] = team
                row[f"{side}_goals"] = goals[key]
                row[f"{side}_points"] = 3 if goals[key] > goals[other] else int(goals[key] == goals[other])
                row[f"{side}_xg"] = numeric(match["xG"][key])
                for dest, src in (("np_xg", "npxG"), ("expected_points", "xpts"),
                                  ("deep_completions", "deep")):
                    row[f"{side}_{dest}"] = numeric(history.get(src))
                npg, npga = numeric(history.get("npxG")), numeric(history.get("npxGA"))
                row[f"{side}_np_xg_difference"] = None if npg is None or npga is None else npg - npga
                ppda = history.get("ppda", {})
                att, defense = numeric(ppda.get("att")), numeric(ppda.get("def"))
                row[f"{side}_ppda"] = att / defense if att is not None and defense else None
            rows.append(row)
        return rows
    except (KeyError, TypeError, ValueError) as exc:
        if isinstance(exc, SourceError):
            raise
        raise SourceError("Understat: unvollständige oder ungültige Spieldaten.") from exc


def request_text(request, attempts=3):
    """Retry only transient transport/HTTP failures; never retry invalid payloads."""
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read().decode("utf8")
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == attempts - 1:
                raise
            header = exc.headers.get("Retry-After", "")
            try:
                wait = float(header)
            except ValueError:
                try:
                    wait = (parsedate_to_datetime(header) - datetime.now(timezone.utc)).total_seconds()
                except (ValueError, TypeError):
                    wait = 2**attempt
            if wait > 60:
                # Do not violate a longer server backoff: fail now, let the daily run retry.
                raise SourceError(f"Quelle fordert Retry-After={header}; später erneut versuchen.") from exc
            time.sleep(max(0, wait))
        except URLError:
            if attempt == attempts - 1:
                raise
            time.sleep(2**attempt)


def fetch(url, ttl=72000):
    folder = data_dir() / "source-cache"
    path = folder / (hashlib.sha256(url.encode()).hexdigest() + ".txt")
    if path.exists() and time.time() - path.stat().st_mtime < ttl:
        return path.read_text(encoding="utf8")
    request = Request(url, headers={"User-Agent": "soccer-analysis/0.1 (local research)", "Accept": "text/html,application/json"})
    text = request_text(request)
    # Do not retain maintenance pages or error bodies as valid source cache entries.
    if "understat.com" in url:
        embedded(text, "datesData")
        embedded(text, "teamsData")
    else:
        payload = json.loads(text)
        if payload.get("error") or "hourly" not in payload:
            raise SourceError("Open-Meteo: keine stündlichen Wetterdaten.")
    folder.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(text, encoding="utf8")
    temporary.replace(path)
    return text


def weather(lat, lon, kickoff, fetcher=fetch):
    start = kickoff.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=2)
    query = urlencode(dict(latitude=lat, longitude=lon, start_date=start.date().isoformat(),
                           end_date=end.date().isoformat(), timezone="UTC",
                           hourly="temperature_2m,wind_speed_10m,precipitation", wind_speed_unit="kmh"))
    payload = json.loads(fetcher("https://archive-api.open-meteo.com/v1/archive?" + query, ttl=10**10))
    hourly = payload["hourly"]
    indices = [hourly["time"].index((start + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M")) for i in (0, 1)]
    # Reproduces the notebook values (checked against Open-Meteo on 13.11.2026): default archive
    # model ("best_match", no models= parameter); temperature/wind at the UTC hour containing the
    # kickoff; precipitation = kickoff hour plus the following hour.
    return dict(w_temp=numeric(hourly["temperature_2m"][indices[0]]),
                w_wind=numeric(hourly["wind_speed_10m"][indices[0]]),
                w_precip_2h=sum(numeric(hourly["precipitation"][i]) for i in indices))


def distance(lat1, lon1, lat2, lon2):
    a, b = math.radians(lat1), math.radians(lat2)
    dlat, dlon = b - a, math.radians(lon2 - lon1)
    h = math.sin(dlat / 2)**2 + math.cos(a) * math.cos(b) * math.sin(dlon / 2)**2
    return 6371 * 2 * math.asin(math.sqrt(min(1, h)))


def initialize(con):
    con.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    columns = {name: "REAL" if name in NUMBERS else "TEXT" for name in REQUIRED}
    columns.update(game_id="INTEGER PRIMARY KEY", source="TEXT", weather_final="INTEGER")
    con.execute("CREATE TABLE IF NOT EXISTS matches (" + ",".join(quote(k) + " " + v for k, v in columns.items()) + ")")
    con.execute("CREATE TABLE IF NOT EXISTS stadiums (team TEXT PRIMARY KEY, venue TEXT, city TEXT, lat REAL, lon REAL, league_id TEXT)")


def validate_scope(leagues, seasons, weather_limit):
    if (not leagues or not set(leagues) <= set(LEAGUES) or not seasons
            or any(not isinstance(s, int) or s < EARLIEST_SEASON or s > LATEST_SEASON for s in seasons)
            or weather_limit < 0):
        raise ValueError("Ungültiger Bereich: Saisons 2014–2025, Ligen 1–5; Analyse endet am 31.05.2026.")


def refresh(leagues, seasons, weather_limit=50, fetcher=fetch, now=None, weather_only=False):
    validate_scope(leagues, seasons, weather_limit)
    with writer_lock():
        write_status(state="running", attempt_at=stamp(), error=None, mode="weather" if weather_only else "sources")
        try:
            result = _refresh(leagues, seasons, weather_limit, fetcher, now, weather_only)
        except Exception as exc:
            write_status(state="error", finished_at=stamp(), error=str(exc))
            raise
        warnings = result["warnings"]
        updates = dict(state="partial" if warnings else "ok", finished_at=stamp(), error=None, **result)
        if not warnings:
            updates["success_at"] = stamp()
        write_status(**updates)
        return result


def _refresh(leagues, seasons, weather_limit=50, fetcher=fetch, now=None, weather_only=False):
    now = now or datetime.now(timezone.utc)
    # All league payloads must validate before the database can be changed.
    rows = []
    if not weather_only:
        for league in leagues:
            for season in seasons:
                html = fetcher(f"https://understat.com/league/{SOURCE_LEAGUES[league]}/{season}")
                rows.extend(parse_league(html, league, season))
    with connect(False) as con:
        initialize(con)
        historical = bounded(pd.read_sql_query("SELECT * FROM matches", con))
        stadiums = {r["team"]: r for r in stadium_frame(historical).to_dict("records")}
        if weather_only:
            selected = historical[pd.to_numeric(historical.league_id).isin(leagues)
                                  & pd.to_numeric(historical.season_id).isin(seasons)]
            pending = selected[list(WEATHER_COLUMNS)].isna().any(axis=1) | selected.weather_final.ne(1)
            selected = selected.loc[pending]
            rows = selected.astype(object).where(pd.notna(selected), None).to_dict("records")
            for row in rows:
                row["date"] = row["date"].isoformat()
        existing = {str(row["game_id"]): row for row in
                    historical.astype(object).where(pd.notna(historical), None).to_dict("records")}
        for prior in existing.values():
            prior["date"] = prior["date"].isoformat()
    warnings, requests = [], 0
    for row in rows:
        prior = existing.get(str(row["game_id"]), {})
        for side in ("home", "away"):
            stadium = stadiums.get(row[f"{side}_team"], {})
            for col in ("lat", "lon", "city", "venue"):
                name = f"{side}_{col.capitalize() if col in ('city', 'venue') else col}"
                if not weather_only:
                    row[name] = prior.get(name) if prior.get(name) is not None else stadium.get(col)
        coords = [None if pd.isna(row.get(k)) else row.get(k)
                  for k in ("home_lat", "home_lon", "away_lat", "away_lon")]
        if all(v is not None for v in coords):
            if not weather_only:
                row["travel_km"] = distance(*coords)
                row["is_derby"] = int(row["travel_km"] < 30)
        else:
            warnings.append(f"Spiel {row['game_id']}: Stadionkoordinaten fehlen.")
        kickoff = datetime.fromisoformat(row["date"]).replace(tzinfo=timezone.utc)
        complete_weather = all(prior.get(k) is not None for k in
                               ("w_temp", "w_wind", "w_precip_2h", "w_temp_diff_away"))
        if prior.get("weather_final") and complete_weather and prior.get("date") == row["date"]:
            continue
        row["weather_final"] = 0
        if kickoff > now - timedelta(days=5) or requests >= weather_limit or any(v is None for v in coords):
            if all(v is not None for v in coords):
                warnings.append(f"Spiel {row['game_id']}: Wetter ausstehend (Archivverzögerung oder Abrufbudget).")
            continue
        try:
            requests += 1
            row.update(weather(coords[0], coords[1], kickoff, fetcher))
            if requests < weather_limit:
                requests += 1
                away = weather(coords[2], coords[3], kickoff, fetcher)
                row["w_temp_diff_away"] = row["w_temp"] - away["w_temp"]
                row["weather_final"] = int(all(row.get(k) is not None for k in
                                             ("w_temp", "w_wind", "w_precip_2h", "w_temp_diff_away")))
        except (OSError, ValueError, KeyError, TypeError) as exc:
            warnings.append(f"Spiel {row['game_id']}: Wetter ausstehend ({exc}).")
    changed = 0
    with connect(False) as con:
        con.execute("BEGIN IMMEDIATE")
        for row in rows:
            if weather_only:
                # Weather repair is an update of weather fields only: no normalized dates,
                # geographic recomputation, source changes or stadium-table writes.
                cols = [*WEATHER_COLUMNS, "weather_final"]
                updates = ",".join(f"{quote(k)}=COALESCE(?,{quote(k)})" for k in cols)
                differs = " OR ".join(f"COALESCE(?,{quote(k)}) IS NOT {quote(k)}" for k in cols)
                values = tuple(row.get(k) for k in cols)
                changed += con.execute(
                    f"UPDATE matches SET {updates} WHERE game_id=? AND ({differs})",
                    (*values, row["game_id"], *values),
                ).rowcount
                continue
            cols = list(row)
            # Existing enriched values survive missing upstream fields.
            updates = ",".join(f"{quote(k)}=COALESCE(excluded.{quote(k)},matches.{quote(k)})" for k in cols if k != "game_id")
            differs = " OR ".join(
                f"COALESCE(excluded.{quote(k)},matches.{quote(k)}) IS NOT matches.{quote(k)}"
                for k in cols if k != "game_id"
            )
            changed += con.execute(
                f"INSERT INTO matches ({','.join(map(quote, cols))}) VALUES ({','.join('?' for _ in cols)}) "
                f"ON CONFLICT(game_id) DO UPDATE SET {updates} WHERE {differs}", tuple(row.values())
            ).rowcount
            for side in ("home", "away"):
                con.execute("INSERT OR IGNORE INTO stadiums(team,league_id) VALUES (?,?)",
                            (row[f"{side}_team"], row["league_id"]))
        meta = dict(con.execute("SELECT key,value FROM meta"))
        if changed:
            meta.update(data_version=str(int(meta.get("data_version", 0)) + 1),
                        updated_at=now.isoformat().replace("+00:00", "Z"))
        meta.update(refresh_attempt_at=now.isoformat())
        con.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", meta.items())
    return dict(matches_checked=len(rows), matches_written=changed, weather_requests=requests, warnings=warnings)


def main():
    parser = argparse.ArgumentParser(description="Lokaler Quellenabgleich (für täglichen Aufgabenplaner-Aufruf).")
    parser.add_argument("--leagues", default="1,2,3,4,5", help="Liga-IDs 1–5, kommagetrennt")
    parser.add_argument("--seasons", default=str(LATEST_SEASON), help="Startjahre 2014–2025, kommagetrennt")
    parser.add_argument("--weather-limit", type=int, default=50, help="Maximale Open-Meteo-Aufrufe pro Lauf")
    parser.add_argument("--watch", action="store_true", help="Im Vordergrund alle 24 Stunden abgleichen; Strg+C beendet")
    parser.add_argument("--weather-only", action="store_true", help="Nur ausstehendes Wetter aus lokaler Datenbank nachladen")
    args = parser.parse_args()
    try:
        leagues = sorted({int(v) for v in args.leagues.split(",")})
        seasons = sorted({int(v) for v in args.seasons.split(",")})
        validate_scope(leagues, seasons, args.weather_limit)
        while True:
            try:
                result = refresh(leagues, seasons, args.weather_limit, weather_only=args.weather_only)
                print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
            except (ValueError, OSError) as exc:
                print(f"Quellenabgleich fehlgeschlagen; vorhandene Spiele bleiben erhalten: {exc}", file=sys.stderr, flush=True)
                if not args.watch:
                    return 1
            if not args.watch:
                break
            time.sleep(24 * 60 * 60)
    except (ValueError, OSError) as exc:
        print(f"Quellenabgleich fehlgeschlagen; vorhandene Spiele bleiben erhalten: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
