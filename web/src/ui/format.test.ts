import { it, expect } from "vitest";
import { number, percent, date, seasonLabel } from "./format";
it("formats German numbers", () => {
  expect(number(21589)).toBe("21.589");
  expect(number(2.5, 2)).toBe("2,50");
  expect(percent(44.24)).toBe("44,2\u00a0%");
});
it("formats dates and seasons", () => {
  expect(date("2026-11-12T10:00:00Z")).toBe("12.11.2026");
  expect(seasonLabel(2014)).toBe("14/15");
  expect(seasonLabel(2025)).toBe("25/26");
});
