# Fußballanalyse: Plan und Übergabe

Stand: 13. November 2026. Dieser lokale Plan rekonstruiert die Entscheidungen aus der übergebenen Claude-Sitzung. Das externe Claude-Artefakt wird hierdurch nicht verändert.

## Verbindlicher Umfang

- Das Notebook bleibt unverändert und dient als fachliche Orientierung.
- Ausschließlich lokale Ausführung; kein Deployment, keine Domain und kein Zugriff auf den Auroq-Server.
- Fünf Unterseiten: Start, Daten, Wetter & Geodaten, Zeitverlauf, Zusammenfassung. Gemeinsame Filter nach Liga, Saison und Geisterspielen bleiben bei Seitenwechseln erhalten.
- Spielstatistiken sollen aus Understat und Wetter aus Open-Meteo nachgeladen werden. Die inzwischen bereitgestellte Parquet-Datei ist ein optionaler historischer Startbestand, keine Voraussetzung für künftige Aktualisierungen.
- Antworttexte aus dem Notebook werden nicht übernommen.
- Die Forschungsfragen stehen ausschließlich im eigenen Navigationsbereich „Fragen“ zwischen „Zeitverlauf“ und „Zusammenfassung“. Daten, Wetter und Zeitverlauf zeigen zunächst nur Datenaufbau, echte Beispiele und die Verteilung einzelner Variablen beziehungsweise Spielanzahlen. Keine Fragekarten oder Antwortplatzhalter auf diesen Seiten.
- Welle 1 und Welle 2 sind freigegeben. Wellen 3 und 4 beginnen frühestens am 15. Dezember 2026 nach weiterer Freigabe.
- Fester Datenstichtag: 31. Mai 2026 einschließlich, letzte Saison 2025/26. Spätere Spiele werden weder importiert noch ausgeliefert. Historische Saisons bleiben vollständig innerhalb dieses Gesamtzeitraums erhalten.

## Wellen

| Welle | Inhalt | Status |
| --- | --- | --- |
| 1 | SQLite, lesende FastAPI, Regressionsendpunkte, Seitengerüst und Filter; Quellen-Abruf laut letzter Umfangskorrektur vorgezogen | Implementiert, Offline-Prüfung bestanden; erfolgreiche echte Quellenbefüllung noch offen |
| 2 | Wiederverwendbare Diagramm-Bausteine, weitere Datenpipeline-Härtung und Betriebsintegration | Implementiert und technisch geprüft; visuelle Browserprüfung wegen gesperrtem Computerzugriff ausstehend |
| 3 | Interaktive Auswertungsseiten entsprechend den sieben Notebook-Abbildungen; eigenständige Auswertung der zwölf Fragen | Frühestens 15.12.2026 |
| 4 | Gesamtabnahme, visuelle und fachliche Prüfung sowie neue Antworttexte nach Freigabe | Frühestens 15.12.2026 |

Die Diagrammflächen im Gerüst sind derzeit bewusst Platzhalter. Funktionierende Filter und Kennzahlen bedeuten noch keine fertigen Auswertungsseiten.

## Konkretisierung Welle 2

Die Diagramm-Werkstatt erprobt wiederverwendbare SVG-Bausteine mit echten API-Daten, gemeinsamen Filtern, zugänglichen Datenanzeigen und Exporten. Sie ist eine technische Vorschau; die fachlichen Frageseiten und Antworttexte bleiben Welle 3 und 4 vorbehalten.

Nach Nutzerkorrektur zeigt „Daten“ bereits eine tatsächliche Übersicht statt Diagrammplatzhaltern: Feldkatalog, Einheiten, kompakter API-Aufbau, entschlüsselte Beispielspiele und ein einfaches Diagramm der Spielanzahlen je Liga. „Wetter & Geodaten“ erlaubt die Verteilung jeweils einer einzelnen Variable; „Zeitverlauf“ zeigt ausschließlich die vorhandenen Spielanzahlen je Saison. Die frühere gemischte Wetter-Streudiagramm-Vorschau wurde entfernt. Die zwölf Fragen sind nur noch unter „Fragen“ sichtbar und bleiben bis Mitte Dezember unbearbeitet.

Eine ergänzte Einstiegsebene vereinfacht die Datenseite: zunächst eine kurze Übersicht der zwei Quellen und der eigenen Daten-API, danach fünf echte Spiele ohne Wetterdetails. Die bisherige vollständige Übersicht bleibt unter „Weiter zu Datenaufbau, allen Feldern und Diagrammen“ erhalten. Filter sind auf der Datenseite ebenfalls aufklappbar, damit die erste Ansicht auf Quellen und Tabelle beschränkt bleibt.

Die Datenpipeline setzt den Stichtag unabhängig von Browserfiltern durch. Parallele Aktualisierungen werden abgefangen, vorübergehende HTTP-Fehler begrenzt wiederholt und Fehlerstände sichtbar gespeichert. Wetter kann getrennt von einem erfolgreichen Understat-Abruf ergänzt werden. Ein Statusendpunkt zeigt die Datenqualität und den letzten Abrufversuch.

Lokale Skripte starten die Webseite standardmäßig auf Port 8010, prüfen die Erreichbarkeit und sichern SQLite konsistent. Ein Quellenlauf kann in einem eigenen Terminal täglich laufen; es werden keine Windows-Autostartaufgaben oder Serverdienste eingerichtet.

## Daten und Zwischenspeicherung

SQLite unter `data/soccer.db` hält den letzten verwertbaren Datenbestand. Rohdaten, Datenbank und lokale Quellencaches bleiben außerhalb von Git. Ein täglicher Quellenlauf darf bei Quellenausfällen keine vorhandenen Spiele löschen oder Daten erfinden. Neue Teams ohne bekannte Stadionkoordinaten erhalten zunächst keine Wetter- oder Distanzwerte.

Die API bereitet Daten pro Datenversion im Speicher auf, puffert Regressionsantworten nach Version und Filter und liefert ETags sowie komprimiertes JSON. Im Browser erlauben kompakte Spalten und typisierte Arrays schnelle Filter ohne erneuten Download jedes einzelnen Spiels. Nach Quellenaktualisierungen müssen Meta- und Spieldaten dieselbe Version verwenden.

Understat hat in der Vorgängersitzung nur eine Platzhalterseite geliefert. Solange kein echter erfolgreicher Quellenlauf vorliegt, ist der Live-Abruf nicht als produktiv verifiziert zu bezeichnen. Der lokale Datenbestand umfasst zunächst 21.589 Spiele vom 08.08.2014 bis 24.05.2026.

## Lokaler Start und Prüfung

Siehe die Projekt-README für Start, Quellenlauf und Tests. `start-local.ps1` baut das Frontend und startet FastAPI auf Loopback. Ein lokaler täglicher Lauf funktioniert nur, solange Rechner und Prozess laufen. Eine spätere Server-Installation ist ein eigener Schritt.

Geprüft: 74 Python-Tests einschließlich historischem Notebook-Abgleich, Stichtagsgrenzen, fehlendem Wetter und seedfreiem Quellenimport; 25 Frontend-Tests; TypeScript und Produktionsbuild; HTTP-Erreichbarkeit aller fünf Unterseiten sowie der Diagramm-Werkstatt einschließlich referenzierter Assets. Das Notebook wurde nicht geändert. Die visuelle Browserprüfung war wegen gesperrtem Computerzugriff nicht möglich. Die Aktualisierung läuft noch nicht dauerhaft im Hintergrund; `python -m soccer_api.refresh --watch` muss lokal gestartet und offen gelassen werden.

Am 13.11.2026 wurde die aktualisierte API auf Port 8010 gestartet und die Statusprüfung erfolgreich ausgeführt. Ein echter Understat-Abruf für Bundesliga 2025 lieferte erneut keine verwertbaren eingebetteten Spieldaten. Der anschließende unabhängige Open-Meteo-Lauf ergänzte dagegen alle 28 Wetterlücken mit 56 Quellenaufrufen erfolgreich. Stand: 21.589 Spiele, Datenversion 2, keine fehlenden Wetter- oder Koordinatenwerte; letzter vorhandener Spieltag 24.05.2026. Dies ist eine Vollständigkeitsprüfung der vorhandenen Felder, kein Nachweis, dass Understat alle Spiele geliefert hat oder dass sämtliche historischen Koordinaten fachlich verifiziert sind.

Vor dem Wetterlauf wurde eine konsistente SQLite-Sicherung unter `data/backups/` erstellt. Ein Vergleich aller Nicht-Wetter-Spalten gegen diese Sicherung ergab keine geänderten Spielzeilen; beide Bestände enthalten 21.589 Spiele.

## Retro-BI-Oberfläche (13.11.2026, freigegeben als Variante A1)

Die Webseite ist als Analyse-Desktop im Stil klassischer BI-Werkzeuge umgebaut: Menüleiste, Kachelraster auf Arbeitsfläche, Filterbereich rechts (mobil als Schublade), Seitenreiter unten. Technik: Tailwind CSS v4, Apache ECharts 6.1 (nur benötigte Module), Natural-Earth-Grenzen aus `world-atlas` lokal gebündelt, IBM Plex Sans/Mono.

- **Kreuzfilterung (A1):** nur über Dimensionen – Liga und Saison (globaler Filter), Team und Kalendermonat (Auswahl, in der URL als `team`/`monat`). Wetter-, Distanz- und Ergebnisklassen sind bewusst nicht anklickbar; Zusammenhänge mit Ergebnissen bleiben Welle 3 vorbehalten.
- **Kachelmenü:** Daten als Tabelle, Fokusmodus, CSV- und PNG-Export.
- **Daten-Explorer:** alle Spiele sortier-, such- und blätterbar, Spaltenauswahl, CSV-Export der Auswahl; Detailansicht je Spiel mit Herkunftskennzeichnung (Understat / Wikidata / Open-Meteo / berechnet); Team-Steckbrief mit Wikidata-Link aus `docs/stadien-wikidata.csv`; Feldkatalog mit Fehlwertanteil.
- **Geprüft:** TypeScript, Build, 30 Frontend-Tests (u. a. Auswahl-Logik, Klassierung, Sortierung, CSV-Parser), Darstellung per Headless-Edge-Screenshots (1440 px und 600 px) ohne Laufzeitfehler, Kreuzfilter-Zählung gegen SQLite abgeglichen (Arsenal, März, Premier League: 34 Spiele). Maus-Interaktionen (Klicks in Diagramme, Detailansicht, Menüs) sind noch nicht in einem echten Browser geprüft.


## Gliederung nach Datenquellen (14.11.2026)

Die Oberfläche trennt die Ausgangsdaten nach Quelle. Unter **Datenbasis** stehen `index.html` (Übersicht mit drei Quellensteckbriefen und gemeinsamem Ablaufbild), `spieldaten.html` (Understat-Statistiken, Verteilungen, Zeitverlauf, Spieltabelle und Feldkatalog), `stadien.html` (Wikidata-Stammdaten, gleich große Kartenpunkte, lokal markierbare Stadiontabelle und Hinweise) und `wetter.html` (Open-Meteo-Wetterabfragen, Abfragebeschreibung, Rohantwort, Histogramme und Abfragetabelle).

Unter **Auswertung** stehen `verknuepft.html` (Datenmodell, Berechnungsregeln, gemischte Diagramme, Gesamt-Explorer mit Herkunftskürzeln, Team-Steckbrief, Quellen und Abrufstatus), `fragen.html` (mit Verweis auf die Berechnungsdetails) und `zusammenfassung.html` (Text zur neuen Gliederung). `charts.html` bleibt als Diagramm-Werkstatt erreichbar. `daten.html`, `wetter-geo.html` und `zeitverlauf.html` sind statische Weiterleitungen ohne Skript; alle elf HTML-Dateien werden gebaut.

**Endpunkte und Filter:** Die Übersicht lädt `/api/source/understat`, `/api/source/wikidata` und `/api/source/open-meteo`. Spieldaten verwendet `/api/meta` und `/api/source/understat`, Stadion-Stammdaten nur `/api/source/wikidata`, Wetter nur `/api/source/open-meteo`. Verknüpfte Daten und Diagramm-Bausteine verwenden weiterhin `/api/meta`, `/api/matches` und `/api/stadiums`; der Gesamt-Explorer ruft außerdem den vorhandenen Abrufstatus ab. Fragen und Zusammenfassung laden keine Daten. Der Entwicklungs-Mock bildet die drei Quellenendpunkte aus den vorhandenen synthetischen Daten nach; der Produktionsbuild enthält keine Mockdaten.

Nur Spieldaten, Verknüpfte Daten und Diagramm-Bausteine haben einen Filterbereich. Spieldaten nutzt Liga, Saison, Team und Kalendermonat. Der Geistermodus wird dort ignoriert; ein vorhandener `geister`-Parameter bleibt auch beim Zurücksetzen erhalten. Die vollständigen Filter gelten auf den verknüpften Seiten. Wetterabfragen zeigen Ort und Zeit ausschließlich als Abfrageparameter, ohne Teams, Ergebnisse oder Liga-/Saison-/Monatsaufschlüsselung. Quellenkennzeichen und Fußzeilen benennen Quelle, Feld und Darstellung; zusätzliche Anmerkungen bleiben erhalten.

**Prüfstand:** `npx tsc --noEmit` erfolgreich (0 Fehler), `npx vitest run` erfolgreich (42 Tests in 8 Dateien), `npm run build` erfolgreich (664 transformierte Module, 11 HTML-Dateien). Wegen eingeschränkter Windows-Pfadrechte wurden dieselben Befehle über eine temporäre Laufwerkszuordnung auf den Projektordner ausgeführt, mit Node-Optionen zur Beibehaltung der Pfade. Tests decken die drei Decoder, fehlende Werte, Understat-Auswahl, ignorierten Geistermodus einschließlich URL-Erhalt und die tatsächlichen Spaltendefinitionen ab.

Ein Headless-Edge-Aufruf aller sieben Fachseiten mit Mockdaten zeigte keine JavaScript-Ausnahmen. Die Netzwerkabfragen entsprachen den vorgesehenen Datenladewegen. Spieldaten zeigte bei `geister=nur` unverändert alle 1.500 Mockspiele, Verknüpfte Daten 135 Spiele. Die Understat-Detailansicht enthielt ausschließlich die Understat-Gruppe und den passenden Match-Link; Zurücksetzen erhielt `geister=nur`. Eine Integration mit dem parallel entstehenden Backend wurde in diesem Auftrag nicht geprüft. Nicht committet; Änderungen ausschließlich in `web/` und diesem Dokument.
