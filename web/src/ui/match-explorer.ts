import { matchColumns, type Column } from "./match-columns";
import { csv } from "../charts/aggregate";
import { fmt } from "../charts/ec";
import { fields, sourceLinks, sources } from "../content/fields";
import { sortRows, type SortDir } from "../data/explore";
import { getSelection, setSelection } from "../state/selection";
import { dataStatus } from "../ui/data-status";
import { seasonLabel } from "../ui/format";
import { el, type Ctx } from "../ui/layout";
import { download, renderTable, tile } from "../ui/tile";
import { wikidata } from "../views/common";

export default function explorer(ctx: Ctx, options: {source?: "understat" | "verknuepft"; columns?: Column[]} = {}) {
  const pure = options.source === "understat";
  const makeTile: typeof tile = (o) => tile({
    ...o, source: options.source ?? "verknuepft",
    describe: { field: o.title === "Spieltabelle" || o.title === "Feldkatalog"
      ? (options.columns?.map(c => c.key).join(", ") ?? fields.map(f => f.field).join(", "))
      : o.title === "Team-Steckbrief" ? "team, venue, city, lat, lon, date, league, season" : o.title === "Quellen" ? "source, retrieval" : "status",
      view: "Tabelle" },
  });
  const d = ctx.dataset;
  const c = pure ? {...d.columns} : d.columns;
  if (pure) {
    for (const key of ["travel_km","strdiff","w_temp","w_wind","w_precip_2h","w_temp_diff_away"] as const) c[key] = new Float64Array(d.n).fill(NaN);
    for (const key of ["is_derby","ghost"] as const) c[key] = new Uint8Array(d.n).fill(255);
  }
  const kickoff = (i: number) => new Date(c.date[i]).toISOString().slice(0, 16).replace("T", " ");
  const columns = options.columns ?? matchColumns(ctx);
  const visible = new Set(columns.filter((col) => col.initial).map((col) => col.key));
  let sortKey = "date", sortDir: SortDir = -1, page = 0, pageSize = 25, query = "";
  let current: Uint32Array = new Uint32Array();

  // ---------- Spieltabelle ----------
  const table = makeTile({ title: "Spieltabelle", span: "full", filename: "spiele" });
  const toolbar = el("div", "toolbar");
  const search = el("input", "search");
  search.type = "search";
  search.placeholder = "Team suchen …";
  search.setAttribute("aria-label", "Nach Team suchen");
  const colsMenu = el("details", "columns-menu");
  colsMenu.append(el("summary", "", "Spalten"));
  const colsList = el("div", "columns-list");
  for (const col of columns) {
    const label = el("label");
    const box = el("input");
    box.type = "checkbox";
    box.checked = visible.has(col.key);
    box.addEventListener("change", () => { box.checked ? visible.add(col.key) : visible.delete(col.key); draw(); });
    label.append(box, document.createTextNode(col.label));
    colsList.append(label);
  }
  colsMenu.append(colsList);
  const sizeLabel = el("label", "", "Zeilen ");
  const size = el("select");
  for (const n of [25, 50, 100, 250]) size.append(new Option(String(n), String(n)));
  sizeLabel.append(size);
  const exportBtn = el("button", "primary", "Auswahl als CSV");
  exportBtn.type = "button";
  const info = el("output", "toolbar-info");
  toolbar.append(search, colsMenu, sizeLabel, exportBtn, info);
  const wrap = el("div", "table-wrap explorer-table");
  const pager = el("div", "pager");
  if (!pure) table.body.append(el("p", "muted", "U = Understat · W = Wikidata · OM = Open-Meteo · B = berechnet"));
  table.body.append(toolbar, wrap, pager);

  search.addEventListener("input", () => { query = search.value.trim().toLowerCase(); page = 0; refresh(); });
  size.addEventListener("change", () => { pageSize = Number(size.value); page = 0; draw(); });
  exportBtn.addEventListener("click", () => {
    const cols = columns.filter((col) => visible.has(col.key));
    download(csv([cols.map((col) => col.label), ...Array.from(current, (i) => cols.map((col) => col.show(i)))]), "text/csv;charset=utf-8", "spiele-auswahl.csv");
  });

  let base: Uint32Array = new Uint32Array();
  const refresh = () => {
    let rows = base;
    if (query) rows = Uint32Array.from(Array.from(rows).filter((i) => (d.teams[c.home_team[i]] ?? "").toLowerCase().includes(query) || (d.teams[c.away_team[i]] ?? "").toLowerCase().includes(query)));
    const col = columns.find((x) => x.key === sortKey)!;
    current = sortRows(rows, col.value, sortDir);
    draw();
  };
  const draw = () => {
    const cols = columns.filter((col) => visible.has(col.key));
    const pages = Math.max(1, Math.ceil(current.length / pageSize));
    page = Math.min(page, pages - 1);
    const t = el("table");
    const head = t.createTHead().insertRow();
    for (const col of cols) {
      const th = el("th");
      th.scope = "col";
      if (col.numeric) th.className = "num";
      const b = el("button", "sort", col.label);
      b.type = "button";
      th.setAttribute("aria-sort", col.key === sortKey ? (sortDir === 1 ? "ascending" : "descending") : "none");
      if (col.key === sortKey) b.dataset.dir = sortDir === 1 ? "▲" : "▼";
      b.addEventListener("click", () => {
        sortDir = sortKey === col.key ? ((-sortDir) as SortDir) : col.numeric || col.key === "date" ? -1 : 1;
        sortKey = col.key;
        refresh();
      });
      if (!pure) { const origin = ["w_temp","w_wind","w_precip_2h"].includes(col.key) ? ["OM","Open-Meteo"] : ["travel_km","is_derby","ghost","strdiff","w_temp_diff_away"].includes(col.key) ? ["B","berechnet"] : ["venue","city","lat","lon","wikidata"].includes(col.key) ? ["W","Wikidata"] : ["U","Understat"]; const badge = el("small", "", ` ${origin[0]}`); badge.title = origin[1]; b.append(badge); }
      th.append(b);
      head.append(th);
    }
    const body = t.createTBody();
    for (const i of current.subarray(page * pageSize, (page + 1) * pageSize)) {
      const tr = body.insertRow();
      tr.tabIndex = 0;
      tr.className = "clickable";
      tr.addEventListener("click", () => openDetail(i));
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(i); });
      for (const col of cols) {
        const td = tr.insertCell();
        td.textContent = col.show(i);
        if (col.numeric) td.className = "num";
      }
    }
    if (!current.length) {
      const td = body.insertRow().insertCell();
      td.colSpan = cols.length;
      td.className = "empty";
      td.textContent = "Keine Spiele für diese Auswahl. Filter oder Suche lockern.";
    }
    wrap.replaceChildren(t);
    pager.replaceChildren();
    const nav = (label: string, target: number, disabled: boolean, aria: string) => {
      const b = el("button", "", label);
      b.type = "button";
      b.disabled = disabled;
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", () => { page = target; draw(); });
      pager.append(b);
    };
    nav("«", 0, page === 0, "Erste Seite");
    nav("‹", page - 1, page === 0, "Vorherige Seite");
    pager.append(el("span", "pager-info", `Seite ${fmt(page + 1)} von ${fmt(pages)}`));
    nav("›", page + 1, page >= pages - 1, "Nächste Seite");
    nav("»", pages - 1, page >= pages - 1, "Letzte Seite");
    info.textContent = `${fmt(current.length)} Spiele`;
  };

  // ---------- Detailansicht ----------
  const drawer = el("aside", "drawer");
  drawer.setAttribute("aria-label", "Spieldetails");
  drawer.hidden = true;
  document.body.append(drawer);
  let lastFocus: HTMLElement | null = null;
  const closeDetail = () => { drawer.hidden = true; lastFocus?.focus(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDetail(); });
  const stadium = (team: string) => ctx.stadiums.find((s) => s.team === team);
  function openDetail(i: number) {
    lastFocus = document.activeElement as HTMLElement;
    const home = d.teams[c.home_team[i]], away = d.teams[c.away_team[i]];
    const head = el("div", "drawer-head");
    const h = el("h2", "", `${home} ${c.home_goals[i]} : ${c.away_goals[i]} ${away}`);
    const close = el("button", "", "Schließen");
    close.type = "button";
    close.addEventListener("click", closeDetail);
    head.append(h, close);
    const sub = el("p", "drawer-sub", `${ctx.leagueName(c.league[i])} · Saison ${seasonLabel(c.season[i])} · ${kickoff(i)} UTC`);
    const group = (title: string, badge: string, rows: [string, string | Node][]) => {
      const g = el("section", "detail-group");
      const gh = el("h3", "", title);
      gh.append(el("span", `source-badge source-${badge.toLowerCase().replace(/[^a-z]/g, "")}`, badge));
      const dl = el("dl");
      for (const [k, v] of rows) {
        const dd = el("dd");
        dd.append(typeof v === "string" ? document.createTextNode(v) : v);
        dl.append(el("dt", "", k), dd);
      }
      g.append(gh, dl);
      return g;
    };
    const f = (a: Float64Array, digits: number, unit = "") => (Number.isFinite(a[i]) ? `${fmt(a[i], digits)}${unit}` : "—");
    const pair = (a: Float64Array, digits = 2) => (Number.isFinite(a[i]) ? fmt(a[i], digits) : "—");
    const link = (href: string, text: string) => { const a = el("a", "", text); a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; };
    const place = (team: string) => {
      const s = stadium(team);
      if (!s) return "keine Stadiondaten";
      const span = el("span");
      span.append(`${s.venue}, ${s.city} (${fmt(s.lat, 3)}° N, ${fmt(s.lon, 3)}° O) `);
      const q = wikidata.get(team);
      if (q) span.append(link(`https://www.wikidata.org/wiki/${q}`, q));
      return span;
    };
    const understat = link(`https://understat.com/match/${c.game_id[i]}`, String(c.game_id[i]));
    const actions = el("div", "drawer-actions");
    for (const team of [home, away]) {
      const b = el("button", "", `${team} im Kreuzfilter wählen`);
      b.type = "button";
      b.addEventListener("click", () => { setSelection({ ...getSelection(), teams: [team] }); closeDetail(); });
      actions.append(b);
    }
    drawer.replaceChildren(
      head,
      sub,
      group("Spiel", "Understat", [
        ["Spiel-ID", understat],
        ["Tore", `${c.home_goals[i]} : ${c.away_goals[i]}`],
        ["Punkte", `${c.home_points[i]} : ${c.away_points[i]}`],
        ["xG", `${pair(c.home_xg)} : ${pair(c.away_xg)}`],
        ["xPTS", `${pair(c.home_xpts)} : ${pair(c.away_xpts)}`],
        ["PPDA", `${pair(c.home_ppda)} : ${pair(c.away_ppda)}`],
        ["Deep Completions", `${pair(c.home_deep, 0)} : ${pair(c.away_deep, 0)}`],
      ]),
      group("Spielorte", "Wikidata", [["Heimstadion", place(home)], ["Heimatstadion Gast", place(away)]]),
      group("Wetter am Spielort", "Open-Meteo", [
        ["Temperatur", f(c.w_temp, 1, " °C")],
        ["Wind", f(c.w_wind, 1, " km/h")],
        ["Niederschlag (2 h)", f(c.w_precip_2h, 1, " mm")],
      ]),
      group("Abgeleitet", "berechnet", [
        ["Reisedistanz", f(c.travel_km, 0, " km") + " Luftlinie"],
        ["Derby (< 30 km)", c.is_derby[i] === 255 ? "—" : c.is_derby[i] ? "ja" : "nein"],
        ["Temperaturdifferenz", f(c.w_temp_diff_away, 1, " °C") + " (Herkunft im Startbestand ungeklärt)"],
        ["Geisterspielzeitraum", c.ghost[i] ? "ja" : "nein"],
        ["Teamstärke-Differenz", f(c.strdiff, 2)],
      ]),
      actions,
    );
    if (pure) for (const group of Array.from(drawer.querySelectorAll(".detail-group")).slice(1)) group.remove();
    drawer.hidden = false;
    close.focus();
  }

  // ---------- Team-Steckbrief ----------
  const profile = makeTile({ title: "Team-Steckbrief", span: "third" });
  const pick = el("select", "team-pick");
  pick.setAttribute("aria-label", "Team auswählen");
  pick.append(new Option("Team auswählen …", ""));
  for (const t of [...d.teams].sort((a, b) => a.localeCompare(b, "de"))) pick.append(new Option(t, t));
  pick.addEventListener("change", () => setSelection({ ...getSelection(), teams: pick.value ? [pick.value] : [] }));
  const profileBody = el("div", "profile");
  profile.body.append(pick, profileBody);

  // ---------- Feldkatalog ----------
  const catalog = makeTile({ title: "Feldkatalog", span: "two-thirds", filename: "feldkatalog" });
  const catalogBody = el("div");
  catalog.body.append(catalogBody);

  // ---------- Quellen & Status ----------
  const src = makeTile({ title: "Quellen", span: "two-thirds" });
  src.body.append(renderTable({ headers: ["Quelle", "Daten", "Herkunft und Abgleich"], rows: sources }));
  const links = el("p", "links");
  for (const [label, href] of sourceLinks) { const a = el("a", "", label); a.href = href; a.target = "_blank"; a.rel = "noopener"; links.append(a); }
  src.body.append(links);
  const status = makeTile({ title: "Abrufstatus", span: "third" });
  const st = pure ? el("div") : dataStatus();
  st.className = "status-inner";
  st.querySelector("h2")?.remove();
  status.body.append(st);

  ctx.grid.append(table.el);
  if (!pure) ctx.grid.append(profile.el);
  ctx.grid.append(catalog.el);
  if (!pure) ctx.grid.append(src.el, status.el);

  ctx.onUpdate((rows) => {
    base = rows;
    page = 0;
    refresh();

    const sel = ctx.selection().teams;
    pick.value = sel.length === 1 ? sel[0] : "";
    profileBody.replaceChildren();
    if (sel.length !== 1) {
      profileBody.append(el("p", "muted", "Wählen Sie ein Team in der Liste, auf der Stadionkarte oder in den Spieldetails."));
    } else {
      const team = sel[0];
      const s = stadium(team);
      const ti = d.teams.indexOf(team);
      let homeN = 0, awayN = 0;
      const seasons = new Set<number>(), leagues = new Set<number>();
      for (const i of rows) {
        if (c.home_team[i] === ti) homeN++;
        else if (c.away_team[i] === ti) awayN++;
        seasons.add(c.season[i]);
        leagues.add(c.league[i]);
      }
      const dl = el("dl");
      const add = (k: string, v: string | Node) => { const dd = el("dd"); dd.append(v); dl.append(el("dt", "", k), dd); };
      add("Stadion", s ? s.venue : "—");
      add("Ort", s ? s.city : "—");
      add("Koordinaten", s ? `${fmt(s.lat, 4)}° N, ${fmt(s.lon, 4)}° O` : "—");
      const q = wikidata.get(team);
      if (q) { const a = el("a", "", q); a.href = `https://www.wikidata.org/wiki/${q}`; a.target = "_blank"; a.rel = "noopener"; add("Wikidata", a); }
      add("Spiele (Auswahl)", `${fmt(homeN + awayN)} · ${fmt(homeN)} Heim, ${fmt(awayN)} Gast`);
      const ss = [...seasons].sort();
      add("Saisons", ss.length ? `${seasonLabel(ss[0])} – ${seasonLabel(ss[ss.length - 1])} (${ss.length})` : "—");
      add("Ligen", [...leagues].map((l) => ctx.leagueName(l)).join(", ") || "—");
      profileBody.append(el("h3", "", team), dl);
    }

    const n = rows.length;
    const catalogRows = fields.filter(fi => !pure || options.columns?.some(c=>c.key===fi.field)).map((fi) => {
      const col = (c as Record<string, ArrayLike<number>>)[fi.field];
      let missing = 0;
      if (col) for (const i of rows) { const v = col[i]; if (v === 255 && (fi.field === "is_derby" || fi.field === "ghost")) missing++; else if (Number.isNaN(v)) missing++; }
      return [fi.field, fi.description, fi.unit, fi.origin, n ? Number(((missing / n) * 100).toFixed(1)) : null] as (string | number | null)[];
    });
    const data = { headers: ["Feld", "Bedeutung", "Einheit", "Herkunft", "Fehlend %"], rows: catalogRows };
    catalogBody.replaceChildren(renderTable(data));
    catalog.setTable(() => data);
  });
}
