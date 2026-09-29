/**
 * Your Name in Elements: a word spelled in the periodic table's symbols
 * (one or two letters each, as few tiles as can be), set as a row of the
 * table. The spec carries the word only; whether the symbols can spell it is
 * worked out by the spelling (lib/custom/draw/elementsSpell), which the
 * editor asks before offering a print and the template draws from.
 */
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The word, capitals A–Z. */
  x: string;
}

export const NAME = "Your Name in Elements";
export const ELEMENTS_LEN = [2, 12] as const;
const WORD = /^[A-Z]{2,12}$/;

/** What's wrong with the word as typed (one line), or null: letters A–Z, one word, 2–12 of them. The spelling is checked apart. */
export function elementsWordProblem(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  const bad = [...t].find((c) => !/[A-Z]/.test(c));
  if (bad) {
    const plain = bad.normalize("NFKD").replace(/\p{M}/gu, "");
    return /^[A-Z]$/.test(plain) ? `Letters A to Z only. Try "${plain}".` : "Letters A to Z only, one word";
  }
  return t.length < ELEMENTS_LEN[0] || t.length > ELEMENTS_LEN[1] ? `${ELEMENTS_LEN[0]} to ${ELEMENTS_LEN[1]} letters` : null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  return typeof p.x === "string" && WORD.test(p.x) ? { x: p.x } : null;
}

export const detail = (p: Params) => p.x;

export const PRODUCT: ProductMeta<Params> = {
  line: "Your name spelled in the symbols of the periodic table, each with its number and element.",
  from: "A name or a word",
  group: "name",
  base: "type-data",
  bases: ["type-data"],
  wordsHint: "Alice",
  example: { x: "ALICE" },
  hints: { dense: "Try a shorter word.", faint: "Try a longer word." },
};
