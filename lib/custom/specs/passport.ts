/**
 * Your Passport: a page of entry stamps. Up to PASSPORT_MAX stamps, each a
 * country (of data/countries, by its alpha-3 code), the day (optional) and
 * how you came (by air, or by train), scattered over a fine guilloche grid
 * with the name at the head of the page. The layout is seeded by the list,
 * so the same stamps land in the same places on every device. Not any
 * country's data page: no emblem, no machine-readable lines. Drawn by
 * lib/custom/templates/passport.
 */
import { label, parseDate, type Cap, type CapRule } from "../specKit";
import { COUNTRY_CODES } from "./countries";
import type { CheckContext, ProductMeta } from "./types";

/** A stamp: the country, the day (0 for none when a train follows), and 1 when it came by train (absent: by air). */
export type Stamp = [a3: string, d?: string | 0, train?: 1];

export interface Params {
  /** Whose page. */
  n: string;
  x: Stamp[];
  cap?: Cap;
}

export const NAME = "Your Passport";
export const PASSPORT_NAME_MAX = 18;
export const PASSPORT_MAX = 10;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

function stamp(e: unknown): Stamp | null {
  if (!Array.isArray(e) || e.length < 1 || e.length > 3) return null;
  const [a3, d, t] = e as unknown[];
  if (typeof a3 !== "string" || !(COUNTRY_CODES as readonly string[]).includes(a3)) return null;
  // One spelling each: [a3], [a3, day], [a3, day, 1], and [a3, 0, 1] for a train on no day.
  if (e.length === 3 && t !== 1) return null;
  const noDay = e.length === 3 && d === 0;
  if (e.length >= 2 && !noDay && (typeof d !== "string" || !parseDate(d))) return null;
  return e.length === 3 ? [a3, noDay ? 0 : (d as string), 1] : e.length === 2 ? [a3, d as string] : [a3];
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, PASSPORT_NAME_MAX)) return null;
  if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > PASSPORT_MAX) return null;
  const x: Stamp[] = [];
  for (const e of p.x as unknown[]) {
    const s = stamp(e);
    if (!s) return null;
    x.push(s);
  }
  return { n: p.n as string, x };
}

export const detail = (p: Params) => `${p.x.length} ${p.x.length === 1 ? "stamp" : "stamps"}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "A page of entry stamps, one for every border that let you in.",
  from: "The countries you’ve been stamped into",
  group: "travels",
  base: "guilloche",
  bases: ["guilloche", "terminal-data"],
  wordsHint: "Noa Cohen",
  hints: { dense: "Try fewer stamps.", faint: "Try another stamp or two." },
  example: { n: "Noa Cohen", x: [["JPN", "2019-04-12"], ["FRA", "2014-07-30", 1], ["GBR", "2011-09-03"], ["ITA", "2009-05-21", 1], ["USA", "2016-12-19"], ["GRC", "2021-08-08"], ["THA", "2023-02-14"]] },
};
