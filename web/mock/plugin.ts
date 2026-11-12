import type { Plugin } from "vite";
import {
  integerColumns,
  flagColumns,
  numericColumns,
  type MatchesResponse,
  type MetaResponse,
  type ModelsResponse,
  type StadiumsResponse,
} from "../src/api/types";
import { parseFilter } from "../src/state/filters";
import { decodeMatches, selectRows } from "../src/data/dataset";
export function generateMock() {
  let seed = 20261112;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const leagues = [
    { id: 1, key: "EPL", name: "Premier League" },
    { id: 2, key: "Serie A", name: "Serie A" },
    { id: 3, key: "Bundesliga", name: "Bundesliga" },
    { id: 4, key: "La Liga", name: "La Liga" },
    { id: 5, key: "Ligue 1", name: "Ligue 1" },
  ];
  const teams = leagues.flatMap((l) =>
    Array.from({ length: 10 }, (_, i) => `${l.name} Team ${i + 1}`),
  );
  const columns = { date: [] } as unknown as MatchesResponse["columns"];
  for (const k of [...integerColumns, ...flagColumns, ...numericColumns])
    columns[k] = [];
  for (let season = 2014; season <= 2025; season++)
    for (let round = 0; round < 25; round++)
      for (let league = 1; league <= 5; league++) {
        const i = columns.date.length;
        const date = new Date(
          Date.UTC(season, 7 + Math.floor(round / 3), 1 + (round % 3) * 8, 15),
        );
        const ghost = Number(
          date.toISOString().slice(0, 10) >= "2020-03-15" &&
            date.toISOString().slice(0, 10) <= "2021-06-30",
        );
        const home = (league - 1) * 10 + (round % 10),
          away =
            (league - 1) * 10 + ((round + 1 + Math.floor(random() * 8)) % 10);
        const hg = Math.floor(random() * 5),
          ag = Math.floor(random() * 4);
        const row: Record<string, number | null> = {
          game_id: i + 1,
          league,
          season,
          home_team: home,
          away_team: away,
          home_goals: hg,
          away_goals: ag,
          home_points: hg > ag ? 3 : hg === ag ? 1 : 0,
          away_points: ag > hg ? 3 : hg === ag ? 1 : 0,
          is_derby: Number(i % 13 === 0),
          ghost,
          home_xg: random() * 4,
          away_xg: random() * 3,
          home_xpts: random() * 3,
          away_xpts: random() * 3,
          home_ppda: i % 19 === 0 ? null : 5 + random() * 15,
          away_ppda: i % 23 === 0 ? null : 5 + random() * 15,
          home_deep: Math.floor(random() * 20),
          away_deep: Math.floor(random() * 20),
          travel_km: i % 31 === 0 ? null : 20 + random() * 1000,
          strdiff: i % 37 === 0 ? null : random() * 2 - 1,
          w_temp: i % 29 === 0 ? null : -5 + random() * 40,
          w_wind: i % 29 === 0 ? null : random() * 35,
          w_precip_2h: i % 29 === 0 ? null : random() * 5,
          w_temp_diff_away: i % 29 === 0 ? null : random() * 20 - 10,
        };
        columns.date.push(date.toISOString().slice(0, 16));
        for (const k of integerColumns) columns[k].push(row[k]!);
        for (const k of flagColumns) columns[k].push(row[k]!);
        for (const k of numericColumns) columns[k].push(row[k]);
      }
  const matches: MatchesResponse = {
    data_version: 1,
    n: columns.date.length,
    teams,
    columns,
  };
  const meta: MetaResponse = {
    data_version: 1,
    updated_at: "2026-11-12T10:00:00Z",
    n_matches: matches.n,
    n_teams: teams.length,
    n_stadiums: teams.length,
    date_min: columns.date[0].slice(0, 10),
    date_max: columns.date.at(-1)!.slice(0, 10),
    seasons: Array.from({ length: 12 }, (_, i) => 2014 + i),
    leagues,
    ghost_period: ["2020-03-15", "2021-06-30"],
  };
  const stadiums: StadiumsResponse = {
    data_version: 1,
    stadiums: teams.map((team, i) => ({
      team,
      league: Math.floor(i / 10) + 1,
      venue: `Stadion ${i + 1}`,
      city: `Stadt ${i + 1}`,
      lat: 40 + i * 0.2,
      lon: -3 + i * 0.3,
    })),
  };
  return { meta, matches, stadiums };
}
export function mockApi(): Plugin {
  const { meta, matches, stadiums } = generateMock();
  const dataset = decodeMatches(matches);
  return {
    name: "development-mock-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();
        let body: unknown;
        if (url.pathname === "/api/meta") body = meta;
        else if (url.pathname === "/api/matches") body = matches;
        else if (url.pathname === "/api/stadiums") body = stadiums;
        else if (url.pathname === "/api/models") {
          const filter = parseFilter(
            "?" +
              new URLSearchParams({
                l: url.searchParams.get("leagues") ?? "",
                von: url.searchParams.get("season_from") ?? "",
                bis: url.searchParams.get("season_to") ?? "",
                geister:
                  url.searchParams.get("ghost") === "only"
                    ? "nur"
                    : url.searchParams.get("ghost") === "exclude"
                      ? "ohne"
                      : "mit",
              }),
            meta,
          );
          const n = selectRows(dataset, filter).length;
          body = {
            data_version: 1,
            filter: {
              leagues: filter.leagues,
              season_from: filter.seasonFrom,
              season_to: filter.seasonTo,
              ghost: filter.ghost,
            },
            n,
            models: {
              f1_cold_hot: {
                kind: "poisson",
                outcome: "goals",
                n,
                controls: ["strdiff", "league", "ghost"],
                terms: [
                  { name: "cold", coef: -0.0764, p: 0.0003, effect_pct: -7.35 },
                ],
              },
            },
            errors: {},
          } satisfies ModelsResponse;
        } else {
          res.statusCode = 404;
          body = { detail: "API-Endpunkt nicht gefunden." };
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(body));
      });
    },
  };
}
