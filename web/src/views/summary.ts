import { el, type Ctx } from "../ui/layout";
import { tile } from "../ui/tile";

export default function summary(ctx: Ctx) {
  const t = tile({ title: "Stand", span: "two-thirds" });
  t.body.append(
    el("p", "", "Die Datenbasis ist verfügbar: Übersicht, Spieldaten, Stadien und Wetter zeigen jede Quelle einzeln, Verknüpfte Daten den zusammengeführten Bestand."),
    el("p", "muted", "Die fachliche Zusammenfassung der zwölf Fragen folgt nach der Auswertung, frühestens ab 15.12.2026."),
  );
  ctx.grid.append(t.el);
}
