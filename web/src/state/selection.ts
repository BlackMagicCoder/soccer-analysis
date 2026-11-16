import { writeQuery } from "./filters";

/**
 * Kreuzfilter-Auswahl (Variante A1): nur Dimensionen – Teams und Kalendermonate.
 * Liga und Saison laufen über den globalen Filter. Wetter- oder Ergebnisklassen
 * sind bewusst nicht auswählbar (Auswertung erst in Welle 3).
 */
export interface Selection {
  teams: string[];
  months: number[];
}
const KEYS = ["team", "monat"];
let current: Selection = { teams: [], months: [] };
const listeners = new Set<(s: Selection) => void>();

export function parseSelection(search: string, knownTeams?: string[]): Selection {
  const p = new URLSearchParams(search);
  let teams = (p.get("team") ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  if (knownTeams) teams = teams.filter((t) => knownTeams.includes(t));
  const months = (p.get("monat") ?? "")
    .split(",")
    .map(Number)
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  return {
    teams: [...new Set(teams)].sort((a, b) => a.localeCompare(b, "de")),
    months: [...new Set(months)].sort((a, b) => a - b),
  };
}
export function serializeSelection(s: Selection): string {
  const p = new URLSearchParams();
  if (s.teams.length) p.set("team", s.teams.join("|"));
  if (s.months.length) p.set("monat", s.months.join(","));
  return p.size ? "?" + p.toString() : "";
}
export function initializeSelection(knownTeams: string[]) {
  current = parseSelection(location.search, knownTeams);
  writeQuery(serializeSelection(current), KEYS);
}
export const getSelection = (): Selection => ({ teams: [...current.teams], months: [...current.months] });
export function setSelection(next: Selection) {
  current = parseSelection(serializeSelection(next));
  writeQuery(serializeSelection(current), KEYS);
  listeners.forEach((l) => l(getSelection()));
}
export function toggle<K extends keyof Selection>(key: K, value: Selection[K][number], additive = true) {
  const s = getSelection();
  const list = s[key] as (string | number)[];
  const has = list.includes(value);
  const next = additive ? (has ? list.filter((v) => v !== value) : [...list, value]) : has && list.length === 1 ? [] : [value];
  setSelection({ ...s, [key]: next });
}
export const clearSelection = () => setSelection({ teams: [], months: [] });
export function subscribeSelection(listener: (s: Selection) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
if (typeof window !== "undefined")
  window.addEventListener("popstate", () => {
    current = parseSelection(location.search);
    listeners.forEach((l) => l(getSelection()));
  });
