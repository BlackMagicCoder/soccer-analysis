import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from soccer_api.db import connect
from soccer_api.main import app
from soccer_api.refresh import SourceError, parse_league, refresh, weather
from soccer_api.seed import seed


def league_html(match_id=99999, kickoff="2020-10-01 18:30:00"):
    match = dict(id=str(match_id), isResult=True, datetime=kickoff,
                 h={"title": "Team 1-1"}, a={"title": "Team 1-2"},
                 goals={"h": "2", "a": "1"}, xG={"h": "1.5", "a": "0.7"})
    def history(side):
        return dict(date=match["datetime"], h_a=side, npxG="1.2", npxGA="0.5", xpts="2.1",
                    deep="8", ppda={"att": "120", "def": "10"})
    teams = {"1": {"title": "Team 1-1", "history": [history("h")]},
             "2": {"title": "Team 1-2", "history": [history("a")]}}
    def script(name, payload):
        encoded = "".join("\\x%02x" % b for b in json.dumps(payload).encode())
        return f"var {name} = JSON.parse('{encoded}');"
    return script("datesData", [match]) + script("teamsData", teams)


def test_parse_realistic_encoded_response():
    row = parse_league(league_html(), 1, 2020)[0]
    assert row["game_id"] == 99999
    assert row["home_ppda"] == 12
    assert row["home_points"] == 3
    assert row["away_points"] == 0
    assert row["away_deep_completions"] == 8
    assert row["home_np_xg_difference"] == pytest.approx(.7)


def test_parser_cutoff_keeps_last_day_excludes_june():
    assert len(parse_league(league_html(kickoff="2026-05-31 23:59:59"), 1, 2025)) == 1
    assert parse_league(league_html(kickoff="2026-06-01 00:00:00"), 1, 2025) == []


def test_maintenance_never_changes_existing_database(seed_file):
    seed(seed_file)
    with connect() as con:
        before = list(con.execute("SELECT * FROM meta"))
        count = con.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
    with pytest.raises(SourceError, match="datesData"):
        refresh([1], [2020], fetcher=lambda *a, **k: "<html>We will come back soon</html>")
    with connect() as con:
        assert list(con.execute("SELECT * FROM meta")) == before
        assert con.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == count


def test_refresh_upserts_without_seed_dependency(tmp_path, monkeypatch):
    monkeypatch.setenv("SOCCER_DATA_DIR", str(tmp_path))
    result = refresh([1], [2020], fetcher=lambda *a, **k: league_html())
    assert result["matches_written"] == 1
    assert result["weather_requests"] == 0
    assert "Stadionkoordinaten fehlen" in result["warnings"][0]
    with connect() as con:
        row = con.execute("SELECT game_id,home_ppda,w_temp FROM matches").fetchone()
        assert row == (99999, 12, None)
    assert refresh([1], [2020], fetcher=lambda *a, **k: league_html())["matches_written"] == 0
    with connect() as con:
        assert con.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 1
    with TestClient(app) as client:
        assert client.get("/api/meta").status_code == 200
        assert client.get("/api/matches").status_code == 200
        assert client.get("/api/stadiums").status_code == 200
        assert client.get("/api/models").status_code == 200


def test_existing_seed_weather_survives_refresh(seed_file):
    seed(seed_file)
    with connect() as con:
        before = con.execute("SELECT w_temp,w_wind,w_precip_2h FROM matches WHERE game_id=0").fetchone()
    refresh([1], [2020], weather_limit=0, fetcher=lambda *a, **k: league_html(0))
    with connect() as con:
        assert con.execute("SELECT w_temp,w_wind,w_precip_2h FROM matches WHERE game_id=0").fetchone() == before


def test_missing_history_is_null():
    html = league_html()
    # A valid empty team history must not manufacture advanced statistics.
    start = html.index("var teamsData")
    row = parse_league(html[:start] + "var teamsData = JSON.parse('{}');", 1, 2020)[0]
    assert row["home_ppda"] is None
    assert row["home_xg"] == 1.5


def test_weather_utc_units_and_two_hour_precipitation():
    urls = []
    def fetcher(url, **kwargs):
        urls.append(url)
        return json.dumps({"hourly": {"time": ["2020-10-01T18:00", "2020-10-01T19:00", "2020-10-01T20:00"],
                                     "temperature_2m": [12, 11, 10], "wind_speed_10m": [20, 21, 22],
                                     "precipitation": [5, 1, 2]}})
    result = weather(50, 7, datetime(2020, 10, 1, 18, 30, tzinfo=timezone.utc), fetcher)
    assert result == {"w_temp": 12, "w_wind": 20, "w_precip_2h": 6}
    assert "models=" not in urls[0]
    assert "timezone=UTC" in urls[0]
