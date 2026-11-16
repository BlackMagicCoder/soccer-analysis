# Quellen und Grenzen des lokalen Quellenabgleichs

Quellendokumentation vom 12. November 2026; Laufprüfung aktualisiert am 13. November 2026.

- Understat: https://understat.com/league/Bundesliga/2026 und https://understat.com/league/EPL/2025 . Kein dokumentierter API-Vertrag: `soccer_api.refresh` liest die eingebetteten `datesData` und `teamsData` der Ligaseiten. Der echte Abruf und der öffentliche Webabruf liefern derzeit eine Wartungs-/Platzhalterseite (»We will come back soon«), keine Spieldaten. Der Abgleich bricht deshalb vor Datenbankänderungen mit Exitcode 1 ab. Offline-Tests prüfen das erwartete eingebettete Datenformat, ersetzen aber keine erfolgreiche Quellintegration.
- Open-Meteo-Dokumentation: https://open-meteo.com/en/docs/historical-weather-api . Verwendeter Endpunkt: https://archive-api.open-meteo.com/v1/archive . Abgerufen werden ERA5-Stundenwerte für `temperature_2m`, `wind_speed_10m` und `precipitation`, mit UTC, °C und km/h. ERA5 hat laut Dokumentation fünf Tage Verzögerung; jüngere Spiele bleiben beim Wetter ausstehend. Fehlende Werte werden nicht durch erfundene Messwerte ersetzt.

## Aufruf und Zwischenspeicherung

```powershell
uv run python -m soccer_api.refresh --leagues 3 --seasons 2025 --weather-limit 50
uv run python -m soccer_api.refresh --seasons 2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025 --weather-only
uv run python -m soccer_api.refresh --watch
```

Standardmäßig werden alle fünf Ligen für das festgelegte Saisonstartjahr 2025 (Saison 2025/26) abgefragt. Die Analyse endet einschließlich 31.05.2026; Saisonstartjahre nach 2025 werden schon vor einem Netzwerkabruf abgelehnt. Die oben dokumentierte Quellprobe mit 2026 stammt aus der früheren Sitzung vor dieser Begrenzung. `--watch` wiederholt alle 24 Stunden, solange der Prozess und Rechner laufen. Der Stichtag rückt nicht automatisch weiter. `--weather-only` ergänzt ausstehendes Wetter aus der lokalen Datenbank unabhängig von Understat.

Welle 2 ergänzt eine Prozesssperre gegen parallele Quellenläufe und bis zu drei Versuche bei vorübergehenden Transportfehlern beziehungsweise HTTP 429/500/502/503/504. `Retry-After` wird beachtet; fordert die Quelle mehr als 60 Sekunden Pause, endet der Lauf und kann später wiederholt werden. Der dauerhafte letzte Laufstatus steht in `data/refresh-status.json` und unter `/api/status`. Er bezieht sich auf den dort genannten Modus (`sources` oder `weather`); ein erfolgreicher Wetterlauf bestätigt keinen erfolgreichen Understat-Abruf.

Validierte Quellenantworten liegen unter `data/source-cache/`, nach URL gehasht. Ligaseiten werden nach 20 Stunden erneut geladen; ERA5-Wetter für mindestens fünf Tage alte Spiele wird dauerhaft wiederverwendet. Die Datenbank schreibt Spiele anhand der eindeutigen Spiel-ID fort. Identische Datensätze erhöhen die Datenversion nicht. Fehlende zusätzliche Quellfelder überschreiben vorhandene Werte nicht. Das Wetterbudget zählt maximal 50 Aufrufe pro Lauf; für Heim- und Auswärtsort werden bis zu zwei Aufrufe pro Spiel benötigt. Wetterfehler lassen Spieldaten verfügbar, aber das Wetter ausstehend.

## Annahmen und noch zu verifizierende Punkte

Understat-Anstoßzeiten werden als UTC interpretiert. Diese Zeitzonenannahme muss anhand einer echten, verfügbaren Quellantwort geprüft werden. Temperatur und Wind stammen aus der Stunde, die den Anstoß enthält; der Zweistundenniederschlag summiert die beiden folgenden Stundenwerte. Die Temperaturdifferenz ist Heimort minus Auswärtsort zur gleichen Zeit.

Stadionkoordinaten stammen ausschließlich aus bereits vorhandenen lokalen Stadiondaten. Der Abruf erfindet keine Koordinaten. Neue Mannschaften erscheinen mit fehlenden Geodaten, bis verlässliche Stadiondaten ergänzt werden. Die Wiederverwendung der letzten bekannten Teamkoordinaten bildet Stadionumzüge oder neutrale Spielorte nicht automatisch historisch korrekt ab.

Erwartete Punkte, Non-Penalty-xG, PPDA und Deep Completions stammen aus dem passenden Team-History-Eintrag (Team, Datum, Heim/Auswärts). Fehlende History-Einträge bleiben leer. Eine erfolgreiche echte Understat-Antwort und deren fachlicher Abgleich sind noch ausstehend.

## Tatsächlich ausgeführte Prüfung am 13.11.2026

Der Understat-Abruf für Bundesliga 2025 brach mit fehlendem `datesData` ab; der historische Spielbestand blieb erhalten. Danach ergänzte ein eigenständiger Wetterlauf für die Saisons 2014–2025 die 28 unvollständigen Wetterzeilen mit 56 erfolgreichen Open-Meteo-Abrufen. Datenversion 2 enthält 21.589 Spiele ohne fehlende Werte in den vier geprüften Wetterfeldern und Stadionkoordinaten. Der Vergleich gegen die unmittelbar zuvor erstellte Sicherung bestätigte, dass keine anderen Spielspalten geändert wurden. Ein erfolgreicher Wetterlauf ist weiterhin kein Nachweis einer erfolgreichen Understat-Liveintegration.

## Herkunftsprüfung im unveränderten Notebook

Die folgende Prüfung trennt die ursprüngliche Herkunft des historischen Bestands von später neu implementierten Abrufen. Zellnummern sind nullbasiert.

| Fundstelle | Tatsächlich dokumentiert | Nicht dokumentiert |
| --- | --- | --- |
| Zelle 2, „Quelle ① – Spielstatistiken von Understat“ | Understat; zwölf Dateien `Football stats 2014_2015.parquet` bis `Football stats 2025_2026.parquet`; ursprünglicher Dateiname in `source_file` | Ursprünglicher Download-Endpunkt, Exporteur und Abrufcode |
| Zelle 3, „Quelle ② – Stadion- und Geodaten“ | Team-Stadion-Zuordnung mit `Venue`, `City`, `lat`, `lon`; aktuelles Stadion je Team, ohne Historisierung | Anbieter, URL oder API der Stammdatentabelle; kein Wikipedia-/Wikidata-Nachweis |
| Zelle 4, „Quelle ③ – Historische Wetterdaten“ | Stundenwetter über Koordinaten und Anstoßzeit, laut Text „typischerweise über eine Wetter-Archiv-API wie Open-Meteo“ | Eindeutig bestimmter ursprünglicher Wetteranbieter und konkrete historische Anfrage |
| Zelle 5, „Wie die Daten zusammengeführt wurden“ | Saisondateien stapeln, Stadiontabelle zweimal anhängen, Distanz/Derby berechnen, Wetter über Ort/Zeit zuordnen | Ursprüngliche Beschaffungsprogramme |
| Zelle 10, erster aktiver Ladecode | `pd.read_parquet` lädt bereits `Match_statistics_enriched.parquet` aus Google Drive oder lokal | Kein Abruf ursprünglicher Quellen |

Notebook-Quelltext, textuelle Ausgaben und Metadaten enthalten keinen Wikipedia-, Wikidata-, Nominatim- oder Geocoding-Herkunftsnachweis. Die Quellen-, Karten-, Ablauf- und Datenmodellabbildungen benennen ebenfalls keinen Wiki-Anbieter. Die lokale Parquet-Datei enthält nur pandas-/Arrow-Schemametadaten, keine zusätzliche Herkunfts-URL.

Wikidata wurde in den übergebenen Claude-Logs als mögliche künftige Ersatzquelle vorgeschlagen; daraus folgt keine historische Nutzung. Die eigene FastAPI ist lediglich die technische Auslieferung für diese Webseite und keine ursprüngliche Datenquelle. Die ursprüngliche Wetterherkunft darf nicht allein aus den neuen Open-Meteo-Ergänzungen abgeleitet werden. Zur vollständigen Rekonstruktion fehlen die Beschaffungsskripte beziehungsweise die ursprüngliche Stadiontabelle samt Quellenangaben.

## Herkunftsabgleich vom 13.11.2026 (Stadien und Wetter)

**Stadion- und Geodaten → Wikidata (belegt).** Alle 168 Teams des Startbestands wurden per SPARQL (https://query.wikidata.org/sparql) gegen Wikidata abgeglichen: Für jedes Stadion stimmen Breiten- und Längengrad exakt mit der Wikidata-Eigenschaft P625 (Koordinaten) überein; Stadionnamen sind die deutschen Wikidata-Bezeichnungen (z. B. „Londoner Stadion“, „Groß-London“, „Nizza“, „Elx / Elche“). Die Zuordnung Team → Wikidata-Objekt steht in `docs/stadien-wikidata.csv`. Zwei Sonderfälle: Almería (Q3773347) trägt heute keine deutsche Bezeichnung mehr; bei San Mamés gibt es zwei Objekte mit identischen Koordinaten, zugeordnet ist das 2013 eröffnete Stadion (Q182864). Die Spalte `City` entspricht nur bei 125 von 168 Teams der heutigen deutschen Bezeichnung von P131 (gelegen in Verwaltungseinheit); welche Eigenschaft beziehungsweise welcher Wikidata-Stand ursprünglich für die Stadt genutzt wurde, ist nicht mehr exakt rekonstruierbar. `travel_km` (Haversine, Erdradius 6371 km) und `is_derby` (< 30 km) sind daraus lokal berechnet und reproduzieren den Startbestand.

**Wetter → Open-Meteo-Archiv, Standardmodell (belegt).** Eine Stichprobe des Startbestands wurde gegen https://archive-api.open-meteo.com/v1/archive geprüft. `w_temp` und `w_wind` stimmen exakt (8 von 8) mit dem Standardmodell ohne `models`-Parameter („best_match“) zur UTC-Stunde des Anstoßes überein; mit `models=era5` nur 0–1 von 8. `w_precip_2h` ist die Summe aus Anstoßstunde und Folgestunde (10 von 10). `soccer_api.refresh` wurde auf genau diese Methode umgestellt; die 28 zuvor mit ERA5 nachgeladenen Zeilen wurden am 13.11.2026 mit der korrigierten Methode neu geladen (Sicherung vorher unter `data/backups/`). Hinweis: Das Standardmodell kombiniert ERA5, ERA5-Land und ECMWF IFS; Open-Meteo kann es nachträglich verfeinern, kleine Abweichungen bei späteren Abrufen sind daher möglich.

**`w_temp_diff_away` → Herkunft ungeklärt.** Die Temperaturdifferenz des Startbestands lässt sich mit keiner geprüften Variante reproduzieren (Heim minus Gast zur selben Stunde, Stundenversatz ±3 h, Tagesmittel, beliebige Stunde ±3 Tage am Gastort). Die neu berechneten Werte (Heimort minus Gastort zur selben UTC-Stunde, beide Open-Meteo-Standardmodell) sind deshalb fachlich klar definiert, aber nicht mit dem Startbestand vergleichbar.

**Understat.** Quelle eindeutig, ursprünglicher Downloadweg unbekannt. Am 13.11.2026 liefern sowohl die Ligaseite als auch der JSON-Endpunkt `getLeagueData` eine Fehlerseite. PPDA, Deep Completions und xPTS sind Understat-eigene Kennzahlen; eine gleichwertige Ersatzquelle existiert nicht.

## Korrektur und Neuausführung des Notebooks vom 16.11.2026

**Korrektur zu den 28 Spielen.** Ein Vergleich der Datenbank mit `data/seed/Match_statistics_enriched.parquet` zeigt: In der Datei fehlt bei den 28 Spielen ausschließlich `w_temp_diff_away`; `w_temp`, `w_wind` und `w_precip_2h` sind dort vorhanden. Die Datenbank unterscheidet sich von der Datei nur in diesen 28 Temperaturdifferenzen, alle übrigen Werte der 41 Spalten sind identisch. Frühere Formulierungen wie „28 Wetterlücken“ oder „28 unvollständige Wetterzeilen“ meinen diese fehlende Differenz.

**Herkunft auf der Webseite.** Sämtliche angezeigten Werte stammen aus der Datei; Understat, Wikidata und Open-Meteo sind deren ursprüngliche Quellen. Selbst abgerufen wurden nur die Grundlagen der 28 Temperaturdifferenzen (Open-Meteo), die Abgleiche (Wikidata, Open-Meteo-Stichprobe) und die Wikidata-IDs. Der Understat-Abruf lieferte auch am 16.11.2026 nur eine Fehlerseite.

**Notebook neu ausgeführt.** `Fußball_Analyse_aktuell.ipynb` ist eine Kopie des Notebooks, die statt der Parquet-Datei `data/soccer.db` (Datenversion 3) lädt; das Original `Fußball_Analyse.ipynb` ist unverändert. Ausführung: `uv run --with nbclient --with ipykernel --with matplotlib --with nbformat python` mit `nbclient` aus dem Projektordner. Alle Textausgaben von F1–F7 und F9–F12 sind identisch zum Original. Einzige Änderung in F8: Die Klassen der Temperaturdifferenz enthalten 28 Spiele mehr, Chi²-Test p = 0,474 statt 0,446, Klimaschock-Koeffizient 0,0023 (p = 0,685) statt 0,0026 (p = 0,635). Die Aussage von F8 bleibt gleich.
