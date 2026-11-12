"""Independent model fits; one failure never invalidates the other results."""

import math
import warnings

import numpy as np
import statsmodels.formula.api as smf

from soccer_api.prepare import LEAGUES, team_seasons

SPECS = [
    ("f1_cold_hot", "poisson", "goals", "cold + hot"),
    ("f1_temp_quadratic", "poisson", "goals", "w_temp + I(w_temp**2)"),
    ("f2_rain_goals", "poisson", "goals", "rain"),
    ("f2_rain_xg", "ols", "xg_tot", "rain"),
    ("f3_wind_goals", "poisson", "goals", "wind10"),
    ("f3_wind_xg", "ols", "xg_tot", "wind10"),
    ("f4_hwin", "logit", "hwin", "w_temp + I(w_temp**2) + w_wind + rain"),
    ("f4_draw", "logit", "draw", "w_temp + I(w_temp**2) + w_wind + rain"),
    ("f5_travel", "logit", "hwin", "trav100"),
    ("f5_travel_no_las_palmas", "logit", "hwin", "trav100"),
    ("f5_travel_midweek", "logit", "hwin", "trav100 * midweek"),
    *[
        (f"f6_{key}", "ols", outcome, "C(tbin)")
        for key, outcome in [
            ("away_ppda", "away_ppda"),
            ("away_xg", "away_xg"),
            ("home_xg", "home_xg"),
            ("away_deep", "away_deep_completions"),
        ]
    ],
    ("f7_derby_hwin", "logit", "hwin", "is_derby"),
    ("f7_derby_goals", "poisson", "goals", "is_derby"),
    ("f8_lat", "logit", "hwin", "home_lat"),
    ("f8_climate", "logit", "hwin", "tdabs"),
    ("f8_lat_raw", "logit", "hwin", "home_lat"),
    ("ghost_effect", "logit", "hwin", "ghost"),
    ("f11_points_ppda", "ols", "pkt", "ppda + xgd"),
]


def controls(df):
    return (
        ["strdiff"]
        + (["league"] if df.league.nunique() > 1 else [])
        + (["ghost"] if df.ghost.nunique() > 1 else [])
    )


def fit(df, kind, outcome, terms, used):
    df = df.dropna(subset=[outcome])
    formula = outcome + " ~ " + terms
    formula += "".join(" + " + ("C(league)" if c == "league" else c) for c in used)
    model = getattr(smf, kind)(formula, df)
    if len(model.endog) < 200:
        raise ValueError("Zu wenige Spiele für dieses Modell.")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = model.fit(disp=0)
    if hasattr(result, "mle_retvals") and not result.mle_retvals.get("converged", True):
        raise ValueError("Das Modell ist nicht konvergiert.")
    output = []
    for name, coef in result.params.items():
        if name == "Intercept" or name in used or name.startswith("C(league)"):
            continue
        p = float(result.pvalues[name])
        if not np.isfinite([coef, p]).all():
            raise ValueError("Das Modell konnte nicht zuverlässig geschätzt werden.")
        label = name.removeprefix("C(tbin)[T.").removesuffix("]") if name.startswith("C(tbin)") else name
        term = {"name": label, "coef": float(coef), "p": p}
        if kind in ("poisson", "logit"):
            effect = math.exp(coef)
            term.update({"effect_pct": (effect - 1) * 100} if kind == "poisson" else {"odds_ratio": effect})
        output.append(term)
    return {"kind": kind, "outcome": outcome, "n": int(result.nobs), "controls": used, "terms": output}


def compute(df):
    models, errors = {}, {}
    for key, kind, outcome, terms in SPECS:
        d = df
        used = controls(d)
        if key == "f5_travel_no_las_palmas":
            d = d[(d.home_team != "Las Palmas") & (d.away_team != "Las Palmas")]
            used = controls(d)
        if key == "f8_lat_raw":
            used = []
        if key == "f11_points_ppda":
            d = team_seasons(d)
            used = ["league"] if d.league.nunique() > 1 else []
        try:
            if key == "ghost_effect":
                if d.ghost.nunique() < 2:
                    raise ValueError("Keine Variation der Geisterspiele im gewählten Filter.")
                used = [c for c in used if c != "ghost"]
            models[key] = fit(d, kind, outcome, terms, used)
        except Exception as exc:
            errors[key] = (
                str(exc)
                if isinstance(exc, ValueError)
                and str(exc).startswith(("Zu wenige", "Keine Variation", "Das Modell"))
                else "Das Modell konnte nicht geschätzt werden."
            )
    by_league = []
    ns = 0
    used_union = []
    for league, d in df.groupby("league"):
        try:
            used = controls(d)
            result = fit(d, "logit", "hwin", "trav100", used)
            by_league.append({**result["terms"][0], "name": league})
            ns += result["n"]
            used_union = list(dict.fromkeys(used_union + used))
        except Exception:
            errors[f"f5_travel_by_league:{league}"] = "Zu wenige Spiele oder Modell nicht schätzbar."
    if by_league:
        by_league.sort(key=lambda t: list(LEAGUES.values()).index(t["name"]))
        models["f5_travel_by_league"] = dict(
            kind="logit", outcome="hwin", n=ns, controls=used_union, terms=by_league
        )
    else:
        errors["f5_travel_by_league"] = "Zu wenige Spiele oder Modell nicht schätzbar."
    return models, errors
