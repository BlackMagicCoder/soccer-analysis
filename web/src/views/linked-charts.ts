import { base, fmt, pitch } from "../charts/ec";
import { bins, MONTHS, SEASON_MONTHS, monthOf, share } from "../data/explore";
import type { NumericColumn } from "../api/types";
import type { Ctx } from "../ui/layout";
import { tile as rawTile, type TileOptions } from "../ui/tile";
import { bindMonthClick, bindTeamClick, stadiumMap } from "./common";

interface Spec { key: NumericColumn; title: string; unit: string; from: number; to: number; width: number; digits: number; source: string }
const specs: Spec[] = [
  { key: "travel_km", title: "Reisedistanz (km)", unit: "km", from: 0, to: 2500, width: 100, digits: 0, source: "berechnet aus Wikidata-Koordinaten (Luftlinie)" },
  { key: "w_temp_diff_away", title: "Temperaturdifferenz (°C)", unit: "°C", from: -20, to: 20, width: 2, digits: 0, source: "Datei, Rechenweg ungeklärt; 28 dort fehlende Werte nachträglich berechnet" },
];

const tile = (o: TileOptions) => rawTile({...o,source:"verknuepft",describe:{field:o.filename ?? (o.title.includes("Monat") ? "date, w_temp" : o.title.includes("Niederschlag") ? "w_precip_2h, Filter" : "team, lat, lon, home_team"),view:o.chartHeight ? "Diagramm" : "Text"}});
export default function weather(ctx: Ctx) {
  const c = ctx.dataset.columns;
  const map = tile({ title: "Stadien und Heimspiele", span: "two-thirds", chartHeight: 460, hint: "Ziehen/Scrollen: Karte bewegen · Klick: Team" });
  const months = tile({ title: "Mittlere Temperatur je Kalendermonat", span: "third", chartHeight: 200, hint: "Klick: Monat" });
  const share0 = tile({ title: "Spiele mit Niederschlag", span: "third", chartHeight: 200 });
  const hist = specs.map((s) => ({ s, t: tile({ title: s.title, span: s.key === "w_temp_diff_away" ? "two-thirds" : "third", chartHeight: 220, filename: s.key }) }));
  const note = tile({ title: "Hinweis zur Darstellung", span: "third" });
  note.body.append(Object.assign(document.createElement("p"), {
    textContent: "Die Verteilungen zeigen jeweils eine Variable. Wetter- und Distanzklassen sind bewusst nicht als Filter anklickbar: Zusammenhänge mit Toren oder Ergebnissen gehören zur Auswertung ab 15.12.2026. Ränder sind offen: Werte unter- oder oberhalb der Achse zählen zur ersten bzw. letzten Klasse.",
  }));
  ctx.grid.append(map.el, months.el, share0.el, ...hist.map((h) => h.t.el), note.el);
  bindTeamClick(map.chart!);
  bindMonthClick(months.chart!);

  ctx.onUpdate((rows) => {
    const t = stadiumMap(ctx, map.chart!, rows, 1.3);
    map.setTable(() => t);

    const sum = new Map<number, { s: number; n: number }>();
    let wet = 0, known = 0;
    for (const i of rows) {
      const v = c.w_temp[i];
      if (Number.isFinite(v)) {
        const m = monthOf(c.date[i]);
        const g = sum.get(m) ?? { s: 0, n: 0 };
        g.s += v; g.n++; sum.set(m, g);
      }
      if (Number.isFinite(c.w_precip_2h[i])) { known++; if (c.w_precip_2h[i] > 0.1) wet++; }
    }
    const sel = new Set(ctx.selection().months);
    const ms = SEASON_MONTHS.filter((m) => sum.has(m));
    months.chart!.setOption(base({
      grid: { left: 40, right: 12, top: 16, bottom: 28 },
      xAxis: { type: "category", data: ms.map((m) => MONTHS[m - 1]) },
      yAxis: { type: "value", axisLabel: { formatter: "{value} °" } },
      series: [{
        type: "line", name: "Mittel °C", symbolSize: 8, color: pitch,
        data: ms.map((m) => ({ value: Number((sum.get(m)!.s / sum.get(m)!.n).toFixed(1)), month: m, itemStyle: { color: sel.has(m) ? "#d99a1c" : pitch } })),
      }],
    }), true);
    months.setTable(() => ({ headers: ["Monat", "Mittlere Temperatur °C", "Spiele mit Wert"], rows: ms.map((m) => [MONTHS[m - 1], Number((sum.get(m)!.s / sum.get(m)!.n).toFixed(1)), sum.get(m)!.n]) }));

    share0.chart!.setOption(base({
      tooltip: { trigger: "item", formatter: (p: { name: string; value: number }) => `${p.name}: <b>${fmt(p.value)}</b> Spiele (${fmt(share(p.value, known), 1)} %)` },
      grid: { left: 112, right: 56, top: 16, bottom: 20 },
      xAxis: { type: "value", show: false },
      yAxis: { type: "category", data: ["trocken (≤ 0,1 mm)", "Niederschlag"] },
      series: [{
        type: "bar", barWidth: "50%",
        label: { show: true, position: "right", fontFamily: "IBM Plex Mono", fontSize: 11, formatter: (p: { value: number }) => fmt(share(p.value, known), 1) + " %" },
        data: [{ value: known - wet, itemStyle: { color: "#9fb3a5" } }, { value: wet, itemStyle: { color: "#3d5f95" } }],
      }],
    }), true);
    share0.setTable(() => ({ headers: ["Klasse", "Spiele"], rows: [["trocken (≤ 0,1 mm)", known - wet], ["Niederschlag (> 0,1 mm)", wet]] }));

    for (const { s, t: h } of hist) {
      const b = bins(Array.from(rows, (i) => c[s.key][i]), s.from, s.to, s.width);
      const labels = b.bins.map((x) => `${fmt(x.from, s.digits)}–${fmt(x.to, s.digits)}`);
      const total = rows.length - b.missing;
      h.chart!.setOption(base({
        grid: { left: 48, right: 12, top: 16, bottom: 52 },
        tooltip: {
          trigger: "axis",
          formatter: (ps: { dataIndex: number; value: number }[]) => {
            const p = ps[0];
            return `${labels[p.dataIndex]} ${s.unit}<br><b>${fmt(p.value)}</b> Spiele · ${fmt(share(p.value, total), 1)} %`;
          },
        },
        dataZoom: [{ type: "inside" }, { type: "slider", height: 14, bottom: 6, borderColor: "#c5ccbf", fillerColor: "rgba(35,112,74,.15)", handleSize: 12, showDetail: false }],
        xAxis: { type: "category", data: labels, name: s.unit, nameLocation: "end", nameGap: 4, axisLabel: { interval: "auto", hideOverlap: true } },
        yAxis: { type: "value" },
        series: [{ type: "bar", name: "Spiele", barCategoryGap: "8%", color: s.key === "w_temp_diff_away" ? "#8a8f6a" : pitch, data: b.bins.map((x) => x.n) }],
      }), true);
      h.setTable(() => ({ headers: [`Klasse (${s.unit})`, "Spiele"], rows: b.bins.map((x, k) => [labels[k], x.n]) }));
      h.setFooter(`${s.source} · ${fmt(b.missing)} Spiele ohne Wert`);
    }
  });
}
