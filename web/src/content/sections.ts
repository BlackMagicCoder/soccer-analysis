export interface Section {
  id: string;
  page: string;
  title: string;
  description: string;
}
export const sections: Section[] = [
  {
    id: "abb-1",
    page: "daten",
    title: "Die drei Datenquellen",
    description:
      "Spielstatistiken von Understat, Stadion- und Geodaten, historisches Stundenwetter",
  },
  {
    id: "abb-2",
    page: "daten",
    title: "Heimstadien aller Teams",
    description: "Karte der Stadien nach Liga",
  },
  {
    id: "abb-3",
    page: "daten",
    title: "Verteilung der Wettervariablen",
    description:
      "Temperatur, Wind, Niederschlag und Temperaturdifferenz zum Heimatort des Gastes",
  },
  {
    id: "abb-4",
    page: "daten",
    title: "Ablauf der Zusammenführung",
    description:
      "Vier Schritte von den Saison-Dateien zur angereicherten Spieltabelle",
  },
  {
    id: "abb-5",
    page: "daten",
    title: "Reisedistanz des Gastteams",
    description: "Verteilung der Luftlinie und Median je Liga",
  },
  {
    id: "abb-6",
    page: "daten",
    title: "Datenmodell",
    description:
      "Sternschema aus Spiel, Team und Stadion, Wetter, Liga und Saison",
  },
  {
    id: "abb-7",
    page: "index",
    title: "Der Datensatz im Überblick",
    description: "Spiele je Liga und Saison, Ergebnisverteilung",
  },
  {
    id: "f1",
    page: "wetter-geo",
    title: "Hat die Temperatur einen Einfluss auf die Anzahl der Tore?",
    description: "Tore und Over-2.5-Quote nach Temperaturklasse",
  },
  {
    id: "f2",
    page: "wetter-geo",
    title: "Fallen bei Regen mehr oder weniger Tore?",
    description: "Tore und xG nach Niederschlag",
  },
  {
    id: "f3",
    page: "wetter-geo",
    title: "Senkt starker Wind die Torzahl und die Chancenqualität?",
    description: "Tore und xG nach Windstärke",
  },
  {
    id: "f4",
    page: "wetter-geo",
    title: "Beeinflusst das Wetter den Sieger?",
    description: "Heimsiegquote nach Temperatur, Wind und Niederschlag",
  },
  {
    id: "f5",
    page: "wetter-geo",
    title: "Bestimmt die Reisedistanz die Heimstärke einer Mannschaft?",
    description: "Heimsiegquote und Auswärtspunkte nach Distanz",
  },
  {
    id: "f6",
    page: "wetter-geo",
    title: "Verändert eine weite Anreise den Spielstil des Gastes?",
    description: "Pressing und xG des Gastes nach Distanz",
  },
  {
    id: "f7",
    page: "wetter-geo",
    title: "Sind Derbys anders?",
    description: "Ergebnisverteilung und Tore in Derbys unter 30 km",
  },
  {
    id: "f8",
    page: "wetter-geo",
    title:
      "Gibt es ein Nord-Süd-Gefälle im Heimvorteil, und leidet der Gast unter einem Klimaschock?",
    description: "Heimsiegquote nach Breitengrad und Temperaturdifferenz",
  },
  {
    id: "geisterspiele",
    page: "wetter-geo",
    title: "Zum Vergleich: die Geisterspiele",
    description: "Heimvorteil mit und ohne Zuschauer",
  },
  {
    id: "f9",
    page: "zeitverlauf",
    title: "Wie hat sich der Heimvorteil von 2014 bis 2025 entwickelt?",
    description: "Ergebnisverteilung, Punkte- und xG-Differenz je Saison",
  },
  {
    id: "f10",
    page: "zeitverlauf",
    title:
      "Fallen heute mehr Tore als 2014, und steigt die Chancenqualität mit?",
    description: "Tore und xG je Saison und Liga",
  },
  {
    id: "f11",
    page: "zeitverlauf",
    title:
      "Hat sich das Pressing verändert, und gewinnen Pressing-Teams häufiger?",
    description: "PPDA je Saison, Pressing gegen Punkte",
  },
  {
    id: "f12",
    page: "zeitverlauf",
    title: "Ist xG ein besserer Prädiktor als die Tabelle?",
    description: "Hinrunde gegen Rückrunde, Regression zur Mitte",
  },
];
export const questions = sections.filter((s) => /^f\d+$/.test(s.id));
