import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/jetbrains-mono/400.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { getMeta, getMatches } from "../api/client";
import { decodeMatches, selectRows, summarize } from "../data/dataset";
import {
  initializeFilters,
  getFilter,
  subscribe,
  serializeFilter,
} from "../state/filters";
import { sections, questions } from "../content/sections";
import { placeholder } from "./placeholder";
import { filterbar } from "./filterbar";
import { date, number, percent } from "./format";
const pages = [
  ["index", "Start"],
  ["daten", "Daten"],
  ["wetter-geo", "Wetter & Geodaten"],
  ["zeitverlauf", "Zeitverlauf"],
  ["zusammenfassung", "Zusammenfassung"],
];
const intros: Record<string, string> = {
  index:
    "Diese Seite untersucht die Spiele der fünf großen europäischen Ligen seit 2014/15 mit zwölf Fragen: Acht betreffen den Einfluss von Wetter und Geografie auf Tore und Ergebnisse, vier die Entwicklung der Spielstatistiken über die Zeit.",
  daten:
    "Drei Datenquellen bilden die Grundlage der Analyse: Spielstatistiken, Stadion- und Geodaten sowie historisches Wetter. Hier wird ihre Zusammenführung dokumentiert.",
  "wetter-geo":
    "Acht Fragen untersuchen den Zusammenhang von Wetter, Geografie und Spielergebnissen. Die Geisterspiele ergänzen den Vergleich um den Einfluss der Zuschauer.",
  zeitverlauf:
    "Vier Fragen betrachten die Entwicklung von Heimvorteil, Toren, Pressing und Chancenqualität über die Saisons.",
  zusammenfassung:
    "Alle zwölf Fragen im Überblick. Die Ergebnisse folgen mit den Auswertungen.",
};
export async function mountPage(page: string) {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const header = document.createElement("header");
  header.className = "site-header";
  const inner = document.createElement("div");
  inner.className = "container header-inner";
  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = "index.html";
  brand.textContent = "Fußball, Wetter & Geodaten";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Hauptnavigation");
  for (const [id, label] of pages) {
    const a = document.createElement("a");
    a.href = id + ".html";
    a.dataset.page = id;
    a.textContent = label;
    if (id === page) a.setAttribute("aria-current", "page");
    nav.append(a);
  }
  inner.append(brand, nav);
  header.append(inner);
  const main = document.createElement("main");
  main.id = "inhalt";
  main.className = "container";
  const h = document.createElement("h1");
  h.textContent = pages.find((p) => p[0] === page)![1];
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent = intros[page];
  main.append(h, intro);
  const status = document.createElement("div");
  status.className = "skeleton";
  status.setAttribute("role", "status");
  status.textContent = "Daten werden geladen …";
  main.append(status);
  const skip = document.createElement("a");
  skip.className = "skip";
  skip.href = "#inhalt";
  skip.textContent = "Zum Inhalt";
  const footer = document.createElement("footer");
  footer.className = "container";
  footer.textContent = "Stand der Daten wird geladen …";
  app.append(skip, header, main, footer);
  let figures: HTMLElement | undefined;
  if (page === "index") {
    figures = document.createElement("div");
    figures.className = "metrics";
    figures.setAttribute("aria-live", "polite");
    main.append(figures);
  }
  for (const s of sections.filter((s) => s.page === page))
    main.append(placeholder(s));
  const queryLinks: HTMLAnchorElement[] = [
    brand,
    ...Array.from(nav.querySelectorAll("a")),
  ];
  if (page === "index") {
    const cards = document.createElement("div");
    cards.className = "link-cards";
    for (const id of ["wetter-geo", "zeitverlauf"]) {
      const card = document.createElement("section");
      card.className = "card";
      const title = document.createElement("h2");
      const link = document.createElement("a");
      link.href = id + ".html";
      link.textContent = pages.find((p) => p[0] === id)![1];
      queryLinks.push(link);
      title.append(link);
      card.append(title);
      const list = document.createElement("ul");
      for (const q of questions.filter((q) => q.page === id)) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = id + ".html#" + q.id;
        a.textContent = q.id.toUpperCase() + " · " + q.title;
        queryLinks.push(a);
        li.append(a);
        list.append(li);
      }
      card.append(list);
      cards.append(card);
    }
    main.append(cards);
  }
  if (page === "zusammenfassung") {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.innerHTML =
      '<caption>Zwölf Fragen und ihre Ergebnisse</caption><thead><tr><th scope="col">Nummer</th><th scope="col">Frage</th><th scope="col">Ergebnis</th></tr></thead>';
    const body = document.createElement("tbody");
    for (const q of questions) {
      const tr = document.createElement("tr");
      const num = document.createElement("th");
      num.scope = "row";
      num.textContent = q.id.toUpperCase();
      const td = document.createElement("td");
      const a = document.createElement("a");
      a.href = q.page + ".html#" + q.id;
      a.textContent = q.title;
      queryLinks.push(a);
      td.append(a);
      const result = document.createElement("td");
      result.textContent = "folgt";
      tr.append(num, td, result);
      body.append(tr);
    }
    table.append(body);
    wrap.append(table);
    main.append(wrap);
  }
  try {
    const meta = await getMeta();
    initializeFilters(meta);
    const controls = filterbar(meta);
    header.after(controls.bar);
    footer.textContent = `Stand der Daten: ${date(meta.updated_at)} · ${number(meta.n_matches)} Spiele · Datenversion ${meta.data_version}`;
    const updateLinks = () => {
      const query = serializeFilter(getFilter(), meta);
      for (const a of queryLinks) {
        const url = new URL(a.href);
        a.href = url.pathname + query + url.hash;
      }
    };
    updateLinks();
    subscribe(updateLinks);
    const dataset = decodeMatches(await getMatches());
    status.remove();
    const update = () => {
      const stats = summarize(dataset, selectRows(dataset, getFilter()));
      controls.count.textContent = number(stats.n) + " Spiele";
      if (figures) {
        figures.replaceChildren();
        for (const [label, value] of [
          ["Spiele", number(stats.n)],
          ["Heimsiege", percent(stats.homeWinPct)],
          ["Remis", percent(stats.drawPct)],
          ["Auswärtssiege", percent(stats.awayWinPct)],
          ["Tore pro Spiel", number(stats.goalsPerMatch, 2)],
        ]) {
          const card = document.createElement("div");
          card.className = "metric";
          const l = document.createElement("span");
          l.className = "label";
          l.textContent = label;
          const v = document.createElement("strong");
          v.textContent = value;
          card.append(l, v);
          figures.append(card);
        }
      }
    };
    update();
    subscribe(update);
  } catch (error) {
    status.className = "error";
    status.setAttribute("role", "alert");
    status.textContent =
      error instanceof Error
        ? error.message
        : "Die Daten konnten nicht geladen werden.";
    if (footer.textContent === "Stand der Daten wird geladen …")
      footer.textContent = "Stand der Daten nicht verfügbar.";
    const count = document.querySelector("output");
    if (count) count.textContent = "Spielzahl nicht verfügbar";
  }
}
