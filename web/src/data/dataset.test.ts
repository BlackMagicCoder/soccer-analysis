import { describe, it, expect } from "vitest";
import {
  integerColumns,
  flagColumns,
  numericColumns,
  type MatchesResponse,
} from "../api/types";
import { decodeMatches, selectRows, summarize } from "./dataset";
const columns = {
  date: [
    "2014-08-01T15:00",
    "2015-08-01T15:00",
    "2016-08-01T15:00",
    "2016-09-01T15:00",
  ],
} as MatchesResponse["columns"];
for (const k of [...integerColumns, ...flagColumns, ...numericColumns])
  columns[k] = [0, 0, 0, 0];
Object.assign(columns, {
  league: [1, 3, 1, 3],
  season: [2014, 2015, 2016, 2016],
  ghost: [0, 1, 1, 0],
  home_goals: [2, 1, 0, 3],
  away_goals: [0, 1, 1, 2],
  w_temp: [null, 10, 20, 30],
});
const response: MatchesResponse = {
  data_version: 1,
  n: 4,
  teams: ["A", "B"],
  columns,
};
const f = {
  leagues: [1, 3],
  seasonFrom: 2014,
  seasonTo: 2016,
  ghost: "include" as const,
};
describe("dataset", () => {
  it("decodes types, nulls and dates", () => {
    const d = decodeMatches(response);
    expect(d.columns.w_temp).toBeInstanceOf(Float64Array);
    expect(d.columns.league).toBeInstanceOf(Int32Array);
    expect(d.columns.ghost).toBeInstanceOf(Uint8Array);
    expect(d.columns.w_temp[0]).toBeNaN();
    expect(d.columns.date[0]).toBe(Date.UTC(2014, 7, 1, 15));
  });
  it("selects leagues and seasons", () => {
    const d = decodeMatches(response);
    expect([...selectRows(d, { ...f, leagues: [1] })]).toEqual([0, 2]);
    expect([
      ...selectRows(d, { ...f, seasonFrom: 2015, seasonTo: 2015 }),
    ]).toEqual([1]);
  });
  it("selects each ghost mode", () => {
    const d = decodeMatches(response);
    expect([...selectRows(d, f)]).toEqual([0, 1, 2, 3]);
    expect([...selectRows(d, { ...f, ghost: "exclude" })]).toEqual([0, 3]);
    expect([...selectRows(d, { ...f, ghost: "only" })]).toEqual([1, 2]);
  });
  it("memoises by dataset, version and stable filter", () => {
    const d = decodeMatches(response);
    const rows = selectRows(d, f);
    expect(selectRows(d, { ...f, leagues: [3, 1] })).toBe(rows);
    expect(selectRows(decodeMatches(response), f)).not.toBe(rows);
    d.dataVersion++;
    expect(selectRows(d, f)).not.toBe(rows);
  });
  it("summarizes a known fixture and empty rows", () => {
    const d = decodeMatches(response);
    expect(summarize(d, selectRows(d, f))).toEqual({
      n: 4,
      homeWinPct: 50,
      drawPct: 25,
      awayWinPct: 25,
      goalsPerMatch: 2.5,
    });
    expect(summarize(d, new Uint32Array())).toEqual({
      n: 0,
      homeWinPct: 0,
      drawPct: 0,
      awayWinPct: 0,
      goalsPerMatch: 0,
    });
  });
});
