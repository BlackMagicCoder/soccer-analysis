import { el } from "./layout";
import { tile, renderTable, type TileOptions } from "./tile";
import { sortRows } from "../data/explore";
export function sourceTable(o: TileOptions, headers: string[], getRows: () => (string | number | null)[][], linkColumn = -1) {
    const t = tile(o), search = el("input", "search"), wrap = el("div"), pager = el("div", "pager");
    search.type = "search";
    search.placeholder = "Tabelle durchsuchen …";
    search.setAttribute("aria-label", "Tabelle durchsuchen");
    let page = 0, sort = 0, dir: 1 | -1 = 1, selected = "";
    const draw = () => {
        const all = getRows().filter(r => r.some(v => String(v ?? "").toLowerCase().includes(search.value.toLowerCase())));
        const indices = sortRows(Uint32Array.from(all, (_, i) => i), i => all[i][sort] ?? NaN, dir);
        const rows = Array.from(indices, i => all[i]);
        page = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
        const data = { headers, rows };
        t.setTable(() => data);
        const table = renderTable({ headers, rows: rows.slice(page * 25, (page + 1) * 25) });
        table.querySelectorAll("th").forEach((th, i) => { const b = el("button", "sort", headers[i]); b.onclick = () => { dir = sort === i && dir === 1 ? -1 : 1; sort = i; draw(); }; th.replaceChildren(b); th.setAttribute("aria-sort", sort === i ? dir === 1 ? "ascending" : "descending" : "none"); });
        table.querySelectorAll("tbody tr").forEach((tr, i) => { const r = rows[page * 25 + i]; if (String(r[0]) === selected)
            tr.classList.add("selected-row"); if (linkColumn >= 0 && r[linkColumn]) {
            const a = el("a", "", String(r[linkColumn]));
            a.href = `https://www.wikidata.org/wiki/${r[linkColumn]}`;
            a.target = "_blank";
            a.rel = "noopener";
            tr.children[linkColumn].replaceChildren(a);
        } });
        wrap.replaceChildren(table);
        pager.replaceChildren();
        for (const [label, delta] of [["Vorherige Seite", -1], ["Nächste Seite", 1]] as const) {
            const b = el("button", "", label);
            b.disabled = delta < 0 ? page === 0 : (page + 1) * 25 >= rows.length;
            b.onclick = () => { page += delta; draw(); };
            pager.append(b);
        }
        pager.append(el("span", "", `Seite ${page + 1} · ${rows.length} Zeilen`));
    };
    search.oninput = () => { page = 0; draw(); };
    t.body.append(search, wrap, pager);
    draw();
    return { ...t, refresh: draw, select: (value: string) => { selected = value; search.value = value; page = 0; draw(); } };
}
