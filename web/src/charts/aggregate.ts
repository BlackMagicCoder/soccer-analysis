export interface Summary { key: string; n: number; mean: number }
export function groupMean(rows: Iterable<number>, key: (i: number) => string, value: (i: number) => number): Summary[] {
  const groups = new Map<string, { n: number; sum: number }>();
  for (const i of rows) {
    const v = value(i);
    if (!Number.isFinite(v)) continue;
    const k = key(i), g = groups.get(k) ?? { n: 0, sum: 0 };
    g.n++; g.sum += v; groups.set(k, g);
  }
  return [...groups].map(([key, g]) => ({ key, n: g.n, mean: g.sum / g.n }));
}
export function histogram(values: Iterable<number>, edges: number[]) {
  if (edges.length < 2 || edges.some((v, i) => !Number.isFinite(v) || (i > 0 && v <= edges[i - 1])))
    throw new Error("Histogrammgrenzen müssen endlich und streng aufsteigend sein.");
  const bins = edges.slice(0, -1).map((from, i) => ({ from, to: edges[i + 1], n: 0 }));
  let missing = 0, outside = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) { missing++; continue; }
    const bin = bins.find((b, i) => v >= b.from && (v < b.to || (i === bins.length - 1 && v === b.to)));
    if (bin) bin.n++; else outside++;
  }
  return { bins, missing, outside };
}
export function csv(rows: (string | number | null)[][]): string {
  return rows.map(row => row.map(value => {
    let s = value === null ? "" : String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
}
