import { describe, it, expect } from "vitest";
import { applySelection, bins, countBy, parseCsv, sortRows, monthOf } from "./explore";
import { parseSelection, serializeSelection } from "../state/selection";
import type { Dataset } from "./dataset";

const d = {
  n: 4,
  dataVersion: 1,
  teams: ["Arsenal", "Chelsea", "Lyon"],
  columns: {
    home_team: Int32Array.from([0, 1, 2, 1]),
    away_team: Int32Array.from([1, 2, 0, 0]),
    date: Float64Array.from([Date.UTC(2020, 0, 5), Date.UTC(2020, 2, 1), Date.UTC(2021, 0, 9), Date.UTC(2021, 7, 20)]),
  },
} as unknown as Dataset;
const all = Uint32Array.from([0, 1, 2, 3]);

describe("Kreuzfilter-Auswahl", () => {
  it("filtert nach Team (Heim oder Gast) und Monat", () => {
    expect([...applySelection(d, all, { teams: ["Lyon"], months: [] })]).toEqual([1, 2]);
    expect([...applySelection(d, all, { teams: [], months: [1] })]).toEqual([0, 2]);
    expect([...applySelection(d, all, { teams: ["Arsenal"], months: [1] })]).toEqual([0, 2]);
    expect(applySelection(d, all, { teams: [], months: [] })).toBe(all);
  });
  it("liefert keine Spiele für ein unbekanntes Team statt alle", () => {
    expect([...applySelection(d, all, { teams: ["Unbekannt"], months: [] })]).toEqual([]);
  });
  it("liest und schreibt die URL-Parameter robust", () => {
    const s = parseSelection("?team=Lyon|Arsenal|Lyon&monat=3,13,x,1", ["Arsenal", "Lyon"]);
    expect(s).toEqual({ teams: ["Arsenal", "Lyon"], months: [1, 3] });
    expect(parseSelection(serializeSelection(s))).toEqual(s);
    expect(parseSelection("?team=Fake", ["Arsenal"]).teams).toEqual([]);
    expect(serializeSelection({ teams: [], months: [] })).toBe("");
  });
});

describe("Aggregation", () => {
  it("zählt, klassiert und sortiert", () => {
    expect(countBy(all, (i) => monthOf(d.columns.date[i])).get(1)).toBe(2);
    const b = bins([-50, 0, 1.9, 2, 99, NaN], 0, 6, 2);
    expect(b.bins.map((x) => x.n)).toEqual([3, 1, 1]);
    expect(b.missing).toBe(1);
    const v = [3, NaN, 1, 2];
    expect([...sortRows(all, (i) => v[i], 1)]).toEqual([2, 3, 0, 1]);
    expect([...sortRows(all, (i) => v[i], -1)]).toEqual([0, 3, 2, 1]);
  });
  it("parst die Wikidata-Nachweisdatei mit Anführungszeichen", () => {
    const rows = parseCsv('team,venue,wikidata\r\n"Inter","Stadio ""San Siro"", Mailand",Q1\r\nLyon,Groupama,Q2\r\n');
    expect(rows).toEqual([
      { team: "Inter", venue: 'Stadio "San Siro", Mailand', wikidata: "Q1" },
      { team: "Lyon", venue: "Groupama", wikidata: "Q2" },
    ]);
  });
});
