import type { Filter, MetaResponse } from "../api/types";
export type { Filter, GhostMode } from "../api/types";
export const defaults = (m: MetaResponse): Filter => ({
  leagues: m.leagues.map((l) => l.id).sort((a, b) => a - b),
  seasonFrom: Math.min(...m.seasons),
  seasonTo: Math.max(...m.seasons),
  ghost: "include",
});
export function parseFilter(search: string, m: MetaResponse): Filter {
  const p = new URLSearchParams(search),
    d = defaults(m);
  const raw = p.get("l");
  const ids = raw?.split(",").map(Number);
  const leagues =
    ids?.length && ids.every((x) => d.leagues.includes(x))
      ? [...new Set(ids)].sort((a, b) => a - b)
      : d.leagues;
  const season = (key: string, fallback: number) => {
    const s = p.get(key);
    return s && /^\d{4}$/.test(s) && m.seasons.includes(Number(s))
      ? Number(s)
      : fallback;
  };
  let seasonFrom = season("von", d.seasonFrom),
    seasonTo = season("bis", d.seasonTo);
  if (seasonFrom > seasonTo) [seasonFrom, seasonTo] = [seasonTo, seasonFrom];
  return {
    leagues,
    seasonFrom,
    seasonTo,
    ghost:
      p.get("geister") === "ohne"
        ? "exclude"
        : p.get("geister") === "nur"
          ? "only"
          : "include",
  };
}
export function serializeFilter(f: Filter, m: MetaResponse): string {
  const p = new URLSearchParams(),
    d = defaults(m);
  if ([...f.leagues].sort((a, b) => a - b).join(",") !== d.leagues.join(","))
    p.set("l", [...f.leagues].sort((a, b) => a - b).join(","));
  if (f.seasonFrom !== d.seasonFrom) p.set("von", String(f.seasonFrom));
  if (f.seasonTo !== d.seasonTo) p.set("bis", String(f.seasonTo));
  if (f.ghost !== "include")
    p.set("geister", f.ghost === "only" ? "nur" : "ohne");
  return p.size ? "?" + p.toString().replace(/%2C/g, ",") : "";
}
export const filterKey = (f: Filter) =>
  `${[...f.leagues].sort((a, b) => a - b).join(",")}|${f.seasonFrom}|${f.seasonTo}|${f.ghost}`;
export const toModelsQuery = (f: Filter) =>
  "?" +
  new URLSearchParams({
    leagues: [...f.leagues].sort((a, b) => a - b).join(","),
    season_from: String(f.seasonFrom),
    season_to: String(f.seasonTo),
    ghost: f.ghost,
  }).toString();
let meta: MetaResponse;
let current: Filter;
const listeners = new Set<(f: Filter) => void>();
export function initializeFilters(m: MetaResponse) {
  meta = m;
  current = parseFilter(location.search, m);
  history.replaceState(
    null,
    "",
    location.pathname + serializeFilter(current, m) + location.hash,
  );
}
export function getFilter(): Filter {
  return { ...current, leagues: [...current.leagues] };
}
export function setFilter(patch: Partial<Filter>) {
  const next = { ...current, ...patch };
  if (!next.leagues.length) next.leagues = defaults(meta).leagues;
  current = parseFilter(serializeFilter(next, meta), meta);
  history.replaceState(
    null,
    "",
    location.pathname + serializeFilter(current, meta) + location.hash,
  );
  listeners.forEach((l) => l(getFilter()));
}
export function subscribe(listener: (f: Filter) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
if (typeof window !== "undefined")
  window.addEventListener("popstate", () => {
    if (meta) {
      current = parseFilter(location.search, meta);
      listeners.forEach((l) => l(getFilter()));
    }
  });
