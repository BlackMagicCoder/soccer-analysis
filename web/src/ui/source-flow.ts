import { el } from "./layout";
export function sourceFlow() {
    const flow = el("div", "source-flow");
    const sources = el("div", "flow-sources");
    for (const name of ["Understat: Spielstatistiken", "Wikidata: Stadion-Stammdaten", "Open-Meteo: Wetterabfragen"])
        sources.append(el("div", "flow-box", name));
    const join = el("div", "flow-box");
    join.append(el("strong", "", "Verknüpfung"), el("p", "", "Teamname → Stadion"), el("p", "", "Stadionkoordinaten + Anstoßstunde → Wetterabfrage"));
    flow.append(sources, el("span", "flow-arrow", "→"), join, el("span", "flow-arrow", "→"), el("div", "flow-box", "Verknüpfte Spieltabelle"), el("span", "flow-arrow", "→"), el("a", "flow-box", "Fragen"));
    (flow.lastElementChild as HTMLAnchorElement).href = "fragen.html";
    return flow;
}
