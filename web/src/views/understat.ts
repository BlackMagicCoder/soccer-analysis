import type { Ctx } from "../ui/layout";
import overview from "./understat-charts";
import timeline from "./understat-time";
import explorer from "../ui/match-explorer";
import { matchColumns } from "../ui/match-columns";
export { understatTableKeys } from "../ui/match-columns";
import { tile } from "../ui/tile";
import { originTile } from "../ui/origin";
import { bins } from "../data/explore";
import { base } from "../charts/ec";
export default function understat(ctx: Ctx) {
    ctx.grid.append(originTile("understat"));
    overview(ctx);
    timeline(ctx);
    const c = ctx.understatDataset!.columns;
    for (const spec of [
        { title: "Tore je Spiel", field: "home_goals, away_goals", from: 0, to: 11, width: 1, get: (i: number) => [c.home_goals[i] + c.away_goals[i]] },
        { title: "xG je Spiel", field: "home_xg, away_xg", from: 0, to: 7.25, width: .25, get: (i: number) => [c.home_xg[i] + c.away_xg[i]] },
        { title: "PPDA je Team und Spiel", field: "home_ppda, away_ppda", from: 0, to: 41, width: 1, get: (i: number) => [c.home_ppda[i], c.away_ppda[i]] },
        { title: "Deep Completions je Team und Spiel", field: "home_deep, away_deep", from: 0, to: 31, width: 1, get: (i: number) => [c.home_deep[i], c.away_deep[i]] }
    ]) {
        const t = tile({ title: spec.title, span: "half", chartHeight: 240, source: "understat", describe: { field: spec.field, view: "Histogramm" } });
        ctx.grid.append(t.el);
        ctx.onUpdate(rows => { const b = bins(Array.from(rows).flatMap(spec.get), spec.from, spec.to, spec.width); const labels = b.bins.map((v, i) => i === b.bins.length - 1 ? `${v.from}+` : spec.width === 1 ? String(v.from) : `${v.from}–${v.to}`); t.chart!.setOption(base({ xAxis: { type: "category", data: labels }, yAxis: { type: "value" }, series: [{ type: "bar", data: b.bins.map(v => v.n) }] }), true); t.setTable(() => ({ headers: ["Klasse", "Anzahl"], rows: b.bins.map((v, i) => [labels[i], v.n]) })); t.setFooter(`${b.missing} Werte fehlen`); });
    }
    explorer(ctx, { source: "understat", columns: matchColumns(ctx, true) });
}
