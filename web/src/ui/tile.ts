import { csv } from "../charts/aggregate";
import { mountChart, type ECharts } from "../charts/ec";

export type Span = "full" | "two-thirds" | "half" | "third" | "quarter";
export interface TableData {
  headers: string[];
  rows: (string | number | null)[][];
}
export interface TileOptions {
  source?: "understat" | "wikidata" | "open-meteo" | "verknuepft";
  describe?: { field: string; view: string };
  title: string;
  span?: Span;
  /** Höhe der Diagrammfläche in px; ohne Angabe ist die Kachel eine reine Inhaltskachel. */
  chartHeight?: number;
  filename?: string;
  hint?: string;
}
export interface Tile {
  el: HTMLElement;
  body: HTMLElement;
  chart?: ECharts;
  setTable(data: () => TableData): void;
  setFooter(text: string): void;
}

export function download(content: string, type: string, name: string) {
  const url = content.startsWith("data:") ? content : URL.createObjectURL(new Blob(["﻿" + content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  if (!content.startsWith("data:")) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderTable(data: TableData, caption?: string) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const t = document.createElement("table");
  if (caption) t.createCaption().textContent = caption;
  const tr = t.createTHead().insertRow();
  for (const h of data.headers) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    tr.append(th);
  }
  const body = t.createTBody();
  for (const r of data.rows) {
    const row = body.insertRow();
    for (const v of r) {
      const td = row.insertCell();
      td.textContent = v === null ? "—" : typeof v === "number" ? v.toLocaleString("de-DE", { maximumFractionDigits: 2 }) : v;
      if (typeof v === "number") td.className = "num";
    }
  }
  wrap.append(t);
  return wrap;
}

let openMenu: HTMLElement | undefined;
document.addEventListener("click", (e) => {
  if (openMenu && !openMenu.parentElement!.contains(e.target as Node)) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (openMenu) closeMenu();
  else document.querySelector(".tile.is-focus")?.querySelector<HTMLButtonElement>("[data-action=focus]")?.click();
});
function closeMenu() {
  openMenu?.setAttribute("hidden", "");
  openMenu?.previousElementSibling?.setAttribute("aria-expanded", "false");
  openMenu = undefined;
}

export function tile(o: TileOptions): Tile {
  const el = document.createElement("section");
  el.className = `tile span-${o.span ?? "half"}`;
  const head = document.createElement("header");
  head.className = "tile-head";
  const h = document.createElement("h2");
  h.textContent = o.title;
  head.append(h);
  const names = {understat:"Understat",wikidata:"Wikidata","open-meteo":"Open-Meteo",verknuepft:"verknüpft"};
  const sourceName = o.source ? names[o.source] : "";
  const provenance = o.source ? `Quelle: ${sourceName} · Feld: ${o.describe?.field ?? "Bestand"} · Darstellung: ${o.describe?.view ?? o.title}` : "";
  if (o.source) { const badge = document.createElement("span"); badge.className = `source-badge source-${o.source === "verknuepft" ? "berechnet" : o.source.replace("-", "")}`; badge.textContent = sourceName; head.append(badge); }
  if (o.hint) {
    const hint = document.createElement("span");
    hint.className = "tile-hint";
    hint.textContent = o.hint;
    head.append(hint);
  }
  const body = document.createElement("div");
  body.className = "tile-body";
  const footer = document.createElement("p");
  footer.className = "tile-foot";
  footer.textContent = provenance;
  footer.hidden = !provenance;
  el.append(head, body, footer);

  let chartEl: HTMLDivElement | undefined, chart: ECharts | undefined;
  if (o.chartHeight) {
    chartEl = document.createElement("div");
    chartEl.className = "tile-chart";
    chartEl.style.height = o.chartHeight + "px";
    body.append(chartEl);
    chart = mountChart(chartEl);
  }
  let tableFn: (() => TableData) | undefined;
  const tableView = document.createElement("div");
  tableView.className = "tile-table";
  tableView.hidden = true;
  body.append(tableView);

  const menuWrap = document.createElement("div");
  menuWrap.className = "tile-menu";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "tile-menu-button";
  trigger.setAttribute("aria-label", `Optionen für „${o.title}“`);
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.textContent = "⋯";
  const menu = document.createElement("div");
  menu.className = "tile-menu-list";
  menu.hidden = true;
  const item = (label: string, action: () => void, key?: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (key) b.dataset.action = key;
    b.addEventListener("click", () => { action(); closeMenu(); });
    menu.append(b);
    return b;
  };
  const file = o.filename ?? o.title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-");
  let showTable: HTMLButtonElement | undefined;
  if (chart) {
    showTable = item("Daten als Tabelle anzeigen", () => {
      const on = tableView.hidden;
      tableView.hidden = !on;
      chartEl!.hidden = on;
      if (on && tableFn) tableView.replaceChildren(renderTable(tableFn()));
      showTable!.textContent = on ? "Diagramm anzeigen" : "Daten als Tabelle anzeigen";
      if (!on) chart!.resize();
    });
  }
  const focusBtn = item("Fokusmodus", () => {
    const on = el.classList.toggle("is-focus");
    document.body.classList.toggle("has-focus", on);
    focusBtn.textContent = on ? "Fokusmodus beenden" : "Fokusmodus";
    requestAnimationFrame(() => chart?.resize());
  }, "focus");
  const csvBtn = item("Als CSV exportieren", () => {
    if (!tableFn) return;
    const d = tableFn();
    download(csv([d.headers, ...d.rows]), "text/csv;charset=utf-8", file + ".csv");
  });
  csvBtn.hidden = true;
  if (chart)
    item("Als PNG exportieren", () =>
      download(chart!.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fcfcf8" }), "image/png", file + ".png"),
    );
  trigger.addEventListener("click", () => {
    const willOpen = menu.hidden;
    closeMenu();
    if (willOpen) {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      openMenu = menu;
      menu.querySelector("button")?.focus();
    }
  });
  menuWrap.append(trigger, menu);
  head.append(menuWrap);

  return {
    el,
    body,
    chart,
    setTable(fn) {
      tableFn = fn;
      csvBtn.hidden = false;
      if (!tableView.hidden) tableView.replaceChildren(renderTable(fn()));
    },
    setFooter(text) {
      footer.textContent = [provenance, text].filter(Boolean).join(" · ");
      footer.hidden = !footer.textContent;
    },
  };
}

export function kpi(label: string) {
  const el = document.createElement("div");
  el.className = "kpi";
  const l = document.createElement("span");
  l.className = "kpi-label";
  l.textContent = label;
  const v = document.createElement("strong");
  v.className = "kpi-value";
  const sub = document.createElement("span");
  sub.className = "kpi-sub";
  el.append(l, v, sub);
  return {
    el,
    set(value: string, note = "") {
      v.textContent = value;
      sub.textContent = note;
    },
  };
}
