import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";

echarts.use([BarChart, LineChart, ScatterChart, AriaComponent, DataZoomComponent, GeoComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

export type ECharts = echarts.ECharts;
export type Option = echarts.EChartsCoreOption;

export const ink = "#1c231f";
export const muted = "#5a6560";
export const line = "#c5ccbf";
export const pitch = "#23704a";
export const amber = "#d99a1c";
export const leagueColors: Record<number, string> = { 1: "#3d5f95", 2: "#2f7d57", 3: "#b5473f", 4: "#c18a2c", 5: "#6b4f8a" };

const font = '"IBM Plex Sans", system-ui, sans-serif';
const mono = '"IBM Plex Mono", ui-monospace, monospace';
echarts.registerTheme("retro", {
  color: [pitch, "#3d5f95", "#b5473f", "#c18a2c", "#6b4f8a"],
  backgroundColor: "transparent",
  textStyle: { fontFamily: font, color: ink },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#8f9a8c" } },
    axisTick: { lineStyle: { color: "#8f9a8c" } },
    axisLabel: { color: muted, fontFamily: font, fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: muted, fontFamily: mono, fontSize: 11 },
    splitLine: { lineStyle: { color: "#dde2d7", type: "dashed" } },
    nameTextStyle: { color: muted, fontSize: 11 },
  },
  legend: { textStyle: { color: muted, fontSize: 11 }, icon: "rect", itemWidth: 10, itemHeight: 10 },
});

/** Gemeinsame Grundeinstellungen: Tooltip im Stil eines klassischen BI-Werkzeugs. */
/** Wertachsen ohne eigenes Format bekommen deutsche Tausendertrennzeichen (ECharts nutzt sonst Kommas). */
function germanAxes(axis: unknown): unknown {
  if (Array.isArray(axis)) return axis.map(germanAxes);
  const a = axis as { type?: string; axisLabel?: { formatter?: unknown } } | undefined;
  if (!a || a.type !== "value" || a.axisLabel?.formatter) return axis;
  return { ...a, axisLabel: { ...a.axisLabel, formatter: (v: number) => fmt(v, Number.isInteger(v) ? 0 : 1) } };
}
export function base(option: Option): Option {
  const o = option as { xAxis?: unknown; yAxis?: unknown };
  if (o.xAxis) o.xAxis = germanAxes(o.xAxis);
  if (o.yAxis) o.yAxis = germanAxes(o.yAxis);
  return {
    animationDuration: 300,
    animationDurationUpdate: 250,
    aria: { enabled: true },
    grid: { left: 52, right: 16, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(35,112,74,0.08)" } },
      backgroundColor: "#fffef7",
      borderColor: ink,
      borderWidth: 1,
      borderRadius: 0,
      padding: [6, 9],
      textStyle: { color: ink, fontFamily: font, fontSize: 12 },
      extraCssText: "box-shadow: 3px 3px 0 rgba(28,35,31,.18);",
    },
    ...option,
  };
}

export function mountChart(el: HTMLElement): ECharts {
  const chart = echarts.init(el, "retro", { renderer: "canvas" });
  new ResizeObserver(() => chart.resize()).observe(el);
  // Kacheln werden vor dem Einhängen erzeugt; ohne echte Größe kann die Karte keine Projektion berechnen.
  const setOption = chart.setOption.bind(chart) as (...a: unknown[]) => void;
  (chart as unknown as { setOption: (...a: unknown[]) => void }).setOption = (...args: unknown[]) => {
    if (el.isConnected && (chart.getWidth() !== el.clientWidth || chart.getHeight() !== el.clientHeight)) chart.resize();
    setOption(...args);
  };
  return chart;
}

let registered = false;
/** Natural-Earth-Ländergrenzen (world-atlas, gemeinfrei), lokal gebündelt – kein externer Kartendienst. */
export function ensureEuropeMap() {
  if (registered) return;
  const topo = world as unknown as Parameters<typeof feature>[0] & { objects: { countries: never } };
  const geo = feature(topo, topo.objects.countries) as unknown as { features: { properties: { name: string } }[] };
  echarts.registerMap("europe", geo as never);
  registered = true;
}

export const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
