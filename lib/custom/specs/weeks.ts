/**
 * Your Life in Weeks: a birthday, the day it's counted to, 80 or 90 years,
 * and up to five milestones (a date and a short label). The day it's counted
 * to is part of the spec (never "today" at drawing time), so the same link
 * always draws the same print.
 */
import { FIRST_YEAR, LAST_YEAR, label, parseDate, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type Milestone = [date: string, label: string];
export interface Params {
  /** Birthday, "YYYY-MM-DD". */
  b: string;
  /** The day it's counted to ("as of"), "YYYY-MM-DD", on or after the birthday and inside the grid. */
  a: string;
  /** Rows: years of life drawn. */
  n: (typeof WEEKS_YEARS)[number];
  /** Milestones, in date order, one a day, inside the grid. */
  m?: Milestone[];
  w?: string;
}

export const NAME = "Your Life in Weeks";
export const WEEKS_YEARS = [80, 90] as const;
export const MILESTONES_MAX = 5;
export const MILESTONE_LABEL_MAX = 12;

const utc = ([y, mo, d]: [number, number, number]) => Date.UTC(y, mo - 1, d);
/** The first day past the grid: the birthday `n` years on (29 February lands on 1 March). */
export const gridEnd = (b: string, n: number) => {
  const [y, mo, d] = parseDate(b)!;
  return Date.UTC(y + n, mo - 1, d);
};
/** Why a date can't go on this grid, in one line, or null. */
export function weeksDateProblem(b: string, n: number, s: string): string | null {
  const d = parseDate(s);
  if (!d) return `A date from ${FIRST_YEAR} to ${LAST_YEAR}.`;
  if (utc(d) < utc(parseDate(b)!)) return "On or after the birthday";
  if (utc(d) >= gridEnd(b, n)) return `Within the ${n} years`;
  return null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!parseDate(p.b) || !WEEKS_YEARS.includes(p.n as never)) return null;
  const b = p.b as string;
  const n = p.n as Params["n"];
  if (typeof p.a !== "string" || weeksDateProblem(b, n, p.a)) return null;
  let m: { m?: Milestone[] } = {};
  if (p.m !== undefined) {
    if (!Array.isArray(p.m) || p.m.length < 1 || p.m.length > MILESTONES_MAX) return null;
    const out: Milestone[] = [];
    for (const e of p.m as unknown[]) {
      if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== "string" || weeksDateProblem(b, n, e[0]) || !label(e[1], MILESTONE_LABEL_MAX)) return null;
      // Date order, one a day: the one canonical spelling of a list.
      if (out.length && e[0] <= out[out.length - 1][0]) return null;
      out.push([e[0], e[1]]);
    }
    m = { m: out };
  }
  const w = wordsOf(p);
  if (!w) return null;
  return { b, a: p.a, n, ...m, ...w };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const weeksDay = (s: string) => {
  const [y, mo, d] = parseDate(s)!;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
};

export const detail = (p: Params) => p.w ?? weeksDay(p.b);

export const PRODUCT: ProductMeta<Params> = {
  line: "Every week of a life as a dot: the weeks lived filled in, the rest still open.",
  from: "A birthday and a few dates",
  group: "date",
  base: "matrix",
  bases: ["matrix", "type-data"],
  wordsHint: "Noa, so far",
  example: {
    b: "1990-03-14",
    a: "2026-09-29",
    n: 90,
    m: [
      ["2008-09-01", "University"],
      ["2014-06-21", "Married"],
      ["2017-02-08", "Maya"],
      ["2020-11-30", "Tel Aviv"],
    ],
  },
  hints: { dense: "Try fewer milestones.", faint: "Try a later day to count to." },
};
