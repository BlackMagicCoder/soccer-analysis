# Fußball, Wetter & Geodaten

```sh
npm install
npm run dev       # /api → http://127.0.0.1:8000
npm run dev:mock  # deterministische Entwicklungsdaten (1.500 Spiele)
npm test
npm run build
```

Fünf HTML-Einstiegspunkte, gemeinsame URL-Filter und ein typisierter API-Client.
Der Mock wird ausschließlich im Vite-Modus `mock` während der Entwicklung geladen;
der Produktionsbuild enthält keine Mock-Daten. Datumswerte ohne Zeitzone werden
für die Auswahl und Darstellung als UTC interpretiert. Leere Auswahlen liefern
Kennzahlen mit dem Wert 0. Die Startseite zeigt alle fünf im Auftrag benannten Kennzahlen.
