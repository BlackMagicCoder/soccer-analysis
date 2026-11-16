import type { MetaResponse, Filter } from "../api/types";
import {
  defaults,
  filterKey,
  getFilter,
  setFilter,
  subscribe,
} from "../state/filters";
import { seasonLabel } from "./format";
export function filterbar(meta: MetaResponse, options: {ghost?: boolean} = {}) {
  const bar = document.createElement("div");
  bar.className = "filterbar";
  bar.setAttribute("aria-label", "Daten filtern");
  const leagues = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Liga";
  leagues.append(legend);
  const chips = document.createElement("div");
  chips.className = "controls";
  leagues.append(chips);
  const buttons = new Map<number, HTMLButtonElement>();
  const button = (text: string, action: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", action);
    return b;
  };
  const all = button("Alle", () =>
    setFilter({ leagues: defaults(meta).leagues }),
  );
  chips.append(all);
  for (const league of meta.leagues) {
    const b = button(league.name, () => {
      const f = getFilter();
      setFilter({
        leagues: f.leagues.includes(league.id)
          ? f.leagues.filter((id) => id !== league.id)
          : [...f.leagues, league.id],
      });
    });
    const dot = document.createElement("span");
    dot.className = `dot league-${league.id}`;
    dot.setAttribute("aria-hidden", "true");
    b.prepend(dot);
    buttons.set(league.id, b);
    chips.append(b);
  }
  const seasons = document.createElement("fieldset");
  seasons.innerHTML = "<legend>Saisons</legend>";
  const selects = document.createElement("div");
  selects.className = "controls";
  seasons.append(selects);
  const seasonSelect = (key: "seasonFrom" | "seasonTo", text: string) => {
    const label = document.createElement("label");
    label.textContent = text;
    const select = document.createElement("select");
    for (const year of meta.seasons) {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = seasonLabel(year);
      select.append(option);
    }
    select.addEventListener("change", () =>
      setFilter({ [key]: Number(select.value) }),
    );
    label.append(select);
    selects.append(label);
    return select;
  };
  const from = seasonSelect("seasonFrom", "von"),
    to = seasonSelect("seasonTo", "bis");
  const ghosts = document.createElement("fieldset");
  ghosts.innerHTML = "<legend>Geisterspiele</legend>";
  const segments = document.createElement("div");
  segments.className = "controls";
  ghosts.append(segments);
  const ghostButtons = new Map<Filter["ghost"], HTMLButtonElement>();
  for (const [value, label] of [
    ["include", "mit"],
    ["exclude", "ohne"],
    ["only", "nur"],
  ] as const) {
    const b = button(label, () => setFilter({ ghost: value }));
    ghostButtons.set(value, b);
    segments.append(b);
  }
  const reset = button("Zurücksetzen", () => setFilter(defaults(meta)));
  const count = document.createElement("output");
  count.className = "filter-count";
  count.setAttribute("aria-live", "polite");
  count.textContent = "Spiele werden geladen …";
  bar.append(leagues, seasons);
  if (options.ghost !== false) bar.append(ghosts);
  bar.append(reset, count);
  const update = (f: Filter) => {
    buttons.forEach((b, id) =>
      b.setAttribute("aria-pressed", String(f.leagues.includes(id))),
    );
    all.setAttribute(
      "aria-pressed",
      String(f.leagues.length === meta.leagues.length),
    );
    ghostButtons.forEach((b, key) =>
      b.setAttribute("aria-pressed", String(key === f.ghost)),
    );
    from.value = String(f.seasonFrom);
    to.value = String(f.seasonTo);
    reset.disabled = filterKey(f) === filterKey(defaults(meta));
  };
  update(getFilter());
  subscribe(update);
  return { bar, count };
}
