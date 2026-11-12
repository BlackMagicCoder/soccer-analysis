import type { Section } from "../content/sections";
export function placeholder(s: Section) {
  const section = document.createElement("section");
  section.id = s.id;
  const h = document.createElement("h2");
  h.textContent =
    (/^f\d+$/.test(s.id) ? s.id.toUpperCase() + " · " : "") + s.title;
  const card = document.createElement("div");
  card.className = "placeholder";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Diagramm folgt";
  const p = document.createElement("p");
  p.textContent = s.description;
  card.append(label, p);
  section.append(h, card);
  return section;
}
