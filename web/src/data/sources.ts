import { integerColumns, type UnderstatResponse, type WikidataResponse, type OpenMeteoResponse, type UnderstatNumeric, type Filter } from "../api/types";
import { applySelection } from "./explore";
import type { Selection } from "../state/selection";
export const understatColumnKeys = [...integerColumns, "home_xg", "away_xg", "home_xpts", "away_xpts", "home_ppda", "away_ppda", "home_deep", "away_deep", "date"] as const;
export const weatherColumnKeys = ["time", "lat", "lon", "w_temp", "w_wind", "w_precip_2h"] as const;
export interface UnderstatDataset {
    n: number;
    dataVersion: number;
    teams: string[];
    columns: Record<UnderstatNumeric | "date", Float64Array>;
}
export function decodeUnderstat(r: UnderstatResponse): UnderstatDataset {
    const columns = {} as UnderstatDataset["columns"];
    for (const k of understatColumnKeys)
        columns[k] = k === "date" ? Float64Array.from(r.columns.date, v => Date.parse(v + "Z")) : Float64Array.from(r.columns[k], v => v === null ? NaN : v);
    return { n: r.n, dataVersion: r.data_version, teams: r.teams, columns };
}
export function selectUnderstat(d: UnderstatDataset, f: Filter, s: Selection = { teams: [], months: [] }): Uint32Array {
    const rows = Uint32Array.from(Array.from({ length: d.n }, (_, i) => i).filter(i => f.leagues.includes(d.columns.league[i]) && d.columns.season[i] >= f.seasonFrom && d.columns.season[i] <= f.seasonTo));
    return applySelection(d, rows, s);
}
export function decodeWikidata(r: WikidataResponse) { return r.stadiums.map(s => ({ ...s, lat: s.lat ?? NaN, lon: s.lon ?? NaN, wikidata: s.wikidata ?? undefined })); }
export function decodeOpenMeteo(r: OpenMeteoResponse) {
    return Array.from({ length: r.n }, (_, i) => ({ time: r.columns.time[i], lat: r.columns.lat[i] ?? NaN, lon: r.columns.lon[i] ?? NaN, w_temp: r.columns.w_temp[i] ?? NaN, w_wind: r.columns.w_wind[i] ?? NaN, w_precip_2h: r.columns.w_precip_2h[i] ?? NaN }));
}
