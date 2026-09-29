/**
 * Your Museum Label: a person as a museum's wall label. The name, "(b. 1990,
 * Tel Aviv)", a medium line, a credit line, and an accession number from the
 * day. The medium and the credit are the visitor's, or one of ours
 * (LABEL_MEDIUMS, LABEL_CREDITS). Drawn by lib/custom/templates/label.
 */
import { fitText, type Fit } from "../kit";
import { FIRST_YEAR, LAST_YEAR, int, label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The name, as the artist. */
  n: string;
  /** The year born (optional). */
  b?: number;
  /** Where (optional). */
  pl?: string;
  /** The medium line. */
  md: string;
  /** The credit line (optional). */
  cr?: string;
  /** The day it was acquired: the accession number (optional). */
  d?: string;
  cap?: Cap;
}

export const NAME = "Your Museum Label";
export const LABEL_NAME_MAX = 24;
export const LABEL_PLACE_MAX = 20;
export const LABEL_LINE_MAX = 40;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** Our medium lines, to pick or to start from. */
export const LABEL_MEDIUMS = [
  "Mixed media, mostly biscuits",
  "Oil on nerves",
  "Tea on sofa",
  "Found objects, mainly socks",
  "Charm, on credit",
  "Graphite and optimism",
  "Coffee, on and off",
  "Mixed media, mainly noise",
  "Pencil on the wall, since removed",
  "Late nights on canvas",
  "Crumbs on upholstery",
  "Sleep deprivation, in parts",
  "Marker on everything",
  "Tea, three sugars",
  "Sarcasm on board",
  "Wool, borrowed",
  "Opinions on linen",
  "Wellingtons and weather",
  "Rain on a Tuesday",
  "Toast, lightly",
] as const;

/** Our credit lines. */
export const LABEL_CREDITS = [
  "On loan from her mother",
  "On loan from his mother",
  "On long-term loan from the family",
  "Gift of the grandparents",
  "Acquired at some expense",
  "Purchased with help from the bank",
  "From the collection of the kitchen table",
  "Not for sale. Enquiries ignored",
  "Returned after the weekend",
  "Bequeathed, reluctantly",
  "On permanent display",
  "Private collection, very private",
  "Lent by the artist, who wants it back",
  "Anonymous gift, obviously Mum",
  "Restored in part, mostly by naps",
  "Insured for sentimental value",
  "Do not touch. Especially at breakfast",
  "Please do not feed",
  "Handle with care, and snacks",
  "Displayed as found",
] as const;

/** The text's column on the card: from the left margin to the right one. */
export const LABEL_WIDTH = 186;
/** The medium and the credit set to the column: at most three lines each, down to a floor; null when they can't be. */
export const mediumFit = (md: string): Fit | null => fitText(md, LABEL_WIDTH, { size: 15, floor: 10, maxLines: 3, family: "serif" });
export const creditFit = (cr: string): Fit | null => fitText(cr, LABEL_WIDTH, { size: 12, floor: 8.5, maxLines: 3, family: "serif" });

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, LABEL_NAME_MAX) || !label(p.md, LABEL_LINE_MAX) || !mediumFit(p.md)) return null;
  if (p.b !== undefined && !int(p.b, FIRST_YEAR, LAST_YEAR)) return null;
  if (p.pl !== undefined && !label(p.pl, LABEL_PLACE_MAX)) return null;
  if (p.cr !== undefined && (!label(p.cr, LABEL_LINE_MAX) || !creditFit(p.cr))) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  return {
    n: p.n as string,
    ...(p.b !== undefined ? { b: p.b as number } : {}),
    ...(p.pl !== undefined ? { pl: p.pl as string } : {}),
    md: p.md as string,
    ...(p.cr !== undefined ? { cr: p.cr as string } : {}),
    ...(p.d !== undefined ? { d: p.d as string } : {}),
  };
}

export const detail = (p: Params) => p.n;

export const PRODUCT: ProductMeta<Params> = {
  line: "Someone you love, labelled as a work in the permanent collection.",
  from: "A name, a year, a medium",
  group: "form",
  base: "type-data",
  bases: ["type-data"],
  wordsHint: "Maya Cohen",
  hints: { dense: "Try shorter lines.", faint: "Try a longer medium or credit." },
  example: { n: "Maya Cohen", b: 1990, pl: "Tel Aviv", md: "Mixed media, mostly biscuits", cr: "On loan from her mother", d: "2019-06-02" },
};
