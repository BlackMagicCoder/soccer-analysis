import type {
  MetaResponse,
  MatchesResponse,
  StadiumsResponse,
  ModelsResponse,
  Filter,
} from "./types";
import { toModelsQuery } from "../state/filters";
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}
const cache = new Map<string, Promise<unknown>>();
function get<T>(url: string): Promise<T> {
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        throw new ApiError(
          0,
          "Die API ist nicht erreichbar. Läuft der Server? Start: uv run uvicorn soccer_api.main:app --host 127.0.0.1 --port 8010",
        );
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          body.detail ?? `API-Fehler (${response.status})`,
        );
      }
      return response.json();
    })();
    cache.set(url, pending);
    pending.catch(() => cache.delete(url));
  }
  return pending as Promise<T>;
}
export const getMeta = () => get<MetaResponse>("/api/meta");
export const getMatches = () => get<MatchesResponse>("/api/matches");
export async function getDatasetSnapshot(): Promise<{
  meta: MetaResponse;
  matches: MatchesResponse;
}> {
  // A refresh can replace SQLite between requests. Never combine different versions.
  for (let attempt = 0; attempt < 3; attempt++) {
    cache.clear();
    const [meta, matches] = await Promise.all([getMeta(), getMatches()]);
    if (meta.data_version === matches.data_version) return { meta, matches };
  }
  cache.clear();
  throw new ApiError(
    409,
    "Die Daten werden gerade aktualisiert. Ein einheitlicher Datenstand konnte nicht geladen werden. Bitte die Seite erneut laden.",
  );
}
export const getStadiums = () => get<StadiumsResponse>("/api/stadiums");
export const getModels = (f: Filter) =>
  get<ModelsResponse>("/api/models" + toModelsQuery(f));

export const getUnderstat = () => get<import("./types").UnderstatResponse>("/api/source/understat");
export const getWikidata = () => get<import("./types").WikidataResponse>("/api/source/wikidata");
export const getOpenMeteo = () => get<import("./types").OpenMeteoResponse>("/api/source/open-meteo");
