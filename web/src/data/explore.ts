import type { Dataset } from "./dataset";
import type { Selection } from "../state/selection";

export const monthOf = (ts: number) => new Date(ts).getUTCMonth() + 1;
export const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
/** Fußballjahr: August bis Juli. */
export const SEASON_MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function applySelection(d: {teams: string[]; columns: {home_team: ArrayLike<number>; away_team: ArrayLike<number>; date: ArrayLike<number>}}, rows: Uint32Array, s: Selection): Uint32Array {
  if (!s.teams.length && !s.months.length) return rows;
  const teams = new Set(s.teams.map((t) => d.teams.indexOf(t)).filter((i) => i >= 0));
  const months = new Set(s.months);
  const out: number[] = [];
  const c = d.columns;
  for (const i of rows) {
    if (s.teams.length && !teams.has(c.home_team[i]) && !teams.has(c.away_team[i])) continue;
    if (months.size && !months.has(monthOf(c.date[i]))) continue;
    out.push(i);
  }
  return Uint32Array.from(out);
}

export function countBy<K>(rows: Iterable<number>, key: (i: number) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const i of rows) {
    const k = key(i);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface Bin { from: number; to: number; n: number }
/** Gleich breite Klassen; Werte außerhalb landen in der ersten bzw. letzten Klasse (offene Ränder). */
export function bins(values: Iterable<number>, from: number, to: number, width: number) {
  const out: Bin[] = [];
  for (let x = from; x < to - 1e-9; x += width) out.push({ from: x, to: x + width, n: 0 });
  let missing = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) { missing++; continue; }
    const k = Math.min(out.length - 1, Math.max(0, Math.floor((v - from) / width)));
    out[k].n++;
  }
  return { bins: out, missing };
}

export function share(part: number, total: number) {
  return total ? (part / total) * 100 : 0;
}

export function outcome(d: Dataset, i: number): "H" | "D" | "A" {
  const h = d.columns.home_goals[i], a = d.columns.away_goals[i];
  return h > a ? "H" : h < a ? "A" : "D";
}

export type SortDir = 1 | -1;
export function sortRows(rows: Uint32Array, value: (i: number) => number | string, dir: SortDir): Uint32Array {
  const arr = Array.from(rows);
  arr.sort((x, y) => {
    const a = value(x), b = value(y);
    const an = typeof a === "number" && Number.isNaN(a), bn = typeof b === "number" && Number.isNaN(b);
    if (an || bn) return an === bn ? 0 : an ? 1 : -1; // fehlende Werte immer ans Ende
    return (a < b ? -1 : a > b ? 1 : 0) * dir;
  });
  return Uint32Array.from(arr);
}

/** Minimaler CSV-Parser für die eigene Nachweisdatei (Kommas, doppelte Anführungszeichen). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) lines.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) lines.push(row);
  const [head, ...body] = lines;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ""), r[i] ?? ""])));
}
