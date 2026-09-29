/**
 * Things They Say: the things one person always says, 3 to SAYINGS_MAX of
 * them, under THINGS SAVTA SAYS; or, as "First words", one word in a speech
 * balloon with the child's name and the day. The person is a private one the
 * visitor names. Drawn by lib/custom/templates/sayings.
 */
import { fitText, type Fit } from "../kit";
import { label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** "first": first words (absent: the sayings). */
  k?: "first";
  /** Who says them ("Savta", "Noa"). */
  n: string;
  /** The sayings (absent in first words). */
  x?: string[];
  /** The first word (first words only). */
  o?: string;
  /** The day of the first word (optional). */
  d?: string;
  cap?: Cap;
}

export const NAME = "Things They Say";
export const SAYER_MAX = 14;
export const SAYINGS_MIN = 3;
export const SAYINGS_MAX = 7;
export const SAYING_MAX = 40;
export const WORD_MAX = 16;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** The sayings' column: its width, the height they share, the gap between two in their type size. */
export const COLUMN = { w: 196, h: 186, gap: 0.9, lead: 1.25 };

/** The sayings set: one size for all (13 down to 8), each on at most three lines, the whole within the column; null when they can't. */
export function sayingsFit(x: readonly string[]): { size: number; fits: Fit[] } | null {
  for (let size = 13; size >= 8; size -= 0.5) {
    const fits = x.map((t) => fitText(t, COLUMN.w, { size, floor: size, maxLines: 3, family: "serif" }));
    if (fits.some((f) => !f)) continue;
    const lines = fits.reduce((a, f) => a + f!.lines.length, 0);
    if (lines * size * COLUMN.lead + (x.length - 1) * size * (COLUMN.gap + COLUMN.lead) <= COLUMN.h) return { size, fits: fits as Fit[] };
  }
  return null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, SAYER_MAX)) return null;
  if (p.k === "first") {
    if (!label(p.o, WORD_MAX) || p.x !== undefined) return null;
    if (p.d !== undefined && !parseDate(p.d)) return null;
    return { k: "first", n: p.n as string, o: p.o as string, ...(p.d !== undefined ? { d: p.d as string } : {}) };
  }
  if (p.k !== undefined || p.o !== undefined || p.d !== undefined) return null;
  if (!Array.isArray(p.x) || p.x.length < SAYINGS_MIN || p.x.length > SAYINGS_MAX || !p.x.every((s) => label(s, SAYING_MAX))) return null;
  if (!sayingsFit(p.x as string[])) return null;
  return { n: p.n as string, x: [...(p.x as string[])] };
}

export const detail = (p: Params) => (p.k === "first" ? `${p.n} · “${p.o}”` : `${p.n} · ${p.x!.length} sayings`);

export const PRODUCT: ProductMeta<Params> = {
  line: "The things someone always says, kept in print. Or a child’s first word.",
  from: "Their sayings, or a first word",
  group: "people",
  base: "type-data",
  bases: ["type-data"],
  wordsHint: "Savta",
  hints: { dense: "Try fewer or shorter sayings.", faint: "Try another saying." },
  example: { n: "Savta", x: ["Put a jumper on, I’m cold.", "You’ll understand when you’re older.", "Eat, you’re too thin.", "Call when you get there.", "It’s not a problem, it’s a situation."] },
};
