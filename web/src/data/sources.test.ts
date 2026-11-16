import { matchColumns, understatTableKeys } from "../ui/match-columns";
import type { Ctx } from "../ui/layout";
import { describe, expect, it } from "vitest";
import type { Filter, UnderstatResponse, WikidataResponse, OpenMeteoResponse } from "../api/types";
import { decodeUnderstat, decodeWikidata, decodeOpenMeteo, selectUnderstat, understatColumnKeys, weatherColumnKeys } from "./sources";
const source = { name: "Test", url: "https://example.org", content: "Test", retrieval: "Test", license: "Test" };
const columns = Object.fromEntries(understatColumnKeys.map(k => [k, [1, 1, 1, 1]])) as unknown as UnderstatResponse["columns"];
Object.assign(columns, { date: ["2020-03-01T15:30", "2020-04-01T16:00", "2021-03-01T17:00", "2021-04-01T18:00"], league: [1, 2, 1, 2], season: [2019, 2019, 2020, 2020], home_team: [0, 1, 2, 2], away_team: [1, 2, 0, 1], home_xg: [null, 1, 2, 3], home_goals: [null, 1, 2, 3] });
const raw: UnderstatResponse = { data_version: 2, n: 4, teams: ["A", "B", "C"], source, columns };
const f: Filter = { leagues: [1, 2], seasonFrom: 2019, seasonTo: 2020, ghost: "include" };
describe("Quellendecoder", () => {
    it("decodiert Understat ohne null als Nullwert zu behandeln", () => { const d = decodeUnderstat(raw); expect(d.columns.home_xg[0]).toBeNaN(); expect(d.columns.home_goals[0]).toBeNaN(); expect(d.columns.date[0]).toBe(Date.UTC(2020, 2, 1, 15, 30)); expect(d.teams).toEqual(["A", "B", "C"]); expect(Object.keys(d.columns).sort()).toEqual([...understatColumnKeys].sort()); });
    it("erhält fehlende Wikidata-Koordinaten und Kennungen", () => { const r: WikidataResponse = { data_version: 2, n_teams: 1, n_venues: 1, source, stadiums: [{ team: "A", venue: "Stadion", city: "Ort", lat: null, lon: 13, wikidata: null }] }; const [s] = decodeWikidata(r); expect(s.lat).toBeNaN(); expect(s.lon).toBe(13); expect(s.wikidata).toBeUndefined(); });
    it("erhält fehlende Wetterwerte und Abfrageparameter", () => { const r: OpenMeteoResponse = { data_version: 2, n: 1, source, query: { endpoint: "test", model: "test", variables: { w_temp: "t", w_wind: "w", w_precip_2h: "p" }, timezone: "UTC", delay_days: 5 }, columns: { time: ["2020-03-01T15:00"], lat: [null], lon: [13], w_temp: [null], w_wind: [0], w_precip_2h: [null] }, example: null }; const [s] = decodeOpenMeteo(r); expect(s.lat).toBeNaN(); expect(s.w_temp).toBeNaN(); expect(s.w_wind).toBe(0); expect(s.w_precip_2h).toBeNaN(); expect(s.time).toBe("2020-03-01T15:00"); });
});
describe("Understat-Auswahl", () => {
    const d = decodeUnderstat(raw);
    it("filtert Liga", () => expect([...selectUnderstat(d, { ...f, leagues: [1] })]).toEqual([0, 2]));
    it("filtert Saison", () => expect([...selectUnderstat(d, { ...f, seasonFrom: 2020 })]).toEqual([2, 3]));
    it("findet Team als Heim und Gast", () => expect([...selectUnderstat(d, f, { teams: ["A"], months: [] })]).toEqual([0, 2]));
    it("filtert Kalendermonat und kombiniert die Auswahl", () => { expect([...selectUnderstat(d, f, { teams: [], months: [4] })]).toEqual([1, 3]); expect([...selectUnderstat(d, { ...f, leagues: [1] }, { teams: ["A"], months: [3] })]).toEqual([0, 2]); });
    it("ignoriert jeden Geistermodus", () => { for (const ghost of ["include", "exclude", "only"] as const)
        expect([...selectUnderstat(d, { ...f, ghost })]).toEqual([0, 1, 2, 3]); });
    it("liefert leere Auswahl für unbekannte Teams", () => expect([...selectUnderstat(d, f, { teams: ["X"], months: [] })]).toEqual([]));
});
describe("Tabellengrenzen", () => {
    it("verwendet ausschließlich Understat-Spalten", () => { const allowed = ["game_id", "date", "league", "season", "home_team", "away_team", "home_goals", "away_goals", "home_points", "away_points", "home_xg", "away_xg", "home_xpts", "away_xpts", "home_ppda", "away_ppda", "home_deep", "away_deep"]; const definitions = matchColumns({ dataset: decodeUnderstat(raw), leagueName: (id: number) => String(id) } as Ctx, true); expect(definitions.map(c => c.key).sort()).toEqual([...understatTableKeys].sort()); for (const col of definitions)
        expect(allowed).toContain(col.key); expect(understatColumnKeys).toHaveLength(18); });
    it("zeigt Wetterabfragen ohne Team- oder Ergebnisfelder", () => { expect(weatherColumnKeys).toEqual(["time", "lat", "lon", "w_temp", "w_wind", "w_precip_2h"]); for (const key of weatherColumnKeys)
        expect(key).not.toMatch(/team|goal|point|league|season|game_id/); });
});
