import csv
import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from soccer_api import main
from soccer_api.db import data_dir
from soccer_api.seed import seed


@pytest.fixture(autouse=True)
def clear_source_caches():
    main.source_body.cache_clear()
    main.wikidata_ids.cache_clear()
    yield
    main.source_body.cache_clear()
    main.wikidata_ids.cache_clear()


def test_understat(client):
    payload = client.get("/api/source/understat").json()
    allowed = {"game_id", "date", "league", "season"}
    allowed.update(f"{side}_{name}" for side in ("home", "away")
                   for name in ("team", "goals", "points", "xg", "xpts", "ppda", "deep"))
    cols = payload["columns"]
    assert set(cols) == allowed
    assert payload["n"] == 800
    assert all(len(values) == payload["n"] for values in cols.values())
    assert payload["teams"] == sorted(payload["teams"])
    assert list(zip(cols["date"], cols["game_id"])) == sorted(zip(cols["date"], cols["game_id"]))
    assert None in cols["home_ppda"]
    for side in ("home", "away"):
        for name in ("goals", "points", "deep", "team"):
            assert all(value is None or type(value) is int for value in cols[f"{side}_{name}"])
        for name in ("xg", "xpts", "ppda"):
            assert all(value is None or value == round(value, 4) for value in cols[f"{side}_{name}"])
    merged = client.get("/api/matches").json()
    assert payload["teams"] == merged["teams"]
    assert all(values == merged["columns"][key] for key, values in cols.items())


@pytest.mark.parametrize("source", ["understat", "wikidata", "open-meteo"])
def test_source_etag(client, source):
    response = client.get(f"/api/source/{source}")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"
    cached = client.get(f"/api/source/{source}", headers={"If-None-Match": response.headers["etag"]})
    assert cached.status_code == 304
    assert cached.content == b""


@pytest.mark.parametrize("exists", [True, False])
def test_wikidata(client, tmp_path, monkeypatch, exists):
    monkeypatch.setattr(main, "ROOT", tmp_path)
    if exists:
        docs = tmp_path / "docs"
        docs.mkdir()
        with (docs / "stadien-wikidata.csv").open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=["team", "league_id", "venue", "city", "lat", "lon", "wikidata"])
            writer.writeheader()
            writer.writerow(dict(team="Las Palmas", wikidata="Q163995"))
    payload = client.get("/api/source/wikidata").json()
    stadiums = payload["stadiums"]
    assert payload["n_teams"] == len(stadiums)
    assert [row["team"] for row in stadiums] == sorted(row["team"] for row in stadiums)
    assert all(set(row) == {"team", "venue", "city", "lat", "lon", "wikidata"} for row in stadiums)
    assert payload["n_venues"] == len({(row["venue"], row["lat"], row["lon"]) for row in stadiums})
    assert next(row for row in stadiums if row["team"] == "Las Palmas")["wikidata"] == (
        "Q163995" if exists else None)
    assert all(row["wikidata"] is None for row in stadiums if row["team"] != "Las Palmas")
    if exists:
        (tmp_path / "docs" / "stadien-wikidata.csv").unlink()
        assert main.wikidata_ids()["Las Palmas"] == "Q163995"


def test_weather_missing_values_and_coordinates(seed_file):
    frame = pd.read_parquet(seed_file)
    frame.loc[0, "w_temp"] = float("nan")
    frame.loc[1, "home_lat"] = float("nan")
    frame.loc[2, "home_lon"] = float("nan")
    frame.loc[0, "date"] += pd.Timedelta(minutes=47)
    frame.to_parquet(seed_file)
    seed(seed_file)
    with TestClient(main.app) as client:
        response = client.get("/api/source/open-meteo")
    assert response.status_code == 200
    assert b"NaN" not in response.content
    payload = response.json()
    cols = payload["columns"]
    assert set(cols) == {"time", "lat", "lon", "w_temp", "w_wind", "w_precip_2h"}
    assert all(not any(word in key for word in ("team", "game", "goal")) for key in cols)
    assert payload["n"] == 798
    assert all(len(values) == payload["n"] for values in cols.values())
    assert all(time.endswith(":00") for time in cols["time"])
    assert list(zip(cols["time"], cols["lat"], cols["lon"])) == sorted(zip(cols["time"], cols["lat"], cols["lon"]))
    assert None in cols["w_temp"]
    for key in ("w_temp", "w_wind", "w_precip_2h"):
        assert all(value is None or value == round(value, 1) for value in cols[key])
    for key in ("lat", "lon"):
        assert all(value == round(value, 5) for value in cols[key])
    assert payload["example"] is None
    assert payload["query"]["timezone"] == "UTC"
    assert payload["query"]["delay_days"] == 5


def test_weather_example(client):
    cache = data_dir() / "source-cache"
    cache.mkdir()
    (cache / "00-broken.txt").write_text("{broken", encoding="utf-8")
    (cache / "01-unrelated.txt").write_text('{"other": []}', encoding="utf-8")
    raw = dict(latitude=50.1, longitude=7.2, timezone="GMT",
               hourly_units={"temperature_2m": "°C"},
               hourly={"time": list(range(12)), "temperature_2m": [None, 1, 2, 3, 4, 5, 6]})
    (cache / "02-weather.txt").write_text(json.dumps(raw), encoding="utf-8")
    (cache / "03-later.txt").write_text('{"hourly": {}}', encoding="utf-8")
    example = client.get("/api/source/open-meteo").json()["example"]
    assert set(example) == {"latitude", "longitude", "timezone", "hourly_units", "hourly", "truncated"}
    assert example["latitude"] == raw["latitude"]
    assert example["longitude"] == raw["longitude"]
    assert example["timezone"] == raw["timezone"]
    assert example["hourly_units"] == raw["hourly_units"]
    assert example["truncated"] is True
    assert example["hourly"] == {key: values[:6] for key, values in raw["hourly"].items()}
    (cache / "02-weather.txt").unlink()
    assert client.get("/api/source/open-meteo").json()["example"] == example


def test_source_version(client, seed_file):
    before = client.get("/api/source/understat")
    frame = pd.read_parquet(seed_file)
    frame.loc[0, "home_goals"] = 17
    frame.to_parquet(seed_file)
    seed(seed_file)
    after = client.get("/api/source/understat", headers={"If-None-Match": before.headers["etag"]})
    assert after.status_code == 200
    assert after.json()["data_version"] == 2
    assert 17 in after.json()["columns"]["home_goals"]


def test_weather_model_status(client):
    assert client.get("/api/status").json()["cache"]["weather_model"] == "Open-Meteo Standardmodell (best_match)"
