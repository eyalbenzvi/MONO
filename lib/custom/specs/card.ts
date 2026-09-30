/**
 * Your Business Card: a business card, 85 by 55, centred on the print. A
 * name, a title, a company and an optional contact line, in one of three
 * styles: classic (the serif, centred), modern (the condensed face, flush
 * left) and bone (the mono). Drawn by lib/custom/templates/card.
 */
import { label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type CardStyle = "classic" | "modern" | "bone";

export interface Params {
  n: string;
  /** The title ("Head of Snacks"). */
  ti: string;
  /** The company ("The Kitchen"). */
  co: string;
  /** A contact line (optional; it prints on the shirt). */
  ct?: string;
  s: CardStyle;
  cap?: Cap;
}

export const NAME = "Your Business Card";
export const CARD_STYLES: readonly CardStyle[] = ["classic", "modern", "bone"];
export const CARD_NAME_MAX = 24;
export const CARD_LINE_MAX = 28;
export const CARD_CONTACT_MAX = 36;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, CARD_NAME_MAX) || !label(p.ti, CARD_LINE_MAX) || !label(p.co, CARD_LINE_MAX)) return null;
  if (p.ct !== undefined && !label(p.ct, CARD_CONTACT_MAX)) return null;
  if (!CARD_STYLES.includes(p.s as CardStyle)) return null;
  return { n: p.n as string, ti: p.ti as string, co: p.co as string, ...(p.ct !== undefined ? { ct: p.ct as string } : {}), s: p.s as CardStyle };
}

export const detail = (p: Params) => `${p.n} · ${p.ti}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "A business card for the job nobody pays for.",
  from: "A name, a title, a company",
  group: "form",
  base: "type-data",
  bases: ["type-data"],
  wordsHint: "Maya Cohen",
  hints: { dense: "Try shorter lines.", faint: "Try a longer title or a contact line." },
  example: { n: "Maya Cohen", ti: "Head of Snacks", co: "The Kitchen", ct: "Available most evenings", s: "classic" },
};
