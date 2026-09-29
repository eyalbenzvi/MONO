/**
 * Your Tree Rings: the years from a birth year to this one, each marked
 * good, normal or hard (one base-3 digit a year: 0 hard, 1 normal, 2 good),
 * and up to three scars (a fire, a break) in years of the span.
 */
import { FIRST_YEAR, LAST_YEAR, int, wordsOf, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The first year (the pith). */
  b: number;
  /** The last year (the bark), at most RINGS_SPAN after the first. */
  c: number;
  /** One digit a year, first to last: 0 hard, 1 normal, 2 good. */
  m: string;
  /** Scarred years, in order, inside the span. */
  s?: number[];
  w?: string;
  cap?: Cap;
}

export const NAME = "Your Tree Rings";
/** At most this many years after the first: 101 rings. */
export const RINGS_SPAN = 100;
export const SCARS_MAX = 3;
export type YearMark = "hard" | "normal" | "good";
export const MARK_DIGIT: Record<YearMark, string> = { hard: "0", normal: "1", good: "2" };

/** Why this span can't be drawn, in one line, or null. */
export function spanProblem(b: number, c: number): string | null {
  if (!int(b, FIRST_YEAR, LAST_YEAR)) return `A year from ${FIRST_YEAR} to ${LAST_YEAR}.`;
  if (!int(c, FIRST_YEAR, LAST_YEAR)) return `A year from ${FIRST_YEAR} to ${LAST_YEAR}.`;
  if (c < b) return "The same year or later";
  return c - b > RINGS_SPAN ? `Up to ${RINGS_SPAN + 1} years` : null;
}

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };
/** The words (`w`) were the caption's title: the editor now writes cap[0]. */
export const WORDS_TITLE = true;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (typeof p.b !== "number" || typeof p.c !== "number" || spanProblem(p.b, p.c)) return null;
  const [b, c] = [p.b, p.c];
  if (typeof p.m !== "string" || p.m.length !== c - b + 1 || !/^[012]+$/.test(p.m)) return null;
  let s: { s?: number[] } = {};
  if (p.s !== undefined) {
    if (!Array.isArray(p.s) || p.s.length < 1 || p.s.length > SCARS_MAX) return null;
    const ys = p.s as unknown[];
    if (!ys.every((y, i) => int(y, b, c) && (i === 0 || (y as number) > (ys[i - 1] as number)))) return null;
    s = { s: [...(ys as number[])] };
  }
  const w = wordsOf(p);
  if (!w) return null;
  return { b, c, m: p.m, ...s, ...w };
}

export const detail = (p: Params) => p.w ?? (p.b === p.c ? String(p.b) : `${p.b}–${p.c}`);

export const PRODUCT: ProductMeta<Params> = {
  line: "Your years as tree rings: wide for good, narrow for hard.",
  from: "Your years, good and hard",
  group: "date",
  base: "concentric",
  wordsHint: "Noa, so far",
  example: { b: 1988, c: 2026, m: "111211101122211101112201111112221121112", s: [2009] },
  hints: { dense: "Try fewer hard years.", faint: "Try more years." },
};
