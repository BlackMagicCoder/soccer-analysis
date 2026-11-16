import { csv } from "./aggregate";
import { barLayout, lineSegments } from "./geometry";
import "./style.css";
export interface Point { label: string; x: number; y: number | null; series?: string; low?: number; high?: number; n?: number }
export interface ChartOptions { title: string; description: string; kind: "bar" | "line" | "scatter" | "coefficient"; xLabel: string; yLabel: string; points: Point[]; note?: string }
const NS = "http://www.w3.org/2000/svg";
const colors = ["#2166ac", "#b33b4c", "#28784e", "#8b5ca5", "#93610c"];
function svg<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
function text(x: number, y: number, value: string, anchor = "middle") {
  const el = svg("text", { x, y, "text-anchor": anchor, fill: "#273b31", "font-size": 12 }); el.textContent = value; return el;
}
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function figure(o: ChartOptions): HTMLElement {
  const root = document.createElement("figure"); root.className = "chart card";
  const caption = document.createElement("figcaption");
  const h = document.createElement("h2"); h.textContent = o.title;
  const description = document.createElement("p"); description.textContent = o.description;
  caption.append(h, description); root.append(caption);
  const legend = document.createElement("div"); legend.className = "controls chart-legend"; legend.setAttribute("aria-label", "Datenreihen einblenden");
  const plot = svg("svg", { viewBox: "0 0 760 350", role: "group", "aria-label": o.title });
  const tooltip = document.createElement("p"); tooltip.className = "chart-readout"; tooltip.setAttribute("role", "status");
  const hint = "Werte mit Tab oder Pfeiltasten auswählen; Escape setzt die Anzeige zurück.";
  tooltip.textContent = hint;
  const series = [...new Set(o.points.map(p => p.series ?? "Daten"))];
  const hidden = new Set<string>();
  const valid = o.points.filter(p => Number.isFinite(p.x) && p.y !== null && Number.isFinite(p.y));
  const missing = o.points.length - valid.length;
  const detail = (p: Point) => `${p.series ?? "Daten"} · ${p.label}: ${p.y?.toLocaleString("de-DE", { maximumFractionDigits: 3 })}${p.low !== undefined && p.high !== undefined ? ` · Intervall [${p.low.toFixed(3)}, ${p.high.toFixed(3)}]` : ""}${p.n !== undefined ? ` · n = ${p.n}` : ""}`;
  function render() {
    plot.replaceChildren(svg("rect", { width: 760, height: 350, fill: "#ffffff" }));
    const points = valid.filter(p => !hidden.has(p.series ?? "Daten"));
    if (!points.length) { plot.append(text(380, 165, valid.length ? "Keine Datenreihe eingeblendet" : "Keine gültigen Daten für diese Auswahl")); return; }
    const xs = points.map(p => p.x), ys = points.flatMap(p => [p.y!, ...(Number.isFinite(p.low) ? [p.low!] : []), ...(Number.isFinite(p.high) ? [p.high!] : [])]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(0, ...ys), ymax = Math.max(0, ...ys);
    const bars = barLayout(points, series.filter(s => !hidden.has(s)));
    const x = (v: number) => o.kind === "bar" ? bars.center(v) : 72 + (v - xmin) / (xmax - xmin || 1) * 630;
    const y = (v: number) => 275 - (v - ymin) / (ymax - ymin || 1) * 225;
    for (let i = 0; i <= 4; i++) {
      const v = ymin + (ymax - ymin || 1) * i / 4;
      plot.append(svg("line", { x1: 65, x2: 715, y1: y(v), y2: y(v), stroke: "#d6dfda" }), text(58, y(v) + 4, v.toLocaleString("de-DE", { maximumFractionDigits: 1 }), "end"));
    }
    plot.append(text(390, 338, o.xLabel), text(72, 24, o.yLabel, "start"));
    const categories = [...new Map(points.map(p => [p.x, p])).values()].sort((a, b) => a.x - b.x);
    const ticks = categories.filter((_, i) => i % Math.max(1, Math.ceil(categories.length / 7)) === 0);
    for (const p of ticks) plot.append(text(x(p.x), 300, o.kind === "bar" || o.kind === "coefficient" ? p.label : String(p.x)));
    if (o.kind === "line") for (const s of series) {
      if (hidden.has(s)) continue;
      for (const ps of lineSegments(o.points.filter(p => (p.series ?? "Daten") === s)))
        plot.append(svg("polyline", { points: ps.map(p => `${x(p.x)},${y(p.y!)}`).join(" "), fill: "none", stroke: colors[series.indexOf(s) % colors.length], "stroke-width": 2 }));
    }
    const marks: SVGElement[] = [];
    for (const p of points) {
      const color = colors[series.indexOf(p.series ?? "Daten") % colors.length];
      const px = o.kind === "bar" ? bars.pointCenter(p) : x(p.x);
      if (Number.isFinite(p.low) && Number.isFinite(p.high)) {
        plot.append(svg("line", { x1: px, x2: px, y1: y(p.low!), y2: y(p.high!), stroke: color, "stroke-width": 2 }));
        for (const v of [p.low!, p.high!]) plot.append(svg("line", { x1: px - 6, x2: px + 6, y1: y(v), y2: y(v), stroke: color }));
      }
      const width = bars.width;
      const mark = o.kind === "bar" ? svg("rect", { x: px - width / 2, y: Math.min(y(0), y(p.y!)), width, height: Math.max(1, Math.abs(y(0) - y(p.y!))), fill: color }) : svg("circle", { cx: px, cy: y(p.y!), r: 5, fill: color });
      mark.setAttribute("tabindex", "0"); mark.setAttribute("role", "img"); mark.setAttribute("aria-label", detail(p));
      const title = svg("title"); title.textContent = detail(p); mark.append(title);
      mark.addEventListener("pointerenter", () => { tooltip.textContent = detail(p); });
      mark.addEventListener("focus", () => { tooltip.textContent = detail(p); });
      mark.addEventListener("keydown", e => {
        const event = e as KeyboardEvent, i = marks.indexOf(mark);
        if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? marks.length - 1 : (i + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + marks.length) % marks.length;
          marks[next].focus();
        }
        if (event.key === "Escape") tooltip.textContent = hint;
      });
      marks.push(mark); plot.append(mark);
    }
  }
  for (const [i, s] of series.entries()) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = s; b.setAttribute("aria-pressed", "true");
    const dot = document.createElement("span"); dot.className = "dot"; dot.style.background = colors[i % colors.length]; dot.setAttribute("aria-hidden", "true"); b.prepend(dot);
    b.addEventListener("click", () => { if (hidden.has(s)) hidden.delete(s); else hidden.add(s); b.setAttribute("aria-pressed", String(!hidden.has(s))); tooltip.textContent = hint; render(); }); legend.append(b);
  }
  root.append(legend, plot, tooltip);
  const note = document.createElement("p"); note.className = "chart-note"; note.textContent = `${o.note ?? ""}${missing ? ` · ${missing} fehlende oder ungültige Werte ausgelassen.` : ""}`; root.append(note);
  const tools = document.createElement("div"); tools.className = "controls";
  const rows = [["Reihe", "Bezeichnung", "x", "y", "Untergrenze", "Obergrenze", "n"], ...valid.map(p => [p.series ?? "Daten", p.label, p.x, p.y, p.low ?? null, p.high ?? null, p.n ?? null])];
  const exportButton = (label: string, action: () => void) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.addEventListener("click", action); tools.append(b); };
  exportButton("SVG exportieren", () => { const clone = plot.cloneNode(true) as SVGSVGElement; clone.setAttribute("xmlns", NS); const t = svg("title"); t.textContent = o.title; const desc = svg("desc"); desc.textContent = `${o.description} ${o.note ?? ""}`; clone.prepend(t, desc); download(new XMLSerializer().serializeToString(clone), "image/svg+xml", "diagramm.svg"); });
  exportButton("CSV exportieren (alle Reihen)", () => download("\uFEFF" + csv(rows), "text/csv;charset=utf-8", "diagramm.csv"));
  const tableDetails = document.createElement("details"), summary = document.createElement("summary"); summary.textContent = "Werte als Tabelle"; tableDetails.append(summary);
  const table = document.createElement("table");
  for (const [i, row] of rows.entries()) { const tr = document.createElement("tr"); for (const value of row) { const cell = document.createElement(i === 0 ? "th" : "td"); if (i === 0) cell.setAttribute("scope", "col"); cell.textContent = value === null ? "—" : String(value); tr.append(cell); } table.append(tr); }
  tableDetails.append(table); root.append(tools, tableDetails); render(); return root;
}
