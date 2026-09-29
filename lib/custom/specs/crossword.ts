/**
 * Your Crossword: your people's names built into one crossword, the way a
 * setter would fit them (lib/custom/draw/crossword), set like the
 * catalogue's Type prints. The names print filled in, or (`h: 1`) as a blank
 * grid with the names listed under it by length, to be fitted back in.
 */
import { isObj, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The names, capitals A–Z, one space between, in the order typed (the order seeds the builder). */
  x: string;
  /** Blank cells, the names listed under the grid. */
  h?: 1;
  /** The title (optional words). */
  w?: string;
}

export const NAME = "Your Crossword";
export const CROSS_MIN = 4;
export const CROSS_MAX = 12;
export const CROSS_LEN = [3, 12] as const;
const WORD = /^[A-Z]{3,12}$/;

/** What's wrong with one name as typed (a one-line reason), or null. Letters A–Z only, 3–12 of them. */
export function crossWordProblem(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  const bad = [...t].find((c) => !/[A-Z]/.test(c));
  if (bad) {
    const plain = bad.normalize("NFKD").replace(/\p{M}/gu, "");
    return /^[A-Z]$/.test(plain) ? `Letters A to Z only. Try "${plain}".` : "Letters A to Z only, one word each";
  }
  return t.length < CROSS_LEN[0] || t.length > CROSS_LEN[1] ? `${CROSS_LEN[0]} to ${CROSS_LEN[1]} letters` : null;
}

/** The names of a spec's `x`. */
export const crossNames = (x: string) => x.split(" ");

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!isObj(p) || typeof p.x !== "string" || p.x.length > 160) return null;
  const names = crossNames(p.x);
  if (names.length < CROSS_MIN || names.length > CROSS_MAX || !names.every((s) => WORD.test(s)) || new Set(names).size !== names.length) return null;
  if (p.h !== undefined && p.h !== 1) return null;
  const w = wordsOf(p);
  if (!w) return null;
  return { x: p.x, ...(p.h === 1 ? { h: 1 as const } : {}), ...w };
}

export const detail = (p: Params) => p.w ?? `${crossNames(p.x).length} names`;

export const PRODUCT: ProductMeta<Params> = {
  line: "Your people’s names, fitted into one crossword.",
  from: "Four to twelve names",
  group: "people",
  base: "type-data",
  wordsHint: "The Levins",
  example: { x: "MIRIAM DAVID NOA ELLA JONATHAN RUTH", w: "The Levins" },
  hints: { dense: "Try fewer names, or shorter ones.", faint: "Try more names." },
};
