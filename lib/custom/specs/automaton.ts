/**
 * Your Automaton: a word's ASCII bits as the first row of an elementary
 * cellular automaton (Wolfram's numbering), run down the print under one of
 * a few rules known to keep drawing (fuzzed over many words: none dies out
 * or fills solid), each cell a dot or a square.
 */
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The word, as typed: printable ASCII letters, digits and a few marks, single spaces. */
  x: string;
  /** The rule (Wolfram code), one of AUTOMATON_RULES. */
  r: (typeof AUTOMATON_RULES)[number];
  /** Squares instead of dots. */
  s?: 1;
}

export const NAME = "Your Automaton";
/** The curated rules, in the order the editor offers them. */
export const AUTOMATON_RULES = [18, 30, 45, 60, 73, 90, 105, 110, 150] as const;
export const AUTOMATON_MAX = 10;
/** ASCII only (the bits are ASCII's): letters, digits and simple marks; no space at either end, none doubled. */
const WORD = /^[A-Za-z0-9.,'&:!?()-]+(?: [A-Za-z0-9.,'&:!?()-]+)*$/;

/** What's wrong with the word as typed (one line), or null. */
export function automatonWordProblem(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const bad = [...t].find((c) => !/[A-Za-z0-9 .,'&:!?()-]/.test(c));
  if (bad) {
    const plain = bad.normalize("NFKD").replace(/\p{M}/gu, "");
    return /^[A-Za-z]$/.test(plain) ? `ASCII letters only. Try "${plain}".` : "Letters and numbers.";
  }
  return t.length > AUTOMATON_MAX ? `Up to ${AUTOMATON_MAX} characters` : null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (typeof p.x !== "string" || p.x.length > AUTOMATON_MAX || !WORD.test(p.x)) return null;
  if (!AUTOMATON_RULES.includes(p.r as never)) return null;
  if (p.s !== undefined && p.s !== 1) return null;
  return { x: p.x, r: p.r as Params["r"], ...(p.s === 1 ? { s: 1 as const } : {}) };
}

export const detail = (p: Params) => `${p.x} · Rule ${p.r}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "Your name in ASCII bits, grown row by row under one of Wolfram’s rules.",
  from: "A name",
  group: "name",
  base: "matrix",
  bases: ["matrix", "terminal-data"],
  wordsHint: "Maya",
  example: { x: "Maya", r: 30 },
  hints: { dense: "Try another rule.", faint: "Try another rule, or a longer word." },
};
