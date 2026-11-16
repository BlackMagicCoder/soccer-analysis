import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { mockApi } from "./mock/plugin";
export default defineConfig(({ mode }) => ({
  resolve: { preserveSymlinks: true },
  plugins: mode === "mock" ? [tailwindcss(), mockApi()] : [tailwindcss()],
  server: {
    // docs/stadien-wikidata.csv (Wikidata-Nachweis der Stadien) liegt außerhalb von web/.
    fs: { allow: [".."] },
    proxy: mode === "mock" ? undefined : { "/api": "http://127.0.0.1:8010" },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: [
        "index.html",
        "spieldaten.html", "stadien.html", "wetter.html", "verknuepft.html",
        "daten.html",
        "wetter-geo.html",
        "zeitverlauf.html",
        "fragen.html",
        "zusammenfassung.html",
        "charts.html",
      ],
      output: { manualChunks: { echarts: ["echarts/core", "echarts/charts", "echarts/components", "echarts/renderers"] } },
    },
  },
}));
