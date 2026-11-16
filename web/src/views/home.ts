import { fmt } from "../charts/ec";
import { el, type Ctx } from "../ui/layout";
import { tile } from "../ui/tile";
import { sourceFlow } from "../ui/source-flow";
import { originOverview } from "../ui/origin";
import { understatColumnKeys, weatherColumnKeys, decodeOpenMeteo } from "../data/sources";
export default function home(ctx: Ctx) {
    const u = ctx.understat!, w = ctx.wikidataSource!, o = ctx.openmeteo!;
    const complete = decodeOpenMeteo(o).filter(r => [r.w_temp, r.w_wind, r.w_precip_2h].every(Number.isFinite)).length;
    ctx.grid.append(originOverview(fmt(u.n)));
    for (const [source, counts, keys, page, label] of [
        [u.source, `${fmt(u.n)} Spiele · ${fmt(u.teams.length)} Teams`, understatColumnKeys.join(", "), "spieldaten", "Spieldaten"],
        [w.source, `${w.n_teams} Teams · ${w.n_venues} Stadien · ${w.stadiums.filter(s => s.wikidata).length} mit Wikidata-ID`, "team, venue, city, lat, lon, wikidata", "stadien", "Stadien"],
        [o.source, `${fmt(o.n)} Abfragen · ${fmt(complete)} vollständig`, weatherColumnKeys.join(", "), "wetter", "Wetter"]
    ] as const) {
        const t = tile({ title: source.name, span: "third" });
        const dl = el("dl");
        for (const [k, v] of [["Inhalt", source.content], ["Datensätze", counts], ["Felder", keys], ["Abrufweg", source.retrieval], ["Lizenz", source.license]])
            dl.append(el("dt", "", k), el("dd", "", v));
        const a = el("a", "", `Zur Seite ${label}`);
        a.href = `${page}.html`;
        const b = el("a", "", "Zur Quelle");
        b.href = source.url;
        b.target = "_blank";
        b.rel = "noopener";
        const links = el("p", "links");
        links.append(a, b);
        t.body.append(dl, links);
        ctx.grid.append(t.el);
    }
    const flow = tile({ title: "Vom Rohzustand zur Auswertung", span: "full" });
    flow.body.append(sourceFlow());
    const note = tile({ title: "So sind die Seiten aufgebaut", span: "full" });
    note.body.append(el("p", "", "Die Seiten unter Datenbasis zeigen jeweils genau eine Quelle. Fußzeilen nennen Quelle, Feld und Darstellung. Verknüpfte und berechnete Inhalte stehen unter Verknüpfte Daten im Bereich Auswertung."));
    ctx.grid.append(flow.el, note.el);
}
