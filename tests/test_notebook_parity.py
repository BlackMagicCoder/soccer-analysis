"""Printed notebook precision determines each absolute tolerance."""

import pandas as pd
import pytest

from soccer_api.db import ROOT
from soccer_api.models import compute
from soccer_api.prepare import prepare
from soccer_api.seed import seed

REAL_SEED = ROOT / "data/seed/Match_statistics_enriched.parquet"
if not REAL_SEED.exists():
    pytest.skip("Reale Seed-Datei fehlt; Notebook-Parität nicht verifiziert.", allow_module_level=True)


@pytest.fixture(scope="module")
def real(tmp_path_factory):
    import os
    import sqlite3

    directory = tmp_path_factory.mktemp("parity")
    previous = os.environ.get("SOCCER_DATA_DIR")
    os.environ["SOCCER_DATA_DIR"] = str(directory)
    try:
        seed(REAL_SEED)
        with sqlite3.connect(directory / "soccer.db") as con:
            df = prepare(pd.read_sql_query("SELECT * FROM matches", con))
            stadiums = pd.read_sql_query("SELECT * FROM stadiums", con)
        models, errors = compute(df)
        assert not errors, errors
        return df, stadiums, models
    finally:
        if previous is None:
            os.environ.pop("SOCCER_DATA_DIR", None)
        else:
            os.environ["SOCCER_DATA_DIR"] = previous


def test_counts_and_descriptives(real):
    df, stadiums, _ = real
    assert len(df) == 21589 and df.game_id.is_unique
    assert len(set(df.home_team) | set(df.away_team)) == 168
    assert len(stadiums[["lat", "lon"]].dropna().drop_duplicates()) == 163
    for actual, expected, tolerance in [
        (df.hwin.mean() * 100, 44.2, 0.06),
        (df.draw.mean() * 100, 25.2, 0.06),
        ((df.res == "A").mean() * 100, 30.7, 0.06),
        (df.goals.mean(), 2.77, 0.006),
        (df.loc[df.w_temp <= 2, "goals"].mean(), 2.67, 0.006),
    ]:
        assert abs(actual - expected) < tolerance
    assert (df.w_temp <= 2).sum() == 877
    assert df.ghost.sum() == 2234


# model, term, coefficient, p-value, coefficient tolerance, p-value tolerance
CASES = [
    ("f1_cold_hot", "cold", -0.0764, 0.0003, 0.00006, 0.00006),
    ("f1_cold_hot", "hot", 0.0074, 0.6958, 0.00006, 0.00006),
    ("f1_temp_quadratic", "w_temp", 0.0072, 0.0003, 0.00006, 0.00006),
    ("f1_temp_quadratic", "I(w_temp ** 2)", -0.0002, 0.0232, 0.00006, 0.00006),
    ("f2_rain_goals", "rain", 0.0277, 0.0392, 0.00006, 0.00006),
    ("f2_rain_xg", "rain", -0.0041, 0.8692, 0.00006, 0.00006),
    ("f3_wind_goals", "wind10", -0.0202, 0.0006, 0.00006, 0.00006),
    ("f3_wind_xg", "wind10", -0.0322, 0.0023, 0.00006, 0.00006),
    ("f4_hwin", "rain", 0.0416, 0.4122, 0.00006, 0.00006),
    ("f4_hwin", "w_wind", -0.0011, 0.6225, 0.00006, 0.00006),
    ("f5_travel", "trav100", 0.0069, 0.281, 0.00006, 0.0006),
    ("f5_travel_no_las_palmas", "trav100", 0.0065, 0.3938, 0.00006, 0.00006),
    ("f5_travel_midweek", "trav100:midweek", -0.0044, 0.8125, 0.00006, 0.00006),
    ("f5_travel_by_league", "Bundesliga", -0.001, 0.978, 0.0006, 0.0006),
    ("f5_travel_by_league", "EPL", 0.049, 0.093, 0.0006, 0.0006),
    ("f5_travel_by_league", "La Liga", 0.006, 0.530, 0.0006, 0.0006),
    ("f5_travel_by_league", "Ligue 1", -0.015, 0.286, 0.0006, 0.0006),
    ("f5_travel_by_league", "Serie A", 0.024, 0.093, 0.0006, 0.0006),
    ("f6_away_ppda", "c_300-500", 0.4418, 0.001, 0.00006, 0.0006),
    ("f6_away_ppda", "d_500-800", 0.3152, 0.046, 0.00006, 0.0006),
    ("f7_derby_hwin", "is_derby", -0.0481, 0.5193, 0.00006, 0.00006),
    ("f7_derby_goals", "is_derby", -0.0361, 0.0804, 0.00006, 0.00006),
    ("f8_lat_raw", "home_lat", 0.0002, 0.9485, 0.00006, 0.00006),
    ("f8_lat", "home_lat", -0.0074, 0.3042, 0.00006, 0.00006),
    ("f8_climate", "tdabs", 0.0026, 0.635, 0.00006, 0.0006),
    ("ghost_effect", "ghost", -0.215, 0.000014, 0.0006, 0.0000006),
    ("f11_points_ppda", "ppda", 0.0030, 0.212, 0.00006, 0.0006),
    ("f11_points_ppda", "xgd", 0.696, None, 0.0006, None),
]


@pytest.mark.parametrize("model,term,coef,p,ctol,ptol", CASES)
def test_coefficients(real, model, term, coef, p, ctol, ptol):
    terms = {t["name"]: t for t in real[2][model]["terms"]}
    assert abs(terms[term]["coef"] - coef) < ctol
    if p is not None:
        assert abs(terms[term]["p"] - p) < ptol


@pytest.mark.parametrize(
    "model,term,field,expected,tolerance",
    [
        ("f1_cold_hot", "cold", "effect_pct", -7.35, 0.006),
        ("f2_rain_goals", "rain", "effect_pct", 2.81, 0.006),
        ("f3_wind_goals", "wind10", "effect_pct", -2.0, 0.06),
        ("f5_travel", "trav100", "odds_ratio", 1.007, 0.0006),
        ("f7_derby_hwin", "is_derby", "odds_ratio", 0.953, 0.0006),
        ("f7_derby_goals", "is_derby", "effect_pct", -3.55, 0.006),
    ],
)
def test_effects(real, model, term, field, expected, tolerance):
    result = next(t for t in real[2][model]["terms"] if t["name"] == term)
    assert abs(result[field] - expected) < tolerance
