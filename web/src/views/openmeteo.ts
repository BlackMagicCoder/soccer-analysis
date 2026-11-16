import { fmt } from "../charts/ec";
import { el, type Ctx } from "../ui/layout";
import { kpi, tile } from "../ui/tile";
import { sourceTable } from "../ui/source-table";
import { originTile } from "../ui/origin";
import { decodeOpenMeteo, weatherColumnKeys } from "../data/sources";
import { bins } from "../data/explore";
import { base } from "../charts/ec";
export const weatherTableKeys = weatherColumnKeys;
export default function openmeteo(ctx: Ctx) {
    const r = ctx.openmeteo!, rows = decodeOpenMeteo(r), complete = rows.filter(x => [x.w_temp, x.w_wind, x.w_precip_2h].every(Number.isFinite)).length;
    const band = el("div", "kpis span-full");
    const times = rows.map(x => x.time).sort();
    for (const [label, value] of [["Abfragen", fmt(r.n)], ["Vollständige Abfragen", fmt(complete)], ["Ohne Wert", fmt(r.n - complete)], ["Zeitraum", times.length ? `${times[0].slice(0, 4)}–${times.at(-1)!.slice(0, 4)}` : "—"]]) {
        const k = kpi(label);
        k.set(value, label === "Zeitraum" && times.length ? `${times[0].slice(0, 10)} bis ${times.at(-1)!.slice(0, 10)} (UTC)` : "");
        band.append(k.el);
    }
    ctx.grid.append(originTile("open-meteo"), band);
    const t = tile({ title: "So entstehen die Werte", span: "two-thirds", source: "open-meteo", describe: { field: "query", view: "Abfrageparameter" } });
    const dl = el("dl");
    for (const [k, v] of [["Endpunkt", r.query.endpoint], ["Modell", r.query.model], ["Variablen", Object.entries(r.query.variables).map(([k, v]) => `${k}: ${v}`).join("; ")], ["Zeitzone", r.query.timezone], ["Verzögerung", `${r.query.delay_days} Tage`]])
        dl.append(el("dt", "", k), el("dd", "", v));
    t.body.append(dl, el("p", "", "Jede Abfrage nutzt Ort (Koordinaten des Heimstadions) und Zeitpunkt (Anstoß, volle UTC-Stunde) als Parameter. Teams und Ergebnisse sind nicht enthalten."));
    const a = el("a", "", "Verknüpfte Daten");
    a.href = "verknuepft.html";
    const note = el("p", "", "Die Temperaturdifferenz zum Gastort ist berechnet und steht unter ");
    note.append(a);
    t.body.append(note);
    const example = tile({ title: "Beispiel einer Rohantwort", span: "third", source: "open-meteo", describe: { field: "example", view: "JSON" } });
    example.body.append(el("pre", "raw-response", r.example ? JSON.stringify(r.example, null, 2) : "Keine Rohantwort verfügbar."));
    ctx.grid.append(t.el, example.el);
    for (const spec of [{ key: "w_temp", title: "Temperatur (°C)", from: -10, to: 40, width: 2 }, { key: "w_wind", title: "Wind (km/h)", from: 0, to: 60, width: 3 }, { key: "w_precip_2h", title: "Niederschlag in zwei Stunden (mm)", from: 0, to: 10, width: .5 }] as const) {
        const h = tile({ title: spec.title, span: "third", chartHeight: 260, source: "open-meteo", describe: { field: spec.key, view: "Histogramm" } });
        ctx.grid.append(h.el);
        const b = bins(rows.map(x => x[spec.key]), spec.from, spec.to, spec.width);
        const labels = b.bins.map((v, i) => i === 0 ? `< ${v.to}` : i === b.bins.length - 1 ? `≥ ${v.from}` : `${v.from}–${v.to}`);
        h.chart!.setOption(base({ grid: { bottom: 65 }, tooltip: { trigger: "axis" }, dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 5 }], xAxis: { type: "category", data: labels }, yAxis: { type: "value" }, series: [{ type: "bar", name: "Abfragen", data: b.bins.map(v => v.n) }] }));
        h.setTable(() => ({ headers: ["Klasse", "Abfragen"], rows: b.bins.map((v, i) => [labels[i], v.n]) }));
        h.setFooter(`Offene Randklassen · ${b.missing} Abfragen ohne Wert`);
        ctx.grid.append(h.el);
    }
    const table = sourceTable({ title: "Wetterabfragen", span: "full", source: "open-meteo", describe: { field: weatherTableKeys.join(", "), view: "Tabelle" } }, ["Zeit (UTC)", "Breite", "Länge", "Temperatur (°C)", "Wind (km/h)", "Niederschlag (mm)"], () => rows.map(x => weatherTableKeys.map(k => typeof x[k] === "number" && !Number.isFinite(x[k]) ? null : x[k])));
    ctx.grid.append(table.el);
}
