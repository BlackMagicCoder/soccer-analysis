"""Transactional, checksum-based parquet import."""

import hashlib
import sys
from datetime import datetime, timezone

import pandas as pd

from soccer_api.db import connect, data_dir, quote

SIDE_NUMBERS = "goals points xg np_xg np_xg_difference expected_points ppda deep_completions lat lon".split()
NUMBERS = [f"{side}_{c}" for side in ("home", "away") for c in SIDE_NUMBERS]
NUMBERS += "season_id travel_km is_derby w_temp w_wind w_precip_2h w_temp_diff_away".split()
REQUIRED = {"game_id", "league_id", "date", "home_team", "away_team", *NUMBERS}
REQUIRED.update(f"{s}_{c}" for s in ("home", "away") for c in ("City", "Venue"))


def seed(path=None):
    path = data_dir() / "seed/Match_statistics_enriched.parquet" if path is None else path
    from pathlib import Path

    path = Path(path)
    checksum = hashlib.sha256(path.read_bytes()).hexdigest()
    with connect(False) as con:
        con.execute("BEGIN IMMEDIATE")
        con.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        meta = dict(con.execute("SELECT key, value FROM meta"))
        if meta.get("seed_sha256") == checksum:
            print("Keine Änderungen: Der Startbestand ist bereits geladen.")
            return int(meta["data_version"])
        frame = pd.read_parquet(path)
        missing = REQUIRED - set(frame.columns)
        if missing:
            raise ValueError("Fehlende Pflichtspalten: " + ", ".join(sorted(missing)))
        if frame.game_id.isna().any() or frame.game_id.duplicated().any():
            raise ValueError("game_id muss eindeutig und vollständig sein.")
        for col in NUMBERS:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")
        frame["date"] = pd.to_datetime(frame.date, errors="raise").map(lambda d: d.isoformat())
        frame["league_id"] = frame.league_id.astype(str)
        frame["source"] = "seed"
        frame["weather_final"] = 1
        types = {
            c: (
                "INTEGER"
                if pd.api.types.is_integer_dtype(frame[c])
                else "REAL"
                if pd.api.types.is_numeric_dtype(frame[c])
                else "TEXT"
            )
            for c in frame
        }
        schema = ", ".join(
            f"{quote(c)} {t}" + (" PRIMARY KEY" if c == "game_id" else "") for c, t in types.items()
        )
        con.execute("CREATE TABLE IF NOT EXISTS matches (" + schema + ")")
        existing = {r[1] for r in con.execute("PRAGMA table_info(matches)")}
        for c in set(frame) - existing:
            con.execute(f"ALTER TABLE matches ADD COLUMN {quote(c)} {types[c]}")
        cols = ",".join(map(quote, frame.columns))
        updates = ",".join(f"{quote(c)}=excluded.{quote(c)}" for c in frame if c != "game_id")
        sql = f"INSERT INTO matches ({cols}) VALUES ({','.join('?' for _ in frame)}) "
        sql += "ON CONFLICT(game_id) DO UPDATE SET " + updates
        values = frame.astype(object).where(pd.notna(frame), None)
        con.executemany(sql, values.itertuples(index=False, name=None))
        con.execute(
            "CREATE TABLE IF NOT EXISTS stadiums "
            "(team TEXT PRIMARY KEY, venue TEXT, city TEXT, lat REAL, lon REAL, league_id TEXT)"
        )
        con.execute("DELETE FROM stadiums")
        all_matches = pd.read_sql_query("SELECT * FROM matches ORDER BY date, game_id", con)
        for team, group in all_matches.groupby("home_team", sort=True):
            row = group.iloc[-1]
            appearances = all_matches.loc[(all_matches.home_team == team) | (all_matches.away_team == team)]
            league = appearances.league_id.mode().iloc[0]
            con.execute(
                "INSERT INTO stadiums VALUES (?,?,?,?,?,?)",
                (team, row.home_Venue, row.home_City, row.home_lat, row.home_lon, league),
            )
        version = int(meta.get("data_version", 0)) + 1
        meta.update(
            data_version=str(version),
            seed_sha256=checksum,
            updated_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        )
        con.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", meta.items())
        teams = len(set(all_matches.home_team) | set(all_matches.away_team))
        stadiums = con.execute(
            "SELECT COUNT(*) FROM (SELECT DISTINCT lat,lon FROM stadiums "
            "WHERE lat IS NOT NULL AND lon IS NOT NULL)"
        ).fetchone()[0]
        print(f"{len(frame)} Spiele eingespielt; {teams} Teams, {stadiums} Stadien; Datenversion {version}.")
        return version


if __name__ == "__main__":
    try:
        seed(sys.argv[1] if len(sys.argv) > 1 else None)
    except (ValueError, OSError) as exc:
        sys.exit(f"Startbestand konnte nicht geladen werden: {exc}")
