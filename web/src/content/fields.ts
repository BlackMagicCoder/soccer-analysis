import type { MatchesResponse } from "../api/types";

export type Field = keyof MatchesResponse["columns"];
export interface FieldInfo { field: Field; type: string; unit: string; description: string; origin: string }
const source = "Spielquelle / Understat";
const derived = "Lokal berechnet";
const weather = "Wetterquelle / Open-Meteo";
export const fields: FieldInfo[] = [
  { field: "game_id", type: "integer", unit: "ID", description: "Kennung des Spiels in der Spielquelle.", origin: source },
  { field: "date", type: "string", unit: "YYYY-MM-DDTHH:mm", description: "Spielzeit ohne Zeitzonenoffset; die Webseite interpretiert sie als UTC.", origin: source },
  { field: "league", type: "integer", unit: "Liga-ID", description: "Liga-Schlüssel; die Namen stehen in /api/meta.leagues.", origin: source },
  { field: "season", type: "integer", unit: "Startjahr", description: "Beginn der Saison, z. B. 2025 für 2025/26.", origin: source },
  { field: "home_team", type: "integer", unit: "Array-Index", description: "Index des Heimteams im teams-Wörterbuch; keine dauerhafte Team-ID.", origin: source },
  { field: "away_team", type: "integer", unit: "Array-Index", description: "Index des Gastteams im teams-Wörterbuch; keine dauerhafte Team-ID.", origin: source },
  { field: "home_goals", type: "integer", unit: "Tore", description: "Erzielte Tore des Heimteams.", origin: source },
  { field: "away_goals", type: "integer", unit: "Tore", description: "Erzielte Tore des Gastteams.", origin: source },
  { field: "home_points", type: "integer", unit: "Punkte", description: "Ergebnispunkte des Heimteams: 3, 1 oder 0.", origin: source },
  { field: "away_points", type: "integer", unit: "Punkte", description: "Ergebnispunkte des Gastteams: 3, 1 oder 0.", origin: source },
  { field: "home_xg", type: "number | null", unit: "erwartete Tore", description: "Expected Goals des Heimteams laut Spielquelle.", origin: source },
  { field: "away_xg", type: "number | null", unit: "erwartete Tore", description: "Expected Goals des Gastteams laut Spielquelle.", origin: source },
  { field: "home_xpts", type: "number | null", unit: "erwartete Punkte", description: "Expected Points des Heimteams laut Spielquelle.", origin: source },
  { field: "away_xpts", type: "number | null", unit: "erwartete Punkte", description: "Expected Points des Gastteams laut Spielquelle.", origin: source },
  { field: "home_ppda", type: "number | null", unit: "Pässe / Defensivaktion", description: "PPDA des Heimteams: Verhältnis aus zugelassenen Pässen und Defensivaktionen.", origin: "Lokal aus Understat-Zählern berechnet / Startbestand" },
  { field: "away_ppda", type: "number | null", unit: "Pässe / Defensivaktion", description: "PPDA des Gastteams: Verhältnis aus zugelassenen Pässen und Defensivaktionen.", origin: "Lokal aus Understat-Zählern berechnet / Startbestand" },
  { field: "home_deep", type: "integer | null", unit: "Anzahl", description: "Tiefe erfolgreiche Pässe des Heimteams laut Spielquelle (Deep Completions).", origin: source },
  { field: "away_deep", type: "integer | null", unit: "Anzahl", description: "Tiefe erfolgreiche Pässe des Gastteams laut Spielquelle (Deep Completions).", origin: source },
  { field: "travel_km", type: "number | null", unit: "km", description: "Luftlinie zwischen Heimstadion und Heimatstadion des Gastteams; keine tatsächliche Reiseroute.", origin: "Lokal aus Wikidata-Stadionkoordinaten berechnet" },
  { field: "is_derby", type: "0 | 1 | null", unit: "Flag", description: "Distanzbasierte Kennzeichnung: 1 bei weniger als 30 km Luftlinie; keine historische Derby-Einordnung.", origin: derived },
  { field: "ghost", type: "0 | 1", unit: "Flag", description: "1 im pauschalen Zeitraum 15.03.2020–30.06.2021; kein einzeln bestätigter Zuschauerstatus.", origin: derived },
  { field: "strdiff", type: "number | null", unit: "xG-Differenz / Spiel", description: "Mittlere saisonale xG-Bilanz des Heimteams minus jene des Gastteams; aus dem Gesamtbestand vor den UI-Filtern berechnet.", origin: derived },
  { field: "w_temp", type: "number | null", unit: "°C", description: "Temperatur am Heimspielort zur zugeordneten Spielstunde.", origin: weather },
  { field: "w_wind", type: "number | null", unit: "km/h", description: "Windgeschwindigkeit in 10 m Höhe am Heimspielort zur zugeordneten Spielstunde.", origin: weather },
  { field: "w_precip_2h", type: "number | null", unit: "mm / 2 Stunden", description: "Niederschlagssumme aus Anstoßstunde und Folgestunde (UTC).", origin: "Open-Meteo-Stundenwerte, lokal summiert" },
  { field: "w_temp_diff_away", type: "number | null", unit: "°C", description: "Temperatur am Spielort minus Temperatur am Heimatort des Gastteams zur gleichen Stunde. Die Werte des Startbestands ließen sich nicht reproduzieren.", origin: "Startbestand: Herkunft ungeklärt; Ergänzungen: aus Open-Meteo berechnet" },
];

/** Quelle, Inhalt, Weg zur Webseite – Stand des Herkunftsabgleichs vom 13.11.2026. */
export const sources: [string, string, string][] = [
    ["Understat · Spielstatistiken", "Datum, Teams, Tore, xG, PPDA und weitere Spielwerte", "Im Notebook als zwölf Saison-Parquet-Dateien beschrieben. Der ursprüngliche API-Endpunkt oder Downloadweg ist nicht angegeben."],
    ["Wikidata · Stadion-Stammdaten", "Team, Stadionname, Stadt, Breiten- und Längengrad", "Im Notebook ohne Anbieter beschrieben. Abgleich vom 13.11.2026: Die Koordinaten aller 168 Teams stimmen exakt mit Wikidata (Eigenschaft P625) überein, die Namen sind deutsche Wikidata-Bezeichnungen. Reisedistanz und Derby-Flag werden daraus lokal berechnet."],
    ["Open-Meteo · Historische Wetterdaten", "Stündliches Wetter am Stadion und am Heimatort des Gastteams", "Im Notebook nur als Archiv-API wie Open-Meteo beschrieben. Abgleich vom 13.11.2026: Temperatur, Wind und Niederschlag stimmen exakt mit dem Open-Meteo-Archiv (Standardmodell, Anstoßstunde in UTC) überein. Nur die Temperaturdifferenz zum Gastort ließ sich nicht reproduzieren."],
  ];
export const sourceLinks: [string, string][] = [["Understat", "https://understat.com/"], ["Wikidata · Koordinaten (P625)", "https://www.wikidata.org/wiki/Property:P625"], ["Open-Meteo · Historical Weather API", "https://open-meteo.com/en/docs/historical-weather-api"]];
