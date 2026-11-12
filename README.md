# Fußballanalyse API

Read-only FastAPI mit SQLite-Startbestand und Regressionsmodellen. Das Notebook bleibt unverändert als historische Referenz erhalten.

Python ab 3.12 und uv werden benötigt:

```powershell
uv sync
uv run python -m soccer_api.seed
uv run uvicorn soccer_api.main:app --host 127.0.0.1 --port 8000
```

Die private Datei `data/seed/Match_statistics_enriched.parquet` muss lokal bereitgestellt werden. Alternativ kann der Seed-Befehl einen Dateipfad erhalten. `SOCCER_DATA_DIR` überschreibt das Datenverzeichnis einschließlich `soccer.db`. Rohdaten und Datenbank dürfen nicht eingecheckt werden.

Die Dokumentation steht unter `/docs`, die GET-Endpunkte unter `/api/meta`, `/api/matches`, `/api/stadiums` und `/api/models`. Ein vorhandenes `web/dist/` wird automatisch ausgeliefert.

```powershell
uv run ruff check .
uv run pytest -q
```

Die Tests verwenden synthetische Daten. Notebook-Parität wird ohne reale Seed-Datei übersprungen. Stadiondaten stammen pro Team aus dem letzten Heimspiel; die Liga aus allen Heim- und Auswärtsspielen. Modelle benötigen mindestens 200 tatsächlich verwendbare Beobachtungen, auch auf Team-Saison-Ebene. Nicht schätzbare Teilmodelle werden als Fehler gemeldet.
