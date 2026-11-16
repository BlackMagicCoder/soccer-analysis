import { el } from "./layout";
import { renderTable, tile } from "./tile";

/** Die Datei, aus der der gesamte Bestand stammt (dieselbe, die das Jupyter-Notebook lädt). */
export const SEED_FILE = "Match_statistics_enriched.parquet";
/** Datum der letzten Prüfung, ob Understat selbst Spieldaten liefert. */
export const UNDERSTAT_CHECKED = "16.11.2026";

type Source = "understat" | "wikidata" | "open-meteo";

const origin: Record<Source, { title: string; file: string; fetched: string; open: string }> = {
  understat: {
    title: "Woher die Spieldaten kommen",
    file: `Alle Werte auf dieser Seite stammen aus der Datei ${SEED_FILE}. Sie fasst zwölf Saisondateien zusammen („Football stats 2014_2015.parquet“ bis „Football stats 2025_2026.parquet“), deren Inhalt von Understat stammt.`,
    fetched: `Nichts. Der Abruf bei Understat funktioniert nicht: understat.com liefert statt der Spieldaten eine Fehlerseite (zuletzt geprüft am ${UNDERSTAT_CHECKED}). Kein Wert auf dieser Seite wurde von uns selbst bei Understat abgerufen.`,
    open: "Auf welchem Weg die Saisondateien ursprünglich bei Understat heruntergeladen wurden, ist nicht dokumentiert. Die Werte lassen sich deshalb derzeit nicht gegen die Quelle prüfen.",
  },
  wikidata: {
    title: "Woher die Stadiondaten kommen",
    file: `Stadion, Ort und Koordinaten je Team stammen aus der Datei ${SEED_FILE}.`,
    fetched: "Nur zum Abgleich: Am 13.11.2026 wurden alle 168 Teams bei Wikidata abgefragt. Breite und Länge stimmen bei jedem Stadion exakt mit Wikidata überein (Eigenschaft P625). Kein Wert der Datei wurde geändert; neu ist allein die Wikidata-ID je Team.",
    open: "Die Datei selbst nennt keinen Anbieter. Die Ortsangabe passt nur bei 125 von 168 Teams zum heutigen Wikidata-Stand.",
  },
  "open-meteo": {
    title: "Woher die Wetterdaten kommen",
    file: `Temperatur, Wind und Niederschlag aller Spiele stammen aus der Datei ${SEED_FILE}.`,
    fetched: "Nur zum Abgleich: Eine Stichprobe vom 13.11.2026 stimmt exakt mit Open-Meteo überein (Temperatur und Wind 8 von 8, Niederschlag 10 von 10). Kein Wert auf dieser Seite weicht von der Datei ab. Für 28 Spiele wurde zusätzlich die Temperatur am Gastort abgerufen, um eine in der Datei fehlende Temperaturdifferenz zu berechnen; sie steht unter Verknüpfte Daten.",
    open: "Die Datei selbst nennt Open-Meteo nur als wahrscheinlichen Anbieter. Geprüft ist die Stichprobe, nicht jeder einzelne Wert.",
  },
};

/** Herkunftskasten am Anfang einer Quellenseite. */
export function originTile(source: Source) {
  const o = origin[source];
  const t = tile({ title: o.title, span: "full", source, describe: { field: "alle Felder dieser Seite", view: "Herkunftshinweis" } });
  t.el.classList.add("derived-box", "origin-box");
  const dl = el("dl");
  dl.append(
    el("dt", "", "Aus der Datei"), el("dd", "", o.file),
    el("dt", "", "Von uns selbst abgerufen"), el("dd", "", o.fetched),
    el("dt", "", "Nicht geklärt"), el("dd", "", o.open),
  );
  t.body.append(dl);
  return t.el;
}

/** Gesamtübersicht für die Startseite: was aus der Datei kommt und was nicht. */
export function originOverview(matches: string) {
  const t = tile({ title: "Woher die Daten kommen", span: "full", filename: "datenherkunft" });
  t.el.classList.add("origin-box");
  const data = {
    headers: ["Daten", "Ursprüngliche Quelle", "Aus der Datei", "Von uns selbst abgerufen"],
    rows: [
      ["Spieldaten (Tore, xG, xPTS, PPDA, Deep Completions)", "Understat", "alle Werte", `nichts – der Abruf bei Understat liefert eine Fehlerseite (geprüft am ${UNDERSTAT_CHECKED})`],
      ["Stadion, Ort, Koordinaten", "Wikidata (per Abgleich belegt)", "alle Werte", "nur die Wikidata-ID je Team als Nachweis"],
      ["Temperatur, Wind, Niederschlag", "Open-Meteo (per Stichprobe belegt)", "alle Werte", "nur eine Stichprobe zum Abgleich"],
      ["Reisedistanz, Derby", "berechnet aus den Koordinaten", "alle Werte, exakt nachrechenbar", "nichts"],
      ["Temperaturdifferenz zum Gastort", "berechnet, Rechenweg der Datei ungeklärt", "21.561 Werte", "28 in der Datei fehlende Werte, aus Open-Meteo berechnet"],
    ],
  };
  t.body.append(
    el("p", "", `Alle Daten dieser Webseite stammen aus einer einzigen Datei: ${SEED_FILE} (${matches} Spiele, 41 Spalten). Es ist dieselbe Datei, die das Jupyter-Notebook lädt. Die Webseite liest sie über eine lokale Datenbank; gegenüber der Datei sind nur 28 Temperaturdifferenzen neu.`),
    renderTable(data),
    el("p", "muted", "Understat, Wikidata und Open-Meteo sind die ursprünglichen Quellen der Werte in der Datei. Live abgerufen wird von dort für die Anzeige nichts."),
  );
  t.setTable(() => data);
  return t.el;
}
