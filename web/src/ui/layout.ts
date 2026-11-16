import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../styles/app.css";
import { getDatasetSnapshot, getStadiums, getMeta, getUnderstat, getWikidata, getOpenMeteo } from "../api/client";
import type { MetaResponse, StadiumsResponse } from "../api/types";
import { decodeUnderstat, selectUnderstat, type UnderstatDataset } from "../data/sources";
import type { UnderstatResponse, WikidataResponse, OpenMeteoResponse } from "../api/types";
import { decodeMatches, selectRows, type Dataset } from "../data/dataset";
import { applySelection, MONTHS } from "../data/explore";
import { initializeFilters, getFilter, subscribe, type Filter } from "../state/filters";
import { clearSelection, getSelection, initializeSelection, setSelection, subscribeSelection, type Selection } from "../state/selection";
import { filterbar } from "./filterbar";
import { date, number } from "./format";

export const pages = [["index", "Übersicht"], ["spieldaten", "Spieldaten"], ["stadien", "Stadien"], ["wetter", "Wetter"], ["verknuepft", "Verknüpfte Daten"], ["fragen", "Fragen"], ["zusammenfassung", "Zusammenfassung"]] as const;
const intros: Record<string,string> = {index:"Die drei Datenquellen und ihre Inhalte.",spieldaten:"Spielstatistiken aus Understat.",stadien:"Stadion-Stammdaten aus Wikidata.",wetter:"Wetterabfragen nach Ort und Zeit.",verknuepft:"Verknüpfte Quellen und berechnete Felder.",fragen:"Zwölf Fragen für die spätere Auswertung.",zusammenfassung:"Stand der Datenbasis und Auswertung.",charts:"Technische Diagramm-Bausteine."};
export const pageConfig: Record<string, {data: "sources" | "understat" | "wikidata" | "weather" | "linked" | "none"; filters: boolean; ghost?: boolean; badge?: string; badgeClass?: string}> = {
 index:{data:"sources",filters:false},spieldaten:{data:"understat",filters:true,ghost:false,badge:"Quelle: Understat",badgeClass:"understat"},stadien:{data:"wikidata",filters:false,badge:"Quelle: Wikidata",badgeClass:"wikidata"},wetter:{data:"weather",filters:false,badge:"Quelle: Open-Meteo",badgeClass:"openmeteo"},verknuepft:{data:"linked",filters:true,badge:"Verknüpft aus mehreren Quellen",badgeClass:"berechnet"},fragen:{data:"none",filters:false},zusammenfassung:{data:"none",filters:false},charts:{data:"linked",filters:true,badge:"Verknüpft aus mehreren Quellen",badgeClass:"berechnet"}
};

export interface Ctx {
  grid: HTMLElement;
  understat?: UnderstatResponse;
  wikidataSource?: WikidataResponse;
  openmeteo?: OpenMeteoResponse;
  understatDataset?: UnderstatDataset;
  meta: MetaResponse;
  dataset: Dataset;
  stadiums: StadiumsResponse["stadiums"];
  leagueName(id: number): string;
  filter(): Filter;
  selection(): Selection;
  onUpdate(fn: (rows: Uint32Array) => void): void;
}
type View = (ctx: Ctx) => void | Promise<void>;
const views: Record<string, () => Promise<{ default: View }>> = {
  index: () => import("../views/home"),
  spieldaten: () => import("../views/understat"),
  stadien: () => import("../views/wikidata"),
  wetter: () => import("../views/openmeteo"),
  verknuepft: () => import("../views/linked"),
  fragen: () => import("../views/questions"),
  zusammenfassung: () => import("../views/summary"),
  charts: () => import("../views/workshop"),
};

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export async function mountPage(page: string) {
  const config = pageConfig[page];
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.className = "app";
  const title = page === "charts" ? "Diagramm-Bausteine" : pages.find((p) => p[0] === page)![1];
  document.title = `${title} · Fußball-Analyse`;

  const skip = el("a", "skip", "Zum Inhalt");
  skip.href = "#inhalt";

  const menubar = el("header", "menubar");
  const brand = el("a", "brand");
  brand.href = "index.html";
  const mark = el("span", "brand-mark");
  mark.setAttribute("aria-hidden", "true");
  brand.append(mark, el("span", "", "Fußball-Analyse"));
  const crumb = el("span", "menubar-crumb", title);
  const stamp = el("span", "menubar-stamp", "Daten werden geladen …");
  const paneToggle = el("button", "pane-toggle", "Filter");
  paneToggle.type = "button";
  paneToggle.setAttribute("aria-controls", "filterbereich");
  paneToggle.setAttribute("aria-expanded", "false");
  menubar.append(brand, crumb, stamp);
  if (config.filters) menubar.append(paneToggle);

  const workspace = el("div", "workspace");
  const main = el("main", "canvas");
  main.id = "inhalt";
  main.tabIndex = -1;
  const head = el("div", "canvas-head");
  head.append(el("h1", "", title), el("p", "intro", intros[page]));
  if (config.badge) head.append(el("span", `source-badge source-${config.badgeClass}`, config.badge));
  if (config.filters) head.append(el("p", "cutoff", "Analysestichtag 31.05.2026 · letzte Saison 2025/26"));
  const grid = el("div", "grid");
  const status = el("div", "skeleton", "Daten werden geladen …");
  status.setAttribute("role", "status");
  grid.append(status);
  main.append(head, grid);

  const pane = el("aside", "pane");
  pane.id = "filterbereich";
  pane.setAttribute("aria-label", "Filterbereich");
  const paneHead = el("div", "pane-head");
  paneHead.append(el("h2", "", "Filter"));
  const paneClose = el("button", "pane-close", "Schließen");
  paneClose.type = "button";
  paneHead.append(paneClose);
  pane.append(paneHead);
  workspace.append(main);
  if (config.filters) workspace.append(pane);
  else workspace.classList.add("without-pane");

  const tabs = el("nav", "pagetabs");
  tabs.setAttribute("aria-label", "Seiten");
  const links: HTMLAnchorElement[] = [brand];
  for (const [id, label] of pages) {
    if (id === "index" || id === "verknuepft") tabs.append(el("span", "tab-group", id === "index" ? "Datenbasis" : "Auswertung"));
    const a = el("a", "pagetab", label);
    a.href = id + ".html";
    if (id === page) a.setAttribute("aria-current", "page");
    tabs.append(a);
    links.push(a);
  }
  const extra = el("a", "pagetab pagetab-minor", "Diagramm-Bausteine");
  extra.href = "charts.html";
  if (page === "charts") extra.setAttribute("aria-current", "page");
  tabs.append(extra);
  links.push(extra);
  for (const a of links) a.href = new URL(a.href).pathname + location.search;
  app.append(skip, menubar, workspace, tabs);

  const setPane = (open: boolean) => {
    document.body.classList.toggle("pane-open", open);
    paneToggle.setAttribute("aria-expanded", String(open));
  };
  paneToggle.addEventListener("click", () => setPane(!document.body.classList.contains("pane-open")));
  paneClose.addEventListener("click", () => setPane(false));

  try {
    let meta = {} as MetaResponse, dataset = {} as Dataset;
    let stadiums: StadiumsResponse | undefined;
    let understat: UnderstatResponse | undefined, wikidataSource: WikidataResponse | undefined, openmeteo: OpenMeteoResponse | undefined, understatDataset: UnderstatDataset | undefined;
    if (config.data === "sources") [understat,wikidataSource,openmeteo] = await Promise.all([getUnderstat(),getWikidata(),getOpenMeteo()]);
    if (config.data === "wikidata") wikidataSource = await getWikidata();
    if (config.data === "weather") openmeteo = await getOpenMeteo();
    if (config.data === "understat") {
      [meta,understat] = await Promise.all([getMeta(),getUnderstat()]);
      understatDataset = decodeUnderstat(understat);
      // Existing chart helpers read only the Understat subset on this page.
      dataset = understatDataset as unknown as Dataset;
    }
    if (config.data === "linked") {
      const [snapshot, places] = await Promise.all([getDatasetSnapshot(), getStadiums()]);
      meta = snapshot.meta; dataset = decodeMatches(snapshot.matches); stadiums = places;
    }
    if (config.filters) { initializeFilters(meta, {ghost: config.ghost}); initializeSelection(dataset.teams); pane.append(filterbar(meta, {ghost:config.ghost}).bar); }
    stamp.textContent = config.filters ? `Datenstand ${date(meta.updated_at)} · Version ${meta.data_version}` : "Datenbasis nach Quellen";

    const cross = el("section", "crossfilter");
    cross.append(el("h3", "", "Kreuzfilter"));
    const chips = el("div", "chips");
    const clear = el("button", "", "Auswahl löschen");
    clear.type = "button";
    clear.addEventListener("click", clearSelection);
    cross.append(chips, el("p", "pane-hint", "Klick in ein Diagramm wählt aus, Strg-Klick ergänzt die Auswahl."), clear);
    const counter = el("section", "counter");
    const countValue = el("strong", "counter-value");
    const countLabel = el("span", "counter-label");
    counter.append(countValue, countLabel);
    const about = el("p", "pane-meta", config.filters ? `Zeitraum ${date(meta.date_min)} – ${date(meta.date_max)}. Quelle: ${understatDataset ? "Understat" : "Understat, Wikidata, Open-Meteo"}.` : "");
    pane.append(counter, cross, about);

    const listeners: ((rows: Uint32Array) => void)[] = [];
    const ctx: Ctx = {
      grid,
      understat, wikidataSource, openmeteo, understatDataset,
      meta,
      dataset,
      stadiums: stadiums?.stadiums ?? [],
      leagueName: (id) => meta.leagues.find((l) => l.id === id)?.name ?? `Liga ${id}`,
      filter: getFilter,
      selection: getSelection,
      onUpdate: (fn) => listeners.push(fn),
    };
    status.remove();
    const view = await views[page]();
    await view.default(ctx);

    const renderChips = (s: Selection) => {
      chips.replaceChildren();
      const chip = (label: string, remove: () => void) => {
        const b = el("button", "chip");
        b.type = "button";
        b.append(el("span", "", label), el("span", "chip-x", "✕"));
        b.setAttribute("aria-label", `${label} aus der Auswahl entfernen`);
        b.addEventListener("click", remove);
        chips.append(b);
      };
      for (const t of s.teams) chip(`Team: ${t}`, () => setSelection({ ...s, teams: s.teams.filter((x) => x !== t) }));
      for (const m of s.months) chip(`Monat: ${MONTHS[m - 1]}`, () => setSelection({ ...s, months: s.months.filter((x) => x !== m) }));
      if (!s.teams.length && !s.months.length) chips.append(el("span", "chips-empty", "Keine Auswahl aktiv."));
      clear.disabled = !s.teams.length && !s.months.length;
    };
    if (!config.filters) { for (const fn of listeners) fn(new Uint32Array()); return; }
    const update = () => {
      const base = understatDataset ? selectUnderstat(understatDataset, getFilter()) : selectRows(dataset, getFilter());
      const rows = applySelection(dataset, base, getSelection());
      countValue.textContent = number(rows.length);
      countLabel.textContent = rows.length === base.length ? "Spiele in der Auswahl" : `von ${number(base.length)} Spielen nach Filter`;
      renderChips(getSelection());
      paneToggle.textContent = `Filter · ${number(rows.length)}`;
      for (const a of links) a.href = new URL(a.href).pathname + location.search;
      for (const fn of listeners) fn(rows);
    };
    update();
    subscribe(update);
    subscribeSelection(update);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    if (!status.isConnected) grid.prepend(status);
    status.className = "error";
    status.setAttribute("role", "alert");
    status.textContent = error instanceof Error ? error.message : "Die Daten konnten nicht geladen werden.";
    stamp.textContent = "Datenstand nicht verfügbar";
  }
}
