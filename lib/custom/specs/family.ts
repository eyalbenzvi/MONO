/**
 * Your Family Tree: a name in the middle, then parents, grandparents and
 * (optionally) great-grandparents, each generation a ring of the fan chart.
 * The names are in pedigree order (Ahnentafel less one: 0 you, 1 father,
 * 2 mother, 3 father's father …, a person's parents at 2i + 1 and 2i + 2),
 * seven for three generations, fifteen for four; a blank is "" and prints
 * hatched. Years, when any are given, travel packed (born and died a slot,
 * 0 for none, else the year less 1599).
 */
import { label, unpackInts, wordsOf, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** 7 or 15 names in pedigree order; "" for a blank slot; the first (you) never blank. */
  n: string[];
  /** Years: packInts of born, died per slot (0 none, else year − YEAR_BASE). Absent when there are none. */
  y?: string;
  w?: string;
  cap?: Cap;
}

export const NAME = "Your Family Tree";
export const FAMILY_NAME_MAX = 14;
export const FIRST_BORN = 1600;
export const LAST_BORN = 2100;
/** Longest life the years may span. */
export const LIFE_MAX = 120;
const YEAR_BASE = FIRST_BORN - 1;
export type Years = [born: number | null, died: number | null];

/** Why a pair of years can't go on the tree, in one line, or null. */
export function yearsProblem([b, d]: Years): string | null {
  const bad = (v: number | null) => v !== null && (!Number.isInteger(v) || v < FIRST_BORN || v > LAST_BORN);
  if (bad(b) || bad(d)) return `Years between ${FIRST_BORN} and ${LAST_BORN}`;
  if (b !== null && d !== null && (d < b || d - b > LIFE_MAX)) return "Born before died, within 120 years";
  return null;
}

/** Years as typed ("1932", "1932–2010", "–2010", "1932-"), or null when they don't read as years; empty is [null, null]. */
export function parseYears(s: string): Years | null {
  const t = s.replace(/\s+/g, "");
  if (!t) return [null, null];
  const m = /^(\d{4})?(?:[-–—](\d{4})?)?$/.exec(t);
  if (!m || (!m[1] && !m[2])) return null;
  return [m[1] ? Number(m[1]) : null, m[2] ? Number(m[2]) : null];
}

/** Years as the print writes them: "1932–2010", "b. 1932", "d. 2010", or "". */
export const yearsText = ([b, d]: Years) => (b !== null && d !== null ? `${b}–${d}` : b !== null ? `b. ${b}` : d !== null ? `d. ${d}` : "");

/** The packed years read back, one pair a slot (checked against the names by `check`). */
export function familyYears(p: Params): Years[] {
  const v = p.y ? (unpackInts(p.y, 64) ?? []) : [];
  return p.n.map((_, i) => [v[2 * i] ? v[2 * i] + YEAR_BASE : null, v[2 * i + 1] ? v[2 * i + 1] + YEAR_BASE : null]);
}
/** Years a slot to the packed ints (0 none). */
export const packYears = (ys: readonly Years[]) => ys.flatMap(([b, d]) => [b === null ? 0 : b - YEAR_BASE, d === null ? 0 : d - YEAR_BASE]);

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };
/** The words (`w`) were the caption's title: the editor now writes cap[0]. */
export const WORDS_TITLE = true;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!Array.isArray(p.n) || (p.n.length !== 7 && p.n.length !== 15)) return null;
  const n = p.n as unknown[];
  if (!n.every((s) => s === "" || label(s, FAMILY_NAME_MAX)) || n[0] === "") return null;
  const names = n as string[];
  let y: { y?: string } = {};
  if (p.y !== undefined) {
    const v = unpackInts(p.y, 64);
    if (!v || v.length !== 2 * names.length || v.every((x) => x === 0)) return null;
    for (let i = 0; i < names.length; i++) {
      const [b, d] = [v[2 * i], v[2 * i + 1]];
      if (b < 0 || d < 0) return null;
      // Years only beside a name.
      if (!names[i] && (b || d)) return null;
      if (yearsProblem([b ? b + YEAR_BASE : null, d ? d + YEAR_BASE : null])) return null;
    }
    y = { y: p.y as string };
  }
  const w = wordsOf(p);
  if (!w) return null;
  return { n: [...names], ...y, ...w };
}

export const detail = (p: Params) => p.w ?? p.n[0];

export const PRODUCT: ProductMeta<Params> = {
  line: "A fan chart of your family: you in the middle, each generation a ring further out.",
  from: "Your family’s names",
  group: "people",
  base: "concentric",
  bases: ["concentric", "rosette"],
  wordsHint: "The Levins",
  example: {
    n: ["Noa Levin", "David Levin", "Ruth Adler", "Aron Levin", "Miriam Katz", "Josef Adler", "Hanna Weiss", "Samuel Levin", "", "Isaak Katz", "Rosa Stern", "Karl Adler", "Frieda Roth", "", "Ida Blum"],
    y: "kAYAzgUA1AUAjgWqBpQFwAaKBY4GlgXIBtYE6AUAANwEsgXgBIoG0ATSBdgE8AUAAN4EmgY",
    w: "The Levins",
  },
  hints: { dense: "Try fewer years, or three generations.", faint: "Try adding a few more names." },
};
