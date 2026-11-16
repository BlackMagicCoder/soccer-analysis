import io
import json
from datetime import datetime, timedelta
from email.message import Message
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from soccer_api.db import connect
from soccer_api.main import app
from soccer_api.operations import read_status, writer_lock
from soccer_api.policy import bounded
from soccer_api.refresh import refresh, request_text
from soccer_api.seed import seed


def test_cutoff_inclusive_and_season_ceiling():
    frame = pd.DataFrame({"date": ["2026-05-31T23:59:59", "2026-06-01", "2026-05-30"],
                          "season_id": [2025, 2025, 2026]})
    assert bounded(frame).index.tolist() == [0]


def test_seed_and_api_hide_later_rows(seed_file):
    frame = pd.read_parquet(seed_file)
    frame.loc[0, ["date", "season_id"]] = [pd.Timestamp("2026-05-31T23:59:59"), 2025]
    frame.loc[1, ["date", "season_id"]] = [pd.Timestamp("2026-06-01"), 2025]
    frame.loc[2, ["date", "season_id"]] = [pd.Timestamp("2026-05-30"), 2026]
    frame.to_parquet(seed_file)
    seed(seed_file)
    with connect(False) as con:
        assert con.execute("SELECT COUNT(*) FROM matches WHERE game_id IN (1,2)").fetchone()[0] == 0
        # Simulate preexisting later entries from an earlier application version.
        con.execute("INSERT INTO matches(game_id,date,season_id,home_team,away_team,league_id) VALUES (999999,'2026-07-01',2026,'Future','Future 2','1')")
    with TestClient(app) as client:
        meta = client.get("/api/meta").json()
        assert meta["date_max"] == "2026-05-31"
        assert meta["analysis_end"] == "2026-05-31"
        assert max(meta["seasons"]) == 2025
        matches = client.get("/api/matches").json()
        assert 999999 not in matches["columns"]["game_id"]
        assert "Future" not in matches["teams"]
        assert client.get("/api/models?season_to=2026").status_code == 422
        assert "Future" not in {r["team"] for r in client.get("/api/stadiums").json()["stadiums"]}


def test_status_without_data_and_future_rejected_before_network(tmp_path, monkeypatch):
    monkeypatch.setenv("SOCCER_DATA_DIR", str(tmp_path))
    with TestClient(app) as client:
        response = client.get("/api/status")
        assert response.status_code == 200
        assert response.json()["available"] is False
        assert response.json()["cache"]["files"] == 0
    def no_network(*args, **kwargs):
        pytest.fail("Future season must not reach network")
    with pytest.raises(ValueError, match="2014–2025"):
        refresh([1], [2026], fetcher=no_network)


def test_writer_lock_and_durable_error(tmp_path, monkeypatch):
    monkeypatch.setenv("SOCCER_DATA_DIR", str(tmp_path))
    with writer_lock():
        with pytest.raises(ValueError, match="läuft bereits"):
            refresh([1], [2025], fetcher=lambda *a, **k: "")
    with pytest.raises(ValueError):
        refresh([1], [2025], fetcher=lambda *a, **k: "maintenance")
    assert read_status()["state"] == "error"
    assert read_status().get("success_at") is None
    with writer_lock():
        pass


def test_transient_retry_respects_retry_after(monkeypatch):
    calls, waits = [], []
    headers = Message()
    headers["Retry-After"] = "3"
    def opener(*args, **kwargs):
        calls.append(1)
        if len(calls) < 3:
            raise HTTPError("https://example.com", 429, "limited", headers, None)
        return io.BytesIO(b"valid response")
    monkeypatch.setattr("soccer_api.refresh.urlopen", opener)
    monkeypatch.setattr("soccer_api.refresh.time.sleep", waits.append)
    assert request_text("https://example.com") == "valid response"
    assert waits == [3, 3]


def test_weather_only_independent_of_understat(seed_file):
    seed(seed_file)
    with connect(False) as con:
        con.execute("UPDATE matches SET weather_final=0,w_temp=NULL,w_wind=NULL,w_precip_2h=NULL,w_temp_diff_away=NULL WHERE game_id=0")
        con.execute("UPDATE matches SET travel_km=9876,is_derby=1,source='original-source' WHERE game_id=0")
        original = con.execute("SELECT travel_km,is_derby,source,date,home_lat,away_lon FROM matches WHERE game_id=0").fetchone()
    urls = []
    def fetcher(url, **kwargs):
        urls.append(url)
        assert "understat" not in url
        day = datetime.fromisoformat(parse_qs(urlparse(url).query)["start_date"][0])
        return json.dumps({"hourly": {"time": [(day + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(48)],
                                     "temperature_2m": [12] * 48, "wind_speed_10m": [20] * 48,
                                     "precipitation": [1] * 48}})
    result = refresh([1], [2019], weather_limit=2, fetcher=fetcher, weather_only=True)
    assert result["weather_requests"] == 2
    assert result["matches_checked"] == 1
    assert result["matches_written"] == 1
    with connect() as con:
        assert con.execute("SELECT w_temp,w_precip_2h,weather_final FROM matches WHERE game_id=0").fetchone() == (12, 2, 1)
        assert con.execute("SELECT travel_km,is_derby,source,date,home_lat,away_lon FROM matches WHERE game_id=0").fetchone() == original
    with TestClient(app) as client:
        status = client.get("/api/status").json()
        assert status["available"] is True
        assert status["refresh"]["mode"] == "weather"


def test_weather_only_complete_seed_is_noop(seed_file):
    seed(seed_file)
    with connect(False) as con:
        con.execute("UPDATE matches SET w_temp_diff_away=COALESCE(w_temp_diff_away,0)")
        version = con.execute("SELECT value FROM meta WHERE key='data_version'").fetchone()[0]
        original = list(con.execute("SELECT * FROM matches ORDER BY game_id"))
        stadiums = list(con.execute("SELECT * FROM stadiums ORDER BY team"))
        # Even an identical UPDATE would trigger this: complete rows must not be written.
        con.execute("CREATE TRIGGER forbid_completed_writes BEFORE UPDATE ON matches "
                    "BEGIN SELECT RAISE(ABORT,'completed seed must not be rewritten'); END")
    def no_network(*args, **kwargs):
        pytest.fail("Complete final weather must not reach any source")
    result = refresh([1, 2, 3, 4, 5], [2019, 2020, 2021], fetcher=no_network, weather_only=True)
    assert result["matches_checked"] == result["matches_written"] == result["weather_requests"] == 0
    with connect() as con:
        assert con.execute("SELECT value FROM meta WHERE key='data_version'").fetchone()[0] == version
        assert list(con.execute("SELECT * FROM matches ORDER BY game_id")) == original
        assert list(con.execute("SELECT * FROM stadiums ORDER BY team")) == stadiums
