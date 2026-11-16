import {
  integerColumns,
  flagColumns,
  numericColumns,
  type MatchesResponse,
  type IntegerColumn,
  type FlagColumn,
  type NumericColumn,
  type Filter,
} from "../api/types";
import { filterKey } from "../state/filters";
export interface Dataset {
  n: number;
  dataVersion: number;
  teams: string[];
  columns: Record<IntegerColumn, Int32Array> &
    Record<FlagColumn, Uint8Array> &
    Record<NumericColumn, Float64Array> & { date: Float64Array };
}
export function decodeMatches(r: MatchesResponse): Dataset {
  const columns = {} as Dataset["columns"];
  for (const k of integerColumns) columns[k] = Int32Array.from(r.columns[k]);
  // 255 marks unknown flags, preserving the difference between unknown and false.
  for (const k of flagColumns) columns[k] = Uint8Array.from(r.columns[k], v => v === null ? 255 : v);
  for (const k of numericColumns)
    columns[k] = Float64Array.from(r.columns[k], (v) => (v === null ? NaN : v));
  columns.date = Float64Array.from(r.columns.date, (d) => Date.parse(d + "Z"));
  return { n: r.n, dataVersion: r.data_version, teams: r.teams, columns };
}
const caches = new WeakMap<Dataset, Map<string, Uint32Array>>();
export function selectRows(d: Dataset, f: Filter): Uint32Array {
  let cache = caches.get(d);
  if (!cache) {
    cache = new Map();
    caches.set(d, cache);
  }
  const key = d.dataVersion + "|" + filterKey(f);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const rows: number[] = [];
  for (let i = 0; i < d.n; i++) {
    const c = d.columns;
    if (
      f.leagues.includes(c.league[i]) &&
      c.date[i] < Date.UTC(2026, 5, 1) &&
      c.season[i] >= f.seasonFrom &&
      c.season[i] <= f.seasonTo &&
      (f.ghost === "include" || c.ghost[i] === (f.ghost === "only" ? 1 : 0))
    )
      rows.push(i);
  }
  const result = Uint32Array.from(rows);
  cache.set(key, result);
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  return result;
}
export function summarize(d: Dataset, rows: Uint32Array) {
  let home = 0,
    draw = 0,
    away = 0,
    goals = 0;
  for (const i of rows) {
    const h = d.columns.home_goals[i],
      a = d.columns.away_goals[i];
    home += Number(h > a);
    draw += Number(h === a);
    away += Number(h < a);
    goals += h + a;
  }
  const n = rows.length;
  return {
    n,
    homeWinPct: n ? (home / n) * 100 : 0,
    drawPct: n ? (draw / n) * 100 : 0,
    awayWinPct: n ? (away / n) * 100 : 0,
    goalsPerMatch: n ? goals / n : 0,
  };
}
