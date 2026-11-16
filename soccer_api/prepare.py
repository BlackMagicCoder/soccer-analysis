"""Notebook-equivalent feature preparation on the complete match snapshot."""

from functools import lru_cache
from contextlib import closing

import numpy as np
import pandas as pd

from soccer_api.seed import NUMBERS
from soccer_api.policy import bounded

LEAGUES = {1: "EPL", 2: "Serie A", 3: "Bundesliga", 4: "La Liga", 5: "Ligue 1"}
TBINS = ["a_≤150", "b_150-300", "c_300-500", "d_500-800", "e_>800"]


def team_view(df):
    parts = []
    for side, other in (("home", "away"), ("away", "home")):
        part = df[
            [
                "season_id",
                "league",
                f"{side}_team",
                f"{side}_ppda",
                f"{side}_points",
                f"{side}_xg",
                f"{other}_xg",
            ]
        ].copy()
        part.columns = ["season", "league", "team", "ppda", "pkt", "xf", "xa"]
        parts.append(part)
    return pd.concat(parts, ignore_index=True)


def team_seasons(df):
    ts = (
        team_view(df)
        .groupby(["season", "league", "team"])
        .agg(ppda=("ppda", "mean"), pkt=("pkt", "mean"), xgd=("xf", "mean"), xga=("xa", "mean"))
        .reset_index()
    )
    ts["xgd"] -= ts.xga
    return ts


def prepare(df):
    df = bounded(df)
    for column in NUMBERS:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df["date"] = pd.to_datetime(df.date)
    df["league"] = pd.to_numeric(df.league_id).map(LEAGUES)
    df["res"] = np.select([df.home_goals > df.away_goals, df.home_goals < df.away_goals], ["H", "A"], "D")
    for name, val in (("hwin", "H"), ("draw", "D")):
        df[name] = (df.res == val).astype(int)
    df["goals"] = df.home_goals + df.away_goals
    df["o25"] = (df.goals > 2.5).astype(int)
    df["xg_tot"] = df.home_xg + df.away_xg
    df["ghost"] = df.date.between("2020-03-15", "2021-06-30").astype(int)
    tv = team_view(df).assign(diff=lambda x: x.xf - x.xa)
    strength = tv.groupby(["season", "team"])["diff"].mean()
    df["strdiff"] = df.set_index(["season_id", "home_team"]).index.map(strength) - df.set_index(
        ["season_id", "away_team"]
    ).index.map(strength)
    df["trav100"] = df.travel_km / 100
    df["wind10"] = df.w_wind / 10
    for name, (condition, source) in {
        "rain": (df.w_precip_2h > 0.5, df.w_precip_2h),
        "cold": (df.w_temp <= 2, df.w_temp),
        "hot": (df.w_temp > 25, df.w_temp),
        "midweek": (df.date.dt.day_of_week.isin([1, 2, 3]), df.date),
    }.items():
        # Missing source weather is unknown, not evidence of dry or moderate conditions.
        df[name] = condition.astype(int).where(source.notna(), np.nan)
    df["tdabs"] = df.w_temp_diff_away.abs()
    df["tbin"] = pd.cut(df.travel_km, [-1, 150, 300, 500, 800, 3000], labels=TBINS)
    return df


@lru_cache(maxsize=4)
def prepared(path, version):
    import sqlite3

    with closing(sqlite3.connect(path + "?mode=ro", uri=True)) as con:
        return prepare(pd.read_sql_query("SELECT * FROM matches", con))
