/**
 * Your Snowflake: a name (or a word), the seed of the crystal and printed
 * small beneath it. Drawn by lib/custom/templates/snowflake.
 */
import { label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The name, as printed (the words' rule, SNOWFLAKE_MAX characters). */
  n: string;
  cap?: Cap;
}

export const NAME = "Your Snowflake";
export const SNOWFLAKE_MAX = 20;

/** The caption: the name, what it is, the model's numbers; every line can go (tests/make/snowflake.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  return label(p.n, SNOWFLAKE_MAX) ? { n: p.n } : null;
}

export const detail = (p: Params) => p.n;

export const PRODUCT: ProductMeta<Params> = {
  line: "A snow crystal grown from your name. No two names grow the same one.",
  from: "A name",
  group: "name",
  base: "rosette",
  bases: ["rosette", "khatam"],
  wordsHint: "Maya",
  example: { n: "Maya" },
  hints: { dense: "Try another spelling.", faint: "Try another spelling." },
};
