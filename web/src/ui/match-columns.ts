import type { Ctx } from "./layout";
import { fmt } from "../charts/ec";
import { seasonLabel } from "./format";
import { wikidata } from "../views/common";
import { understatColumnKeys } from "../data/sources";
export const understatTableKeys = understatColumnKeys;
export interface Column {
    key: string;
    label: string;
    value(i: number): number | string;
    show(i: number): string;
    numeric?: boolean;
    initial?: boolean;
}
export function matchColumns(ctx: Ctx, pure = false): Column[] {
    const d = ctx.dataset;
    const c = d.columns;
    const num = (a: Float64Array | Int32Array, digits = 2) => ({
        value: (i: number) => a[i],
        show: (i: number) => (Number.isFinite(a[i]) ? fmt(a[i], digits) : "—"),
        numeric: true,
    });
    const flag = (a: Uint8Array) => ({ value: (i: number) => (a[i] === 255 ? NaN : a[i]), show: (i: number) => (a[i] === 255 ? "—" : a[i] ? "ja" : "nein") });
    const kickoff = (i: number) => new Date(c.date[i]).toISOString().slice(0, 16).replace("T", " ");
    let columns: Column[] = [
        { key: "date", label: "Anstoß (UTC)", value: (i) => c.date[i], show: kickoff, initial: true },
        { key: "league", label: "Liga", value: (i) => ctx.leagueName(c.league[i]), show: (i) => ctx.leagueName(c.league[i]), initial: true },
        { key: "season", label: "Saison", value: (i) => c.season[i], show: (i) => seasonLabel(c.season[i]) },
        { key: "home_team", label: "Heim", value: (i) => (d.teams[c.home_team[i]] ?? "—"), show: (i) => (d.teams[c.home_team[i]] ?? "—"), initial: true },
        { key: "away_team", label: "Gast", value: (i) => (d.teams[c.away_team[i]] ?? "—"), show: (i) => (d.teams[c.away_team[i]] ?? "—"), initial: true },
        { key: "score", label: "Ergebnis", value: (i) => c.home_goals[i] - c.away_goals[i], show: (i) => `${c.home_goals[i]} : ${c.away_goals[i]}`, initial: true },
        { key: "home_xg", label: "xG Heim", ...num(c.home_xg), initial: true },
        { key: "away_xg", label: "xG Gast", ...num(c.away_xg), initial: true },
        { key: "home_xpts", label: "xPTS Heim", ...num(c.home_xpts) },
        { key: "away_xpts", label: "xPTS Gast", ...num(c.away_xpts) },
        { key: "home_ppda", label: "PPDA Heim", ...num(c.home_ppda) },
        { key: "away_ppda", label: "PPDA Gast", ...num(c.away_ppda) },
        { key: "home_deep", label: "Deep Heim", ...num(c.home_deep, 0) },
        { key: "away_deep", label: "Deep Gast", ...num(c.away_deep, 0) },
        { key: "travel_km", label: "Distanz km", ...num(c.travel_km, 0), initial: true },
        { key: "is_derby", label: "Derby", ...flag(c.is_derby) },
        { key: "w_temp", label: "Temp. °C", ...num(c.w_temp, 1), initial: true },
        { key: "w_wind", label: "Wind km/h", ...num(c.w_wind, 1), initial: true },
        { key: "w_precip_2h", label: "Regen mm", ...num(c.w_precip_2h, 1), initial: true },
        { key: "w_temp_diff_away", label: "Temp.-Diff. °C", ...num(c.w_temp_diff_away, 1) },
        { key: "ghost", label: "Geisterspiel", ...flag(c.ghost) },
        { key: "game_id", label: "Spiel-ID", value: (i) => c.game_id[i], show: (i) => String(c.game_id[i]), numeric: true },
    ];
    for (const key of ["home_goals", "away_goals", "home_points", "away_points", "strdiff"] as const)
        columns.push({ key, label: ({ home_goals: "Tore Heim", away_goals: "Tore Gast", home_points: "Punkte Heim", away_points: "Punkte Gast", strdiff: "Teamstärke-Diff." } as const)[key], ...num(c[key], key === "strdiff" ? 2 : 0) });
    if (!pure)
        for (const key of ["venue", "city", "lat", "lon", "wikidata"] as const) {
            const value = (i: number): string | number => { const team = (d.teams[c.home_team[i]] ?? "—"), s = ctx.stadiums.find(s => s.team === team); return key === "wikidata" ? wikidata.get(team) ?? "" : s?.[key] ?? ""; };
            columns.push({ key, label: ({ venue: "Heimstadion", city: "Ort", lat: "Breite", lon: "Länge", wikidata: "Wikidata-ID" } as const)[key], value, show: i => String(value(i)) });
        }
    return pure ? columns.filter(c => (understatTableKeys as readonly string[]).includes(c.key)) : columns;
}
