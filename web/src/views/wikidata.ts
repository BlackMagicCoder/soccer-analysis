import { el, type Ctx } from "../ui/layout";
import { kpi, tile, renderTable } from "../ui/tile";
import { sourceTable } from "../ui/source-table";
import { originTile } from "../ui/origin";
import { decodeWikidata } from "../data/sources";
import { base, ensureEuropeMap } from "../charts/ec";
export default function wikidata(ctx: Ctx) {
    const r = ctx.wikidataSource!, rows = decodeWikidata(r), band = el("div", "kpis span-full");
    for (const [name, value] of [["Teams", r.n_teams], ["Stadien", r.n_venues], ["Mit Wikidata-ID", rows.filter(s => s.wikidata).length]] as const) {
        const k = kpi(name);
        k.set(String(value));
        band.append(k.el);
    }
    ctx.grid.append(originTile("wikidata"), band);
    const table = sourceTable({ title: "Stadiontabelle", span: "full", source: "wikidata", describe: { field: "team, venue, city, lat, lon, wikidata", view: "Tabelle" } }, ["Team", "Stadion", "Ort", "Breite", "Länge", "Wikidata-ID"], () => rows.map(s => [s.team, s.venue, s.city, Number.isFinite(s.lat) ? s.lat : null, Number.isFinite(s.lon) ? s.lon : null, s.wikidata ?? null]), 5);
    const map = tile({ title: "Stadien", span: "two-thirds", chartHeight: 460, source: "wikidata", describe: { field: "team, venue, city, lat, lon, wikidata", view: "Karte mit gleich großen Punkten" } });
    ctx.grid.append(map.el);
    ensureEuropeMap();
    map.chart!.setOption(base({ tooltip: { trigger: "item", renderMode: "richText", formatter: (p: unknown) => { const s = (p as {
                data: {
                    index: number;
                };
            }).data; const r = rows[s.index]; return `${r.team}\n${r.venue}, ${r.city}\n${r.lat}, ${r.lon}\n${r.wikidata ?? "Keine Wikidata-ID"}`; } }, geo: { map: "europe", roam: true, center: [3.5, 46.5], zoom: 6, scaleLimit: { min: 2, max: 40 }, itemStyle: { areaColor: "#e4e8dd", borderColor: "#aeb7a8" } }, series: [{ type: "scatter", coordinateSystem: "geo", symbolSize: 8, itemStyle: { color: "#8a3b33" }, data: rows.flatMap((s, i) => Number.isFinite(s.lat) && Number.isFinite(s.lon) ? [{ name: s.team, value: [s.lon, s.lat], index: i }] : []) }] }));
    map.chart!.on("click", p => table.select(p.name));
    map.setTable(() => ({ headers: ["Team", "Stadion", "Breite", "Länge"], rows: rows.map(s => [s.team, s.venue, s.lat, s.lon]) }));
    const shared = tile({ title: "Gemeinsam genutzte Stadien", span: "third", source: "wikidata", describe: { field: "team, venue, wikidata", view: "Tabelle" } });
    const venues = new Map<string, typeof rows>();
    for (const s of rows) {
        const key = s.wikidata ?? `${s.lat}|${s.lon}|${s.venue}`;
        venues.set(key, [...(venues.get(key) ?? []), s]);
    }
    const data = { headers: ["Stadion", "Teams"], rows: [...venues.values()].filter(g => g.length > 1).map(g => [g[0].venue, g.map(s => s.team).join(", ")]) };
    shared.body.append(renderTable(data));
    shared.setTable(() => data);
    const hints = tile({ title: "Hinweise", span: "third", source: "wikidata", describe: { field: "city, venue, team, wikidata", view: "Text" } });
    for (const text of ["Die Ort-Spalte entspricht nur bei 125 von 168 Teams der heutigen Wikidata-Angabe.", "Ein aktuelles Stadion je Team, ohne Historie.", "Der Teamname ist der Schlüssel zu den Spieldaten.", "Almería (Q3773347) hat keine deutsche Bezeichnung.", "San Mamés hat zwei Objekte; zugeordnet ist Q182864."])
        hints.body.append(el("p", "", text));
    const catalog = tile({ title: "Feldkatalog Wikidata", span: "two-thirds", source: "wikidata", describe: { field: "team, venue, city, lat, lon, wikidata", view: "Tabelle" } });
    const fields = { headers: ["Feld", "Bedeutung"], rows: [["team", "Teamname als Zuordnungsschlüssel"], ["venue", "Stadionname"], ["city", "Ort im Ausgangsbestand"], ["lat", "Geografische Breite in Grad"], ["lon", "Geografische Länge in Grad"], ["wikidata", "Wikidata-Objektkennung des Stadions"]] };
    catalog.body.append(renderTable(fields));
    catalog.setTable(() => fields);
    ctx.grid.append(map.el, shared.el, table.el, hints.el, catalog.el);
}
