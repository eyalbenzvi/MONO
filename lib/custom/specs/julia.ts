/**
 * Your Fractal: a date drawn as a Julia set (lib/custom/templates/julia
 * picks the set's c from a curated band by the day). A date and optional words.
 */
import { isObj, parseDate, wordsOf, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The day, "YYYY-MM-DD" (1900–2100). */
  d: string;
  w?: string;
  cap?: Cap;
}

export const NAME = "Your Fractal";

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };
/** The words (`w`) were the caption's title: the editor now writes cap[0]. */
export const WORDS_TITLE = true;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!isObj(p) || !parseDate(p.d)) return null;
  const w = wordsOf(p);
  if (!w) return null;
  return { d: p.d as string, ...w };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function detail(p: Params): string {
  const [y, mo, d] = parseDate(p.d)!;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

export const PRODUCT: ProductMeta<Params> = {
  line: "Your date as a Julia set, drawn in lines from its equation.",
  from: "A date",
  group: "date",
  base: "lorenz",
  bases: ["lorenz", "rossler"],
  wordsHint: "The day we met",
  // c = -0.796 + 0.184i, in the seahorse valley: spirals.
  example: { d: "2019-05-14" },
  hints: { dense: "Try another date.", faint: "Try another date." },
};
