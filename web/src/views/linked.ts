import { el, type Ctx } from "../ui/layout";
import { tile, renderTable } from "../ui/tile";
import { sourceFlow } from "../ui/source-flow";
import charts from "./linked-charts";
import explorer from "../ui/match-explorer";
export default function linked(ctx: Ctx) {
    const model = tile({ title: "Datenmodell", span: "full", source: "verknuepft", describe: { field: "Teamname, Koordinaten, Anstoßstunde", view: "Ablaufbild" } });
    model.body.append(el("p", "", "Der Teamname ordnet Spiele den Stadion-Stammdaten zu. Stadionkoordinaten und Anstoßstunde bestimmen die Wetterabfrage."), sourceFlow());
    const t = tile({ title: "Berechnete Felder", span: "two-thirds", source: "verknuepft", describe: { field: "travel_km, is_derby, w_temp_diff_away, ghost, strdiff", view: "Tabelle" } });
    const data = { headers: ["Feld", "Berechnung", "Grundlage", "Hinweis"], rows: [
            ["travel_km", "Haversine-Luftlinie, Erdradius 6371 km", "Wikidata-Koordinaten von Heim- und Gastteam", "Keine tatsächliche Reiseroute"],
            ["is_derby", "travel_km < 30 km", "Stadionkoordinaten", "Distanzregel, keine historische Einordnung"],
            ["w_temp_diff_away", "Temperatur Spielort minus Heimatort Gast zur gleichen Stunde", "Datei / Open-Meteo", "21.561 Werte aus der Datei, Rechenweg ungeklärt; 28 dort fehlende Werte nachträglich aus Open-Meteo berechnet"],
            ["ghost", "15.03.2020–30.06.2021", "Spieldatum", "Pauschale Regel, kein bestätigter Zuschauerstatus"],
            ["strdiff", "Mittlere saisonale xG-Differenz Heim minus Gast", "Understat, gesamte Saison", "Vor den UI-Filtern berechnet"]
        ] };
    t.body.append(renderTable(data));
    t.setTable(() => data);
    ctx.grid.append(model.el, t.el);
    charts(ctx);
    explorer(ctx);
}
