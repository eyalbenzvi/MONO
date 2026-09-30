/**
 * Your Credits: a family's end credits. "A COHEN FAMILY PRODUCTION",
 * CREDITS_MIN to CREDITS_MAX role and name pairs, and the copyright line with its year.
 * Drawn by lib/custom/templates/credits.
 */
import { FIRST_YEAR, LAST_YEAR, int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

/** A credit: the role, and who played it. */
export type Credit = [role: string, name: string];

export interface Params {
  /** The family ("Cohen"): A COHEN FAMILY PRODUCTION. */
  f: string;
  x: Credit[];
  /** The copyright year (optional). */
  y?: number;
  cap?: Cap;
}

export const NAME = "Your Credits";
/** Credits roll: one alone leaves the frame empty (it read as flat to the gate). */
export const CREDITS_MIN = 2;
export const CREDITS_MAX = 12;
export const FAMILY_MAX = 14;
export const ROLE_MAX = 12;
export const CREDIT_NAME_MAX = 13;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.f, FAMILY_MAX)) return null;
  if (!Array.isArray(p.x) || p.x.length < CREDITS_MIN || p.x.length > CREDITS_MAX) return null;
  if (!(p.x as unknown[]).every((c) => Array.isArray(c) && c.length === 2 && label(c[0], ROLE_MAX) && label(c[1], CREDIT_NAME_MAX))) return null;
  if (p.y !== undefined && !int(p.y, FIRST_YEAR, LAST_YEAR)) return null;
  return { f: p.f as string, x: (p.x as Credit[]).map(([r, n]) => [r, n] as Credit), ...(p.y !== undefined ? { y: p.y as number } : {}) };
}

export const detail = (p: Params) => `The ${p.f} family`;

export const PRODUCT: ProductMeta<Params> = {
  line: "Your family as the end credits of a long film.",
  from: "Who did what",
  group: "people",
  base: "type-data",
  bases: ["type-data"],
  wordsHint: "Cohen",
  hints: { dense: "Try fewer credits.", faint: "Try another credit or two." },
  example: {
    f: "Cohen",
    x: [["Directed by", "Mum"], ["Produced by", "Dad"], ["Catering", "Savta"], ["Stunts", "Ari"], ["Continuity", "Noa"], ["Noise", "Max the dog"], ["Best boy", "Grandpa"]],
    y: 2026,
  },
};
