import { figure } from "./figure";
import { groupMean, histogram } from "./aggregate";
import type { Dataset } from "../data/dataset";
import type { MetaResponse } from "../api/types";
export function renderWorkshop(root: HTMLElement, d: Dataset, rows: Uint32Array, meta: MetaResponse) {
  const c = d.columns;
  const name = (id: number) => meta.leagues.find(l => l.id === id)?.name ?? String(id);
  const leagueCounts = groupMean(rows, i => String(c.league[i]), () => 1).sort((a, b) => Number(a.key) - Number(b.key));
  const seasons = groupMean(rows, i => String(c.season[i]), () => 1).sort((a, b) => Number(a.key) - Number(b.key));
  const temp = histogram(Array.from(rows, i => c.w_temp[i]), [-20, -10, 0, 10, 20, 30, 40, 50]);
  const source = `Echte Daten aus /api/matches · ${rows.length.toLocaleString("de-DE")} gefilterte Spiele. Baustein-Vorschau, keine Beantwortung der Forschungsfragen.`;
  root.replaceChildren(
    figure({ title: "Balken · Spiele je Liga", description: "Prüfansicht für Kategorien und absoluten Umfang.", kind: "bar", xLabel: "Liga", yLabel: "Anzahl Spiele", points: leagueCounts.map((g, i) => ({ label: name(Number(g.key)), x: i, y: g.n, n: g.n })), note: source }),
    figure({ title: "Linie · Spiele je Saison", description: "Prüfansicht für geordnete Zeitpunkte und Tastaturnavigation.", kind: "line", xLabel: "Startjahr der Saison", yLabel: "Anzahl Spiele", points: seasons.map(g => ({ label: `${g.key}/${String(Number(g.key) + 1).slice(-2)}`, x: Number(g.key), y: g.n, n: g.n })), note: source }),
    figure({ title: "Histogramm · Verfügbare Temperaturwerte", description: "Klassen sind links geschlossen und rechts offen; die letzte Klasse enthält ihre Obergrenze.", kind: "bar", xLabel: "Temperaturklasse in °C", yLabel: "Anzahl Spiele", points: temp.bins.map((b, i) => ({ label: `${b.from}…${b.to}`, x: i, y: b.n, n: b.n })), note: `${source} Fehlend: ${temp.missing}; außerhalb der Grenzen: ${temp.outside}.` }),
  );
}
