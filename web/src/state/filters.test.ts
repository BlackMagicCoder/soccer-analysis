import { describe, it, expect, vi } from "vitest";
import {
  initializeFilters, setFilter, getFilter,
  defaults,
  parseFilter,
  serializeFilter,
  toModelsQuery,
  filterKey,
} from "./filters";
import { generateMock } from "../../mock/plugin";
const m = generateMock().meta;
describe("filters", () => {
  it("omits defaults", () => {
    expect(serializeFilter(defaults(m), m)).toBe("");
    expect(parseFilter("", m)).toEqual(defaults(m));
  });
  it("round trips a selection", () => {
    const f = {
      leagues: [1, 3],
      seasonFrom: 2016,
      seasonTo: 2022,
      ghost: "exclude" as const,
    };
    expect(serializeFilter(f, m)).toBe("?l=1,3&von=2016&bis=2022&geister=ohne");
    expect(parseFilter(serializeFilter(f, m), m)).toEqual(f);
  });
  it("falls back on invalid values", () => {
    for (const search of [
      "?l=&von=no&bis=2030&geister=bad",
      "?l=9&von=2014.5&bis=0",
      "?l=1,no",
    ])
      expect(parseFilter(search, m)).toEqual(defaults(m));
  });
  it("swaps reversed seasons", () => {
    expect(parseFilter("?von=2022&bis=2016", m)).toMatchObject({
      seasonFrom: 2016,
      seasonTo: 2022,
    });
  });
  it("produces the models query and stable keys", () => {
    const f = { ...defaults(m), leagues: [3, 1], ghost: "only" as const };
    expect(new URLSearchParams(toModelsQuery(f))).toEqual(
      new URLSearchParams(
        "leagues=1%2C3&season_from=2014&season_to=2025&ghost=only",
      ),
    );
    expect(filterKey(f)).toBe(filterKey({ ...f, leagues: [1, 3] }));
  });
});

it("preserves the ignored ghost URL parameter on source pages", () => {
 const loc={pathname:"/spieldaten.html",search:"?geister=nur&custom=keep",hash:""};
 vi.stubGlobal("location",loc);
 vi.stubGlobal("history",{replaceState:(_a:unknown,_b:unknown,url:string)=>{loc.search=new URL(url,"http://localhost").search;}});
 try {
  initializeFilters(m,{ghost:false});
  expect(getFilter().ghost).toBe("include");
  setFilter({leagues:[1],ghost:"exclude"});
  expect(new URLSearchParams(loc.search).get("geister")).toBe("nur");
  expect(new URLSearchParams(loc.search).get("custom")).toBe("keep");
  expect(getFilter().ghost).toBe("include");
  setFilter(defaults(m));
  expect(new URLSearchParams(loc.search).get("geister")).toBe("nur");
 } finally { vi.unstubAllGlobals(); }
});
