import { renderWorkshop } from "../charts/workshop";
import type { Ctx } from "../ui/layout";
import { tile } from "../ui/tile";

export default function workshop(ctx: Ctx) {
  const t = tile({ title: "Frühere SVG-Bausteine (Welle 2)", span: "full" });
  const root = document.createElement("div");
  root.className = "chart-workshop";
  t.body.append(root);
  ctx.grid.append(t.el);
  ctx.onUpdate((rows) => renderWorkshop(root, ctx.dataset, rows, ctx.meta));
}
