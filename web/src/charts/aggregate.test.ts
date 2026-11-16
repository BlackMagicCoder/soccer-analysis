import { describe, expect, it } from "vitest";
import { csv, groupMean, histogram } from "./aggregate";
describe("chart aggregation", () => {
  it("groups only finite observations and reports each denominator", () => {
    const values = [2, NaN, 4, Infinity, 0];
    expect(groupMean([0, 1, 2, 3, 4], i => i < 3 ? "A" : "B", i => values[i])).toEqual([
      { key: "A", mean: 3, n: 2 }, { key: "B", mean: 0, n: 1 },
    ]);
    expect(groupMean([], () => "A", () => 1)).toEqual([]);
  });
  it("assigns interior boundaries once and includes the final upper boundary", () => {
    expect(histogram([-1, 0, 5, 10, 20, 21, NaN], [0, 10, 20])).toEqual({
      bins: [{ from: 0, to: 10, n: 2 }, { from: 10, to: 20, n: 2 }], missing: 1, outside: 2,
    });
  });
  it("handles empty input and rejects ambiguous boundaries", () => {
    expect(histogram([], [0, 1]).bins[0].n).toBe(0);
    for (const edges of [[], [1], [0, 0], [2, 1], [0, NaN]]) expect(() => histogram([], edges)).toThrow();
  });
  it("escapes CSV cells, leaves numeric negatives intact and prevents spreadsheet formulas", () => {
    expect(csv([["a,\"b", "=SUM(A1)", -2, null]])).toBe('"a,""b","\'=SUM(A1)","-2",""');
  });
});
