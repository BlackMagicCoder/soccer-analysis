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
          "Die API ist nicht erreichbar. Läuft der Server? Start: uv run uvicorn soccer_api.main:app --port 8000",
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
export const getStadiums = () => get<StadiumsResponse>("/api/stadiums");
export const getModels = (f: Filter) =>
  get<ModelsResponse>("/api/models" + toModelsQuery(f));
