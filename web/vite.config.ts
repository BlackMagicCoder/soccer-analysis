import { defineConfig } from "vite";
import { mockApi } from "./mock/plugin";
export default defineConfig(({ mode }) => ({
  resolve: { preserveSymlinks: true },
  plugins: mode === "mock" ? [mockApi()] : [],
  server: {
    proxy: mode === "mock" ? undefined : { "/api": "http://127.0.0.1:8000" },
  },
  build: {
    rollupOptions: {
      input: [
        "index.html",
        "daten.html",
        "wetter-geo.html",
        "zeitverlauf.html",
        "zusammenfassung.html",
      ],
    },
  },
}));
