# Fußball-Analyse

```sh
npm install
npm run dev       # /api → http://127.0.0.1:8010
npm run dev:mock  # deterministische Entwicklungsdaten
npx tsc --noEmit
npx vitest run
npm run build
```

Die Seitenreiter gliedern sich in zwei Bereiche:

- Datenbasis: `index.html` (Übersicht und Quellensteckbriefe), `spieldaten.html` (Understat), `stadien.html` (Wikidata), `wetter.html` (Open-Meteo-Wetterabfragen).
- Auswertung: `verknuepft.html` (zusammengeführte Spieltabelle und berechnete Felder), `fragen.html`, `zusammenfassung.html`.
- Technische Vorschau: `charts.html` (Diagramm-Bausteine).

`daten.html`, `wetter-geo.html` und `zeitverlauf.html` sind statische Weiterleitungen und bleiben im Build erhalten. Insgesamt entstehen elf HTML-Dateien.

Die Übersicht lädt die drei Endpunkte `/api/source/understat`, `/api/source/wikidata` und `/api/source/open-meteo`. Jede Quellenansicht lädt nur ihren Quellenendpunkt; Spieldaten lädt zusätzlich `/api/meta` für Liga- und Saisonfilter. Verknüpfte Daten und Diagramm-Bausteine verwenden `/api/meta`, `/api/matches` und `/api/stadiums`. Fragen und Zusammenfassung benötigen keine API-Daten.

Nur Spieldaten, Verknüpfte Daten und Diagramm-Bausteine haben einen Filterbereich. Auf Spieldaten wird `geister` ignoriert und unverändert in der URL erhalten. Team und Kalendermonat sind Kreuzfilter; Wetter- und Ergebnisklassen sind keine Filter. Wetterabfragen enthalten ausschließlich Zeit, Koordinaten und Wetterwerte.

Der Mock wird ausschließlich im Vite-Modus `mock` während der Entwicklung geladen; der Produktionsbuild enthält keine Mock-Daten. Datumswerte ohne Zeitzone werden als UTC interpretiert. Kachelmenüs bieten Tabelle, Fokus, CSV und bei Diagrammen PNG. Quellenkacheln nennen Quelle, Feld und Darstellung in ihrer Fußzeile.
