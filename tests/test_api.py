import sqlite3

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from soccer_api.db import connect
from soccer_api.main import EMPTY, app
from soccer_api.prepare import prepare
from soccer_api.seed import seed


def test_seed(seed_file):
    assert seed(seed_file) == 1
    with connect() as con:
        old = dict(con.execute("SELECT * FROM meta"))
        assert con.execute("SELECT COUNT(DISTINCT game_id) FROM matches").fetchone()[0] == 800
        assert con.execute("SELECT source,weather_final FROM matches LIMIT 1").fetchone() == ("seed", 1)
        assert "source_file" in [r[1] for r in con.execute("PRAGMA table_info(matches)")]
    assert seed(seed_file) == 1
    with connect() as con:
        assert dict(con.execute("SELECT * FROM meta")) == old
    df = pd.read_parquet(seed_file)
    df.loc[0, "home_goals"] = 9
    df.to_parquet(seed_file)
    assert seed(seed_file) == 2
    with connect() as con:
        assert con.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 800
        assert con.execute("SELECT home_goals FROM matches WHERE game_id=0").fetchone()[0] == 9


def test_missing_columns(seed_file):
    df = pd.read_parquet(seed_file).drop(columns=["home_xg", "away_City"])
    df.to_parquet(seed_file)
    with pytest.raises(ValueError, match="away_City, home_xg"):
        seed(seed_file)
    with connect() as con:
        assert con.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0] == 0


@pytest.mark.parametrize("endpoint", ["meta", "matches", "stadiums", "models"])
def test_empty(tmp_path, monkeypatch, endpoint):
    monkeypatch.setenv("SOCCER_DATA_DIR", str(tmp_path))
    client = TestClient(app)
    response = client.get("/api/" + endpoint)
    assert response.status_code == 503
    assert response.json() == {"detail": EMPTY}
    assert response.headers["cache-control"] == "no-cache"
    with sqlite3.connect(tmp_path / "soccer.db") as con:
        con.execute("CREATE TABLE matches (game_id INTEGER)")
    assert client.get("/api/" + endpoint).status_code == 503


def test_payloads(client):
    meta = client.get("/api/meta").json()
    assert meta["n_matches"] == 800
    assert len(meta["leagues"]) == 5
    assert meta["seasons"] == [2019, 2020, 2021]
    payload = client.get("/api/matches").json()
    assert payload["n"] == 800
    assert payload["teams"] == sorted(payload["teams"])
    cols = payload["columns"]
    assert len(cols) == 26
    assert all(len(v) == 800 for v in cols.values())
    assert None in cols["home_ppda"] and None in cols["w_temp_diff_away"]
    assert all(len(d) == 16 for d in cols["date"])
    assert list(zip(cols["date"], cols["game_id"])) == sorted(zip(cols["date"], cols["game_id"]))
    stadiums = client.get("/api/stadiums").json()["stadiums"]
    assert [s["team"] for s in stadiums] == sorted(s["team"] for s in stadiums)
    assert set(stadiums[0]) == {"team", "league", "venue", "city", "lat", "lon"}


@pytest.mark.parametrize("endpoint", ["meta", "matches", "stadiums", "models"])
def test_etag(client, endpoint):
    response = client.get("/api/" + endpoint)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["etag"].startswith('"')
    cached = client.get("/api/" + endpoint, headers={"If-None-Match": response.headers["etag"]})
    assert cached.status_code == 304 and cached.content == b""


@pytest.mark.parametrize(
    "query",
    [
        "leagues=0",
        "leagues=",
        "leagues=a",
        "ghost=no",
        "season_from=x",
        "season_from=2022&season_to=2020",
        "season_to=1.5",
    ],
)
def test_validation(client, query):
    assert client.get("/api/models?" + query).status_code == 422


def test_models(client):
    payload = client.get("/api/models").json()
    assert payload["n"] == 800
    assert "f1_cold_hot" in payload["models"]
    assert "f11_points_ppda" in payload["models"]
    assert "f5_travel_by_league" in payload["errors"]
    for model in payload["models"].values():
        assert set(model) == {"kind", "outcome", "n", "controls", "terms"}
        assert all({"name", "coef", "p"} <= set(t) for t in model["terms"])
    one = client.get("/api/models?leagues=1&ghost=exclude").json()
    assert "ghost_effect" in one["errors"]
    assert "f1_cold_hot" in one["errors"]  # fewer than 200 usable matches
    single = client.get("/api/models?leagues=1").json()
    assert all("league" not in m["controls"] for m in single["models"].values())
    no_ghost = client.get("/api/models?ghost=exclude").json()
    assert "f1_cold_hot" in no_ghost["models"]
    assert "ghost" not in no_ghost["models"]["f1_cold_hot"]["controls"]
    a = client.get("/api/models?leagues=3,1,1")
    b = client.get("/api/models?leagues=1,3&ghost=include")
    assert a.headers["etag"] == b.headers["etag"]
    empty = client.get("/api/models?season_from=2100").json()
    # An inverted default range is rejected; an explicit empty range yields model errors.
    assert "detail" in empty
    empty = client.get("/api/models?season_from=2100&season_to=2101")
    assert empty.status_code == 200
    assert empty.json()["n"] == 0 and not empty.json()["models"]


def test_control_selection(seed_file):
    from soccer_api.models import compute

    df = prepare(pd.read_parquet(seed_file).assign(away_ppda=lambda x: pd.to_numeric(x.away_ppda)))
    df["league"] = "EPL"
    df["ghost"] = 0
    models, errors = compute(df)
    assert models["f1_cold_hot"]["controls"] == ["strdiff"]
    assert "ghost_effect" in errors


def test_cache_version(client, seed_file):
    before = client.get("/api/matches")
    df = pd.read_parquet(seed_file)
    df.loc[0, "home_goals"] = 17
    df.to_parquet(seed_file)
    seed(seed_file)
    after = client.get("/api/matches", headers={"If-None-Match": before.headers["etag"]})
    assert after.status_code == 200
    assert after.json()["data_version"] == 2
    assert 17 in after.json()["columns"]["home_goals"]


def test_fit_failure_isolated(client, monkeypatch):
    from soccer_api import main, models

    main.model_response.cache_clear()

    def fail(*args, **kwargs):
        raise RuntimeError("simulierter Fehler")

    monkeypatch.setattr(models.smf, "poisson", fail)
    payload = client.get("/api/models").json()
    assert "f1_cold_hot" in payload["errors"]
    assert "f2_rain_xg" in payload["models"]
    main.model_response.cache_clear()


def test_features_and_full_strength(client):
    from soccer_api.prepare import prepared, team_seasons
    from soccer_api.db import data_dir

    df = prepared((data_dir() / "soccer.db").resolve().as_uri(), 1)
    assert df.ghost.sum() > 0
    assert (df.goals == df.home_goals + df.away_goals).all()
    assert (df.trav100 == df.travel_km / 100).all()
    assert not df.strdiff.isna().any()
    for _, row in df.iloc[:10].iterrows():

        def strength(team):
            season = df[df.season_id == row.season_id]
            home = season[season.home_team == team]
            away = season[season.away_team == team]
            return pd.concat([home.home_xg - home.away_xg, away.away_xg - away.home_xg]).mean()

        assert row.strdiff == pytest.approx(strength(row.home_team) - strength(row.away_team))
    assert not team_seasons(df).duplicated(["season", "league", "team"]).any()


def test_seed_rollback(seed_file, monkeypatch):
    seed(seed_file)
    df = pd.read_parquet(seed_file)
    df.loc[0, "home_goals"] = 17
    df.to_parquet(seed_file)
    original = pd.read_sql_query

    def fail_read(*args, **kwargs):
        raise RuntimeError("Fehler nach dem Upsert")

    monkeypatch.setattr(pd, "read_sql_query", fail_read)
    with pytest.raises(RuntimeError):
        seed(seed_file)
    monkeypatch.setattr(pd, "read_sql_query", original)
    with connect() as con:
        assert dict(con.execute("SELECT * FROM meta"))["data_version"] == "1"
        assert con.execute("SELECT home_goals FROM matches WHERE game_id=0").fetchone()[0] != 17
