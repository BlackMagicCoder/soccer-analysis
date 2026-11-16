import type { Point } from "./figure";

/** Keep explicit missing observations as breaks instead of interpolating across them. */
export function lineSegments(points: Point[]): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (const point of [...points].sort((a, b) => a.x - b.x)) {
    if (!Number.isFinite(point.x) || point.y === null || !Number.isFinite(point.y)) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}

/** Allocate a distinct slot to every visible series within each category. */
export function barLayout(points: Point[], series: string[]) {
  const categories = [...new Set(points.map(p => p.x))].sort((a, b) => a - b);
  const categoryWidth = 650 / Math.max(1, categories.length);
  const groupWidth = Math.min(54, categoryWidth * 0.8);
  const width = groupWidth / Math.max(1, series.length);
  const center = (value: number) => 65 + (categories.indexOf(value) + 0.5) * categoryWidth;
  return {
    width,
    center,
    pointCenter: (point: Point) => center(point.x) - groupWidth / 2 +
      (series.indexOf(point.series ?? "Daten") + 0.5) * width,
  };
}
