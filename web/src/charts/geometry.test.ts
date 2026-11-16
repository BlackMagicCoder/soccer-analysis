import { describe, expect, it } from "vitest";
import { barLayout, lineSegments } from "./geometry";
import type { Point } from "./figure";
const point = (x: number, y: number | null, series = "A"): Point => ({ x, y, series, label: String(x) });

describe("line geometry", () => {
  it("breaks at null and non-finite observations after ordering by x", () => {
    const points = [point(4, 4), point(0, 1), point(2, null), point(1, 2), point(3, NaN), point(5, 6), point(6, Infinity), point(7, 8)];
    expect(lineSegments(points).map(segment => segment.map(p => p.x))).toEqual([[0, 1], [4, 5], [7]]);
    expect(points[0].x).toBe(4);
  });
  it("handles empty and entirely missing series", () => {
    expect(lineSegments([])).toEqual([]);
    expect(lineSegments([point(0, null), point(1, NaN)])).toEqual([]);
  });
});

describe("grouped bars", () => {
  it("places series side by side and keeps groups inside the plotting area", () => {
    const points = [point(0, 1), point(0, 2, "B"), point(10, 3), point(10, 4, "B")];
    const bars = barLayout(points, ["A", "B"]);
    expect(bars.pointCenter(points[0]) + bars.width / 2).toBeLessThanOrEqual(bars.pointCenter(points[1]) - bars.width / 2);
    expect(bars.pointCenter(points[0]) - bars.width / 2).toBeGreaterThanOrEqual(65);
    expect(bars.pointCenter(points[3]) + bars.width / 2).toBeLessThanOrEqual(715);
    expect(bars.center(0)).toBeLessThan(bars.center(10));
  });
  it("reserves the same series slot when a category lacks its other series", () => {
    const points = [point(0, 1), point(0, 2, "B"), point(1, 3)];
    const bars = barLayout(points, ["A", "B"]);
    expect(bars.pointCenter(points[0]) - bars.center(0)).toBe(bars.pointCenter(points[2]) - bars.center(1));
    const single = barLayout([points[0]], ["A"]);
    expect(single.pointCenter(points[0])).toBe(single.center(0));
  });
});
