export type GhostMode = "include" | "exclude" | "only";
export interface Filter {
  leagues: number[];
  seasonFrom: number;
  seasonTo: number;
  ghost: GhostMode;
}
export interface MetaResponse {
  data_version: number;
  updated_at: string;
  n_matches: number;
  n_teams: number;
  n_stadiums: number;
  date_min: string;
  date_max: string;
  analysis_end?: string;
  latest_season?: number;
  seasons: number[];
  leagues: { id: number; key: string; name: string }[];
  ghost_period: [string, string];
}
export const integerColumns = [
  "game_id",
  "league",
  "season",
  "home_team",
  "away_team",
  "home_goals",
  "away_goals",
  "home_points",
  "away_points",
] as const;
export const flagColumns = ["is_derby", "ghost"] as const;
export const numericColumns = [
  "home_xg",
  "away_xg",
  "home_xpts",
  "away_xpts",
  "home_ppda",
  "away_ppda",
  "home_deep",
  "away_deep",
  "travel_km",
  "strdiff",
  "w_temp",
  "w_wind",
  "w_precip_2h",
  "w_temp_diff_away",
] as const;
export type IntegerColumn = (typeof integerColumns)[number];
export type FlagColumn = (typeof flagColumns)[number];
export type NumericColumn = (typeof numericColumns)[number];
export interface MatchesResponse {
  data_version: number;
  n: number;
  teams: string[];
  columns: Record<IntegerColumn, number[]> & Record<FlagColumn, (number | null)[]> &
    Record<NumericColumn, (number | null)[]> & { date: string[] };
}
export interface StadiumsResponse {
  data_version: number;
  stadiums: {
    team: string;
    league: number;
    venue: string;
    city: string;
    lat: number;
    lon: number;
  }[];
}
export interface ModelTerm {
  name: string;
  coef: number;
  p: number;
  effect_pct?: number;
  odds_ratio?: number;
}
export interface ModelsResponse {
  data_version: number;
  filter: {
    leagues: number[];
    season_from: number;
    season_to: number;
    ghost: GhostMode;
  };
  n: number;
  models: Record<
    string,
    {
      kind: "poisson" | "logit" | "ols";
      outcome: string;
      n: number;
      controls: string[];
      terms: ModelTerm[];
    }
  >;
  errors: Record<string, string>;
}

export interface SourceInfo { name: string; url: string; content: string; retrieval: string; license: string }
export type UnderstatNumeric = IntegerColumn | "home_xg" | "away_xg" | "home_xpts" | "away_xpts" | "home_ppda" | "away_ppda" | "home_deep" | "away_deep";
export interface UnderstatResponse { data_version: number; n: number; source: SourceInfo; teams: string[]; columns: Record<UnderstatNumeric, (number | null)[]> & {date: string[]} }
export interface WikidataResponse { data_version: number; n_teams: number; n_venues: number; source: SourceInfo; stadiums: {team: string; venue: string; city: string; lat: number | null; lon: number | null; wikidata: string | null}[] }
export interface OpenMeteoResponse { data_version: number; n: number; source: SourceInfo; query: {endpoint: string; model: string; variables: {w_temp: string; w_wind: string; w_precip_2h: string}; timezone: string; delay_days: number}; columns: {time: string[]; lat: (number|null)[]; lon: (number|null)[]; w_temp: (number|null)[]; w_wind: (number|null)[]; w_precip_2h: (number|null)[]}; example: {latitude: number; longitude: number; timezone: string; hourly_units: Record<string, unknown>; hourly: Record<string, unknown[]>; truncated: true} | null }
