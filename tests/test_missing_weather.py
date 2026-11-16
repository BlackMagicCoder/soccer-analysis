import pandas as pd

from soccer_api.prepare import prepare


def test_weather_flags_preserve_unknowns(seed_file):
    frame = pd.read_parquet(seed_file)
    frame.loc[0, ["w_temp", "w_precip_2h"]] = float("nan")
    result = prepare(frame)
    assert result.loc[0, ["cold", "hot", "rain"]].isna().all()
    assert result.loc[1, "rain"] == int(frame.loc[1, "w_precip_2h"] > 0.5)
