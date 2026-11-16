import wikidataCsv from "../../../docs/stadien-wikidata.csv?raw";
import { amber, base, ensureEuropeMap, fmt, ink, leagueColors, muted, type ECharts } from "../charts/ec";
import { countBy, MONTHS, parseCsv, SEASON_MONTHS, monthOf } from "../data/explore";
import { defaults, setFilter } from "../state/filters";
import { toggle } from "../state/selection";
import type { Ctx } from "../ui/layout";
import { seasonLabel } from "../ui/format";

/** Team → Wikidata-Objekt des Stadions (Nachweis aus docs/stadien-wikidata.csv). */
export const wikidata = new Map(parseCsv(wikidataCsv).map((r) => [r.team, r.wikidata]));

export const isAdditive = (p: unknown) => {
  const e = (p as { event?: { event?: MouseEvent } }).event?.event;
  return Boolean(e?.ctrlKey || e?.metaKey);
};

/** Klick auf eine Saison: auf diese Saison eingrenzen, erneuter Klick hebt die Eingrenzung auf. */
export function clickSeason(ctx: Ctx, season: number) {
  const f = ctx.filter();
  const d = defaults(ctx.meta);
  if (f.seasonFrom === season && f.seasonTo === season) setFilter({ seasonFrom: d.seasonFrom, seasonTo: d.seasonTo });
  else setFilter({ seasonFrom: season, seasonTo: season });
}
/** Klick auf eine Liga: nur diese Liga (Strg: hinzufügen/entfernen); erneuter Klick zeigt wieder alle. */
export function clickLeague(ctx: Ctx, league: number, additive: boolean) {
  const f = ctx.filter();
  if (additive) setFilter({ leagues: f.leagues.includes(league) ? f.leagues.filter((l) => l !== league) : [...f.leagues, league] });
  else setFilter({ leagues: f.leagues.length === 1 && f.leagues[0] === league ? defaults(ctx.meta).leagues : [league] });
}

/** Spiele je Kalendermonat in Saisonreihenfolge; Klick wählt Monate im Kreuzfilter aus. */
export function monthChart(ctx: Ctx, chart: ECharts, rows: Uint32Array) {
  const counts = countBy(rows, (i) => monthOf(ctx.dataset.columns.date[i]));
  const selected = new Set(ctx.selection().months);
  chart.setOption(
    base({
      xAxis: { type: "category", data: SEASON_MONTHS.map((m) => MONTHS[m - 1]) },
      yAxis: { type: "value" },
      series: [
        {
          type: "bar",
          name: "Spiele",
          barWidth: "62%",
          data: SEASON_MONTHS.map((m) => ({
            value: counts.get(m) ?? 0,
            month: m,
            itemStyle: { color: selected.has(m) ? amber : selected.size ? "#b9c4b4" : "#23704a" },
          })),
        },
      ],
    }),
    true,
  );
  return SEASON_MONTHS.map((m) => [MONTHS[m - 1], counts.get(m) ?? 0] as [string, number]);
}
export function bindMonthClick(chart: ECharts) {
  chart.on("click", (p) => {
    const m = (p.data as { month?: number })?.month;
    if (m) toggle("months", m, isAdditive(p));
  });
}

export function seasonLeagueChart(ctx: Ctx, chart: ECharts, rows: Uint32Array) {
  const c = ctx.dataset.columns;
  const seasons = ctx.meta.seasons.filter((s) => s >= ctx.filter().seasonFrom && s <= ctx.filter().seasonTo);
  const by = countBy(rows, (i) => c.season[i] * 10 + c.league[i]);
  const leagues = ctx.meta.leagues.filter((l) => ctx.filter().leagues.includes(l.id));
  chart.setOption(
    base({
      legend: { top: 0, right: 0 },
      grid: { left: 52, right: 12, top: 34, bottom: 30 },
      xAxis: { type: "category", data: seasons.map(seasonLabel) },
      yAxis: { type: "value" },
      series: leagues.map((l) => ({
        type: "bar",
        stack: "s",
        name: l.name,
        color: leagueColors[l.id],
        emphasis: { focus: "series" },
        data: seasons.map((s) => ({ value: by.get(s * 10 + l.id) ?? 0, season: s })),
      })),
    }),
    true,
  );
  return {
    headers: ["Saison", ...leagues.map((l) => l.name), "Gesamt"],
    rows: seasons.map((s) => {
      const vals = leagues.map((l) => by.get(s * 10 + l.id) ?? 0);
      return [seasonLabel(s), ...vals, vals.reduce((a, b) => a + b, 0)];
    }),
  };
}
export function bindSeasonClick(ctx: Ctx, chart: ECharts) {
  chart.on("click", (p) => {
    const s = (p.data as { season?: number })?.season;
    if (s) clickSeason(ctx, s);
  });
}

/** Stadionkarte (Wikidata-Koordinaten): Punktgröße = Heimspiele in der Auswahl, Klick = Team. */
export function stadiumMap(ctx: Ctx, chart: ECharts, rows: Uint32Array, zoom = 1.15) {
  ensureEuropeMap();
  const c = ctx.dataset.columns;
  const home = countBy(rows, (i) => c.home_team[i]);
  const selected = new Set(ctx.selection().teams);
  const active = ctx.filter().leagues;
  const points = ctx.stadiums
    .filter((s) => active.includes(s.league))
    .map((s) => {
      const n = home.get(ctx.dataset.teams.indexOf(s.team)) ?? 0;
      return {
        name: s.team,
        value: [s.lon, s.lat, n],
        venue: s.venue,
        city: s.city,
        league: s.league,
        itemStyle: {
          color: selected.has(s.team) ? amber : leagueColors[s.league],
          opacity: n ? (selected.size && !selected.has(s.team) ? 0.35 : 0.9) : 0.18,
          borderColor: selected.has(s.team) ? ink : "#fcfcf8",
          borderWidth: selected.has(s.team) ? 1.5 : 0.6,
        },
      };
    });
  chart.setOption(
    base({
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const d = (p as { data: { name: string; venue: string; city: string; value: number[]; league: number } }).data;
          return `<b>${d.name}</b><br>${d.venue}, ${d.city}<br>${ctx.leagueName(d.league)} · ${fmt(d.value[2])} Heimspiele<br><span style="color:${muted}">${fmt(d.value[1], 3)}° N, ${fmt(d.value[0], 3)}° O</span>`;
        },
      },
      geo: {
        map: "europe",
        roam: true,
        center: [3.5, 46.5],
        zoom: 5.2 * zoom,
        scaleLimit: { min: 2, max: 40 },
        itemStyle: { areaColor: "#e4e8dd", borderColor: "#aeb7a8", borderWidth: 0.6 },
        emphasis: { disabled: true },
        select: { disabled: true },
        silent: true,
      },
      series: [
        {
          type: "scatter",
          coordinateSystem: "geo",
          data: points,
          symbolSize: (v: number[]) => (v[2] ? 5 + Math.sqrt(v[2]) * 0.9 : 4),
          emphasis: { scale: 1.6 },
        },
      ],
    }),
    { replaceMerge: ["series"] },
  );
  return {
    headers: ["Team", "Liga", "Stadion", "Ort", "Breite", "Länge", "Heimspiele", "Wikidata"],
    rows: points.map((p) => [p.name, ctx.leagueName(p.league), p.venue, p.city, p.value[1], p.value[0], p.value[2], wikidata.get(p.name) ?? null]),
  };
}
export function bindTeamClick(chart: ECharts) {
  chart.on("click", (p) => {
    const name = (p.data as { name?: string })?.name;
    if (name) toggle("teams", name, isAdditive(p));
  });
}

export const leagueTag = (ctx: Ctx, id: number) =>
  `<span style="display:inline-block;width:8px;height:8px;background:${leagueColors[id]};margin-right:6px"></span>${ctx.leagueName(id)}`;
