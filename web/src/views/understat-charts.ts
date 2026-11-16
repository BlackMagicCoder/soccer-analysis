import { base, fmt, leagueColors } from "../charts/ec";
import { countBy, outcome, share } from "../data/explore";
import type { Ctx } from "../ui/layout";
import { kpi, tile as rawTile, type TileOptions } from "../ui/tile";
import { bindMonthClick, bindSeasonClick, clickLeague, isAdditive, monthChart, seasonLeagueChart } from "./common";

const tile = (o: TileOptions) => rawTile({...o,source:"understat",describe:{field:o.title.includes("Monat") ? "date" : o.title.includes("Saison") ? "season, league" : o.title.includes("Liga") ? "league" : "home_goals, away_goals",view:"Balkendiagramm"}});
export default function overview(ctx: Ctx) {
  const c = ctx.dataset.columns;
  const band = document.createElement("div");
  band.className = "kpis span-full";
  const k = {
    games: kpi("Spiele"),
    teams: kpi("Teams"),
    seasons: kpi("Saisons"),
    goals: kpi("Tore je Spiel"),
    home: kpi("Heimsiege"),
    xg: kpi("xG je Spiel"),
  };
  band.append(...Object.values(k).map((x) => x.el));

  const seasons = tile({ title: "Spiele je Saison und Liga", span: "two-thirds", chartHeight: 280, hint: "Klick: Saison filtern" });
  const leagues = tile({ title: "Spiele je Liga", span: "third", chartHeight: 280, hint: "Klick: Liga filtern" });
  const results = tile({ title: "Spielausgang", span: "third", chartHeight: 240 });
  const months = tile({ title: "Spiele je Kalendermonat", span: "third", chartHeight: 240, hint: "Klick: Monat wählen" });
  const map = tile({ title: "Stadien (Wikidata)", span: "third", chartHeight: 240, hint: "Klick: Team wählen" });
  ctx.grid.append(band, seasons.el, leagues.el, results.el, months.el);

  bindSeasonClick(ctx, seasons.chart!);
  leagues.chart!.on("click", (p) => clickLeague(ctx, (p.data as { league: number }).league, isAdditive(p)));
  bindMonthClick(months.chart!);


  ctx.onUpdate((rows) => {
    const n = rows.length;
    let goals = 0, goalsN = 0, xg = 0, xgN = 0;
    const validResults = Array.from(rows).filter(i => Number.isFinite(c.home_goals[i]) && Number.isFinite(c.away_goals[i]));
    const out = countBy(validResults, (i) => outcome(ctx.dataset, i));
    const teams = new Set<number>();
    for (const i of rows) {
      const g = c.home_goals[i] + c.away_goals[i];
      if (Number.isFinite(g)) { goals += g; goalsN++; }
      const x = c.home_xg[i] + c.away_xg[i];
      if (Number.isFinite(x)) { xg += x; xgN++; }
      if (Number.isFinite(c.home_team[i])) teams.add(c.home_team[i]);
      if (Number.isFinite(c.away_team[i])) teams.add(c.away_team[i]);
    }
    k.games.set(fmt(n), `${fmt(share(n, ctx.dataset.n), 1)} % des Bestands`);
    k.teams.set(fmt(teams.size));
    k.seasons.set(fmt(new Set(Array.from(rows, (i) => c.season[i])).size));
    k.goals.set(goalsN ? fmt(goals / goalsN, 2) : "—", `${fmt(goals)} Tore`);
    k.home.set(validResults.length ? fmt(share(out.get("H") ?? 0, validResults.length), 1) + " %" : "—", `${fmt(out.get("H") ?? 0)} Spiele`);
    k.xg.set(xgN ? fmt(xg / xgN, 2) : "—", "Understat");

    const t1 = seasonLeagueChart(ctx, seasons.chart!, rows);
    seasons.setTable(() => t1);

    const byLeague = countBy(rows, (i) => c.league[i]);
    const ls = ctx.meta.leagues.slice().reverse();
    leagues.chart!.setOption(
      base({
        grid: { left: 104, right: 40, top: 8, bottom: 24 },
        xAxis: { type: "value" },
        yAxis: { type: "category", data: ls.map((l) => l.name) },
        series: [{
          type: "bar",
          name: "Spiele",
          barWidth: "56%",
          label: { show: true, position: "right", fontFamily: "IBM Plex Mono", fontSize: 11, formatter: (p: { value: number }) => fmt(p.value) },
          data: ls.map((l) => ({ value: byLeague.get(l.id) ?? 0, league: l.id, itemStyle: { color: ctx.filter().leagues.includes(l.id) ? leagueColors[l.id] : "#c7cec2" } })),
        }],
      }),
      true,
    );
    leagues.setTable(() => ({ headers: ["Liga", "Spiele"], rows: ctx.meta.leagues.map((l) => [l.name, byLeague.get(l.id) ?? 0]) }));

    const labels = [["H", "Heimsieg"], ["D", "Remis"], ["A", "Auswärtssieg"]] as const;
    results.chart!.setOption(
      base({
        grid: { left: 92, right: 56, top: 8, bottom: 24 },
        tooltip: { trigger: "item", formatter: (p: { name: string; value: number }) => `${p.name}<br><b>${fmt(p.value)}</b> Spiele · ${fmt(share(p.value, validResults.length), 1)} %` },
        xAxis: { type: "value", show: false },
        yAxis: { type: "category", data: labels.map((l) => l[1]).reverse() },
        series: [{
          type: "bar",
          barWidth: "54%",
          color: "#3f5a4b",
          label: { show: true, position: "right", fontFamily: "IBM Plex Mono", fontSize: 11, formatter: (p: { value: number }) => fmt(share(p.value, validResults.length), 1) + " %" },
          data: labels.map((l) => out.get(l[0]) ?? 0).reverse(),
        }],
      }),
      true,
    );
    results.setTable(() => ({ headers: ["Ausgang", "Spiele", "Anteil %"], rows: labels.map((l) => [l[1], out.get(l[0]) ?? 0, Number(share(out.get(l[0]) ?? 0, validResults.length).toFixed(1))]) }));
    results.setFooter("Deskriptive Verteilung im gewählten Ausschnitt, keine Ursachenanalyse.");

    const m = monthChart(ctx, months.chart!, rows);
    months.setTable(() => ({ headers: ["Monat", "Spiele"], rows: m }));


  });
}
