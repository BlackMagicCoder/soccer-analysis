import { base, fmt, leagueColors, pitch } from "../charts/ec";
import { countBy, WEEKDAYS } from "../data/explore";
import type { Ctx } from "../ui/layout";
import { tile as rawTile, type TileOptions } from "../ui/tile";


const tile = (o: TileOptions) => rawTile({...o,source:"understat",describe:{field:"date, season, league",view:"Balkendiagramm"}});
export default function timeline(ctx: Ctx) {
  const c = ctx.dataset.columns;
  const series = tile({ title: "Spiele je Monat im Zeitverlauf", span: "full", chartHeight: 320, hint: "Zeitraum mit dem Regler unten eingrenzen" });
  const hours = tile({ title: "Anstoßzeit (UTC)", span: "half", chartHeight: 220 });
  const days = tile({ title: "Wochentag", span: "half", chartHeight: 220 });
  ctx.grid.append(series.el, hours.el, days.el);

  ctx.onUpdate((rows) => {
    const ym = (ts: number) => new Date(ts).toISOString().slice(0, 7);
    const keys = [...new Set(Array.from(rows, (i) => ym(c.date[i])))].sort();
    const by = countBy(rows, (i) => ym(c.date[i]) + "|" + c.league[i]);
    const leagues = ctx.meta.leagues.filter((l) => ctx.filter().leagues.includes(l.id));
    series.chart!.setOption(base({
      legend: { top: 0, right: 0 },
      grid: { left: 52, right: 16, top: 34, bottom: 64 },
      xAxis: { type: "category", data: keys.map((k) => `${k.slice(5)}/${k.slice(2, 4)}`) },
      yAxis: { type: "value" },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 10, borderColor: "#c5ccbf", fillerColor: "rgba(35,112,74,.15)" }],
      series: leagues.map((l) => ({ type: "bar", stack: "m", name: l.name, color: leagueColors[l.id], barCategoryGap: "15%", data: keys.map((k) => by.get(k + "|" + l.id) ?? 0) })),
    }), true);
    series.setTable(() => ({ headers: ["Monat", ...leagues.map((l) => l.name)], rows: keys.map((k) => [k, ...leagues.map((l) => by.get(k + "|" + l.id) ?? 0)]) }));
    series.setFooter("Lücken im Sommer und im Frühjahr 2020 (Unterbrechung der Spielzeit) sind im Bestand so enthalten.");


    const h = countBy(rows, (i) => new Date(c.date[i]).getUTCHours());
    const hs = Array.from({ length: 24 }, (_, k) => k).filter((k) => h.has(k));
    hours.chart!.setOption(base({
      grid: { left: 48, right: 12, top: 16, bottom: 28 },
      xAxis: { type: "category", data: hs.map((k) => `${String(k).padStart(2, "0")}:00`) },
      yAxis: { type: "value" },
      series: [{ type: "bar", name: "Spiele", color: pitch, data: hs.map((k) => h.get(k) ?? 0) }],
    }), true);
    hours.setTable(() => ({ headers: ["Stunde (UTC)", "Spiele"], rows: hs.map((k) => [`${k}:00`, h.get(k) ?? 0]) }));
    hours.setFooter("Anstoßzeiten aus Understat, als UTC interpretiert (siehe docs/quellen.md).");

    const d = countBy(rows, (i) => (new Date(c.date[i]).getUTCDay() + 6) % 7);
    days.chart!.setOption(base({
      grid: { left: 48, right: 12, top: 16, bottom: 28 },
      tooltip: { trigger: "axis", formatter: (ps: { name: string; value: number }[]) => `${ps[0].name}: <b>${fmt(ps[0].value)}</b> Spiele` },
      xAxis: { type: "category", data: WEEKDAYS },
      yAxis: { type: "value" },
      series: [{ type: "bar", name: "Spiele", color: "#3f5a4b", data: WEEKDAYS.map((_, k) => d.get(k) ?? 0) }],
    }), true);
    days.setTable(() => ({ headers: ["Wochentag", "Spiele"], rows: WEEKDAYS.map((w, k) => [w, d.get(k) ?? 0]) }));
  });
}
