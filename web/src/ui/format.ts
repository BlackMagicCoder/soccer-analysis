export const number = (n: number, digits = 0) =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
export const percent = (n: number) => number(n, 1) + "\u00a0%";
export const date = (s: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(s));
export const seasonLabel = (year: number) =>
  String(year).slice(-2) + "/" + String(year + 1).slice(-2);
