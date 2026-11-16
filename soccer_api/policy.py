"""Fixed analysis window, shared by imports, refreshes and every API snapshot."""

import pandas as pd

ANALYSIS_END = "2026-05-31"
LATEST_SEASON = 2025
EARLIEST_SEASON = 2014


def bounded(frame):
    dates = pd.to_datetime(frame.date, utc=True, errors="coerce")
    seasons = pd.to_numeric(frame.season_id, errors="coerce")
    mask = (dates < pd.Timestamp("2026-06-01", tz="UTC")) & seasons.between(EARLIEST_SEASON, LATEST_SEASON)
    result = frame.loc[mask].copy()
    result["date"] = dates.loc[mask].dt.tz_localize(None)
    return result


def stadium_frame(frame):
    """Use only eligible historical home matches, never later stadium snapshots."""
    columns = ["team", "venue", "city", "lat", "lon", "league_id"]
    if frame.empty:
        return pd.DataFrame(columns=columns)
    latest = frame.sort_values(["date", "game_id"]).groupby("home_team", sort=True).tail(1)
    result = latest[["home_team", "home_Venue", "home_City", "home_lat", "home_lon", "league_id"]].copy()
    result.columns = columns
    return result.sort_values("team").reset_index(drop=True)
