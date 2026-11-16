import { number } from "./format";
interface Status {
  available: boolean; n_matches: number; missing_weather: number; missing_coordinates: number;
  refresh: { state?: string; mode?: string; attempt_at?: string; success_at?: string; error?: string | null; warnings?: string[] };
  cache: { files: number; bytes: number; league_ttl_hours: number; weather_model: string; weather_delay_days: number };
}
export function dataStatus() {
  const section = document.createElement("section"); section.className = "card";
  const h = document.createElement("h2"); h.textContent = "Datenabruf und Zwischenspeicher";
  const output = document.createElement("p"); output.setAttribute("role", "status");
  const button = document.createElement("button"); button.type = "button"; button.textContent = "Status aktualisieren";
  const time = (v?: string) => v ? new Date(v).toLocaleString("de-DE") : "noch nicht erfolgt";
  const load = async () => {
    button.disabled = true; output.textContent = "Status wird geladen …";
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`Status nicht verfügbar (${response.status}).`);
      const s: Status = await response.json();
      const states: Record<string, string> = { running: "läuft", ok: "erfolgreich", partial: "teilweise abgeschlossen", error: "fehlgeschlagen" };
      const mode = s.refresh.mode === "weather" ? "Wetter-Nachladen" : "Quellenabgleich";
      const warnings = s.refresh.warnings ?? [];
      output.textContent = `${s.available ? `${number(s.n_matches)} Spiele verfügbar` : "Noch kein Datenbestand verfügbar"}. Fehlendes Wetter: ${number(s.missing_weather)}; fehlende Stadionkoordinaten: ${number(s.missing_coordinates)}. Letzter Lauf (${mode}): ${states[s.refresh.state ?? ""] ?? "noch nicht erfolgt"}. Letzter Versuch: ${time(s.refresh.attempt_at)}; letzter vollständiger Erfolg: ${time(s.refresh.success_at)}.${s.refresh.error ? ` Fehler: ${s.refresh.error}.` : ""}${warnings.length ? ` ${number(warnings.length)} Hinweise: ${warnings.slice(0, 3).join("; ")}${warnings.length > 3 ? "; weitere Hinweise im Laufprotokoll" : ""}.` : ""} Cache: ${number(s.cache.files)} Dateien, ${number(s.cache.bytes / 1024 / 1024, 1)} MB; Ligadaten ${s.cache.league_ttl_hours} h gültig; Wettermodell ${s.cache.weather_model}, Nachladeverzögerung ${s.cache.weather_delay_days} Tage.`;
    } catch (e) { output.textContent = e instanceof Error ? e.message : "Status konnte nicht geladen werden."; }
    finally { button.disabled = false; }
  };
  button.addEventListener("click", () => void load()); section.append(h, output, button); void load(); return section;
}
