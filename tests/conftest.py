import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from soccer_api.main import app
from soccer_api.seed import seed


@pytest.fixture
def seed_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SOCCER_DATA_DIR", str(tmp_path))
    rng = np.random.default_rng(812)
    n = 800
    league = np.arange(n) % 5 + 1
    home = [f"Team {lg}-{i}" for lg, i in zip(league, rng.integers(0, 40, n))]
    away = [f"Team {lg}-{i}" for lg, i in zip(league, rng.integers(0, 40, n))]
    home[0] = "Las Palmas"
    frame = pd.DataFrame(
        dict(
            game_id=np.arange(n),
            league_id=league.astype(str),
            season_id=np.array([2019, 2020, 2021])[np.arange(n) % 3],
            date=pd.to_datetime(np.array(["2019-10-01", "2020-10-01", "2021-10-01"])[np.arange(n) % 3])
            + pd.to_timedelta(rng.integers(0, 60, n), unit="D"),
            home_team=home,
            away_team=away,
            travel_km=rng.uniform(0, 1600, n),
            w_temp=rng.uniform(-8, 35, n),
            w_wind=rng.uniform(0, 50, n),
            w_precip_2h=rng.exponential(1, n),
            w_temp_diff_away=rng.normal(0, 5, n),
            source_file="synthetic",
        )
    )
    frame["is_derby"] = (frame.travel_km < 30).astype(int)
    for side in ("home", "away"):
        frame[f"{side}_goals"] = rng.poisson(1.5, n)
        for col in ("xg", "np_xg", "np_xg_difference", "expected_points"):
            frame[f"{side}_{col}"] = rng.uniform(0.1, 3, n)
        frame[f"{side}_ppda"] = rng.uniform(4, 20, n)
        frame[f"{side}_deep_completions"] = rng.integers(0, 20, n)
        frame[f"{side}_City"] = "Köln"
        frame[f"{side}_Venue"] = frame[f"{side}_team"] + " Stadion"
        frame[f"{side}_lat"] = rng.uniform(35, 55, n)
        frame[f"{side}_lon"] = rng.uniform(-5, 20, n)
    for side, other in (("home", "away"), ("away", "home")):
        frame[f"{side}_points"] = np.select(
            [
                frame[f"{side}_goals"] > frame[f"{other}_goals"],
                frame[f"{side}_goals"] == frame[f"{other}_goals"],
            ],
            [3, 1],
            0,
        )
    frame.loc[2, "home_ppda"] = np.nan
    frame.loc[4, "w_temp_diff_away"] = np.nan
    frame["away_ppda"] = frame.away_ppda.astype(str)
    path = tmp_path / "seed.parquet"
    frame.to_parquet(path)
    return path


@pytest.fixture
def client(seed_file):
    seed(seed_file)
    with TestClient(app) as client:
        yield client
