import { questions } from "../content/sections";
import { el, type Ctx } from "../ui/layout";
import { renderTable, tile } from "../ui/tile";

export default function questionsView(ctx: Ctx) {
  const list = tile({ title: "Fragen für die spätere Auswertung", span: "two-thirds", filename: "fragen" });
  const data = { headers: ["Nr.", "Frage", "Bearbeitung"], rows: questions.map((q) => [q.id.toUpperCase(), q.title, "frühestens ab 15.12.2026"]) };
  list.body.append(renderTable(data));
  list.setTable(() => data);

  const derived = tile({ title: "Aus den Daten berechnete Größen", span: "third" });
  derived.el.classList.add("derived-box");
  derived.body.append(el("p", "muted", "Diese Größen stammen nicht direkt aus einer Quelle, sondern werden aus vorhandenen Quellspalten abgeleitet. Für die Fragen werden nur die vorhandenen Werte genutzt; es wird nichts neu abgerufen."));
  const dl = el("dl");
  for (const [name, text] of [
    ["Reisedistanz (travel_km)", "Luftlinie zwischen Heimstadion und Heimatstadion des Gastteams, berechnet aus den Wikidata-Stadionkoordinaten. Genutzt in F5 und F6."],
    ["Derby (is_derby)", "1, wenn die Reisedistanz unter 30 km liegt. Genutzt in F7."],
    ["Temperaturdifferenz (w_temp_diff_away)", "Temperatur am Spielort minus Temperatur am Heimatort des Gastteams zur gleichen Stunde. 21.561 Werte stammen aus der Datei Match_statistics_enriched.parquet; wie sie dort berechnet wurden, ließ sich mit Open-Meteo nicht nachvollziehen. Bei 28 Spielen fehlt die Differenz in der Datei; sie wurde nachträglich aus Open-Meteo-Stundenwerten berechnet und stammt damit nicht direkt aus einer Quelle. Genutzt in F4 und F8."],
  ]) dl.append(el("dt", "", name), el("dd", "", text));
  derived.body.append(dl);
  const link = el("a", "", "Details unter Verknüpfte Daten"); link.href = "verknuepft.html"; derived.body.append(link);
  ctx.grid.append(list.el, derived.el);
}
