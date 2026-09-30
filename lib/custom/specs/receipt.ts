/**
 * Your Receipt: a relationship on paper, three ways. A till receipt (the
 * items of your story at 0.00 each, the total, a barcode of the day), the
 * terms (numbered clauses, signed), or a review (stars, a quote, "Verified
 * partner since 2016"). Our lines to pick from, or yours. Drawn by
 * lib/custom/templates/receipt.
 */
import { fitText, type Fit } from "../kit";
import { FIRST_YEAR, LAST_YEAR, int, label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type ReceiptKind = "receipt" | "terms" | "review";

export interface Params {
  k: ReceiptKind;
  /** The receipt's shop name or the terms' heading (not a review). */
  h?: string;
  /** The items (a receipt) or the clauses (the terms). */
  x?: string[];
  /** The day: the receipt's (and its barcode), the terms' coming into effect. */
  d?: string;
  /** A review's stars, its quote, who wrote it, and since when. */
  n?: number;
  q?: string;
  by?: string;
  y?: number;
  cap?: Cap;
}

export const NAME = "Your Receipt";
export const RECEIPT_KINDS: readonly ReceiptKind[] = ["receipt", "terms", "review"];
export const HEAD_MAX = 24;
export const ITEM_MAX = 20;
export const ITEMS_MAX = 8;
export const CLAUSE_MAX = 48;
export const CLAUSES_MIN = 3;
export const CLAUSES_MAX = 6;
export const QUOTE_MAX = 80;
export const REVIEWER_MAX = 20;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** Our items for a receipt. */
export const RECEIPT_ITEMS = [
  "First date", "Second date", "Bad film", "Popcorn, shared", "Long walk", "Umbrella, one", "Last train", "Coffee, too strong",
  "Awkward hug", "Meeting the parents", "Flat-pack wardrobe", "Moving day", "Wrong turn", "Engagement", "Cold feet, brief",
  "Wedding", "Night feeds", "School run", "Lost keys", "Twenty good years",
] as const;
/** Our clauses for the terms. */
export const TERMS_CLAUSES = [
  "The last biscuit is to be offered, not taken.",
  "Whoever cooks does not wash up.",
  "The thermostat is a shared resource.",
  "Snoring will be recorded and played back.",
  "Films are chosen in turns. Turns are recorded.",
  "Socks belong in the basket, not near it.",
  "Either party may ask for tea at any time.",
  "The remote is held in trust for both parties.",
  "Directions are to be followed, not debated.",
  "Holidays are planned together, forgotten apart.",
  "Complaints are heard after dinner, never before.",
  "The spider is removed by whoever is nearer.",
  "Birthdays are remembered. This is not optional.",
  "The car radio belongs to the driver.",
  "No one mentions the incident of 2016.",
  "Leftovers are labelled or they are fair game.",
  "Plants are watered by whoever bought them.",
  "Apologies are accepted in writing or with cake.",
  "This agreement renews itself every morning.",
  "Both parties are right. Occasionally.",
] as const;
/** Our quotes for a review. */
export const REVIEW_QUOTES = [
  "Would marry again. Assembly instructions unclear.",
  "Does exactly what it says. Snores slightly.",
  "Arrived late but has been worth it since.",
  "Excellent value. Warm feet in winter.",
  "Five stars. Would recommend to no one else.",
  "Better than described. Worse at parking.",
  "Still working after twenty years. No manual.",
  "Makes a good cup of tea. Takes the duvet.",
  "Exactly as pictured, but funnier.",
  "Some assembly required. Worth every minute.",
  "Reliable, patient, occasionally right.",
  "Came with a cat. No complaints.",
  "Easy to talk to. Hard to beat at cards.",
  "Loud in the mornings. Kind all day.",
  "Survived a flat-pack wardrobe. Highly durable.",
  "Laughs at my jokes, including the old ones.",
  "Great with children, mine in particular.",
  "Low maintenance, apart from the biscuits.",
  "Better than the brochure.",
  "Would not exchange. Have checked the policy.",
] as const;

/** A column's width for each kind (the receipt's slip is narrow), and how its lines are set. */
export const TERMS_W = 206;
export const QUOTE_W = 196;
/** The terms' clauses set together: one size for all (11 down to 8), each on at most three lines, all within the page; null when they can't be. */
export function termsFit(x: readonly string[]): { size: number; fits: Fit[] } | null {
  for (let size = 11; size >= 8; size -= 0.5) {
    const fits = x.map((t) => fitText(t, TERMS_W - 16, { size, floor: size, maxLines: 3, family: "serif" }));
    if (fits.some((f) => !f)) continue;
    const lines = fits.reduce((a, f) => a + f!.lines.length, 0);
    if (lines * size * 1.3 + (x.length - 1) * size * 0.9 <= 168) return { size, fits: fits as Fit[] };
  }
  return null;
}
export const quoteFit = (q: string): Fit | null => fitText(`“${q}”`, QUOTE_W, { size: 17, floor: 11, maxLines: 4, family: "serif" });

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (p.k === "receipt") {
    if (!label(p.h, HEAD_MAX) || !parseDate(p.d)) return null;
    if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > ITEMS_MAX || !p.x.every((v) => label(v, ITEM_MAX))) return null;
    if (p.n !== undefined || p.q !== undefined || p.by !== undefined || p.y !== undefined) return null;
    return { k: "receipt", h: p.h as string, x: [...(p.x as string[])], d: p.d as string };
  }
  if (p.k === "terms") {
    if (!label(p.h, HEAD_MAX)) return null;
    if (!Array.isArray(p.x) || p.x.length < CLAUSES_MIN || p.x.length > CLAUSES_MAX || !p.x.every((v) => label(v, CLAUSE_MAX)) || !termsFit(p.x as string[])) return null;
    if (p.d !== undefined && !parseDate(p.d)) return null;
    if (p.n !== undefined || p.q !== undefined || p.by !== undefined || p.y !== undefined) return null;
    return { k: "terms", h: p.h as string, x: [...(p.x as string[])], ...(p.d !== undefined ? { d: p.d as string } : {}) };
  }
  if (p.k === "review") {
    if (!int(p.n, 1, 5) || !label(p.q, QUOTE_MAX) || !quoteFit(p.q as string) || !label(p.by, REVIEWER_MAX)) return null;
    if (p.y !== undefined && !int(p.y, FIRST_YEAR, LAST_YEAR)) return null;
    if (p.h !== undefined || p.x !== undefined || p.d !== undefined) return null;
    return { k: "review", n: p.n as number, q: p.q as string, by: p.by as string, ...(p.y !== undefined ? { y: p.y as number } : {}) };
  }
  return null;
}

export const detail = (p: Params) => (p.k === "review" ? `${p.n} stars · ${p.by}` : `${p.k === "terms" ? "Terms" : "Receipt"} · ${p.h}`);

export const PRODUCT: ProductMeta<Params> = {
  line: "Your story as a till receipt, a contract or a five-star review.",
  from: "Your story, itemised",
  group: "people",
  base: "terminal-data",
  bases: ["terminal-data", "type-data"],
  wordsHint: "Noa & Dan",
  hints: { dense: "Try fewer or shorter lines.", faint: "Try another line or two." },
  example: { k: "receipt", h: "Noa & Dan", x: ["First date", "Bad film", "Popcorn, shared", "Last train", "Moving day", "Wedding"], d: "2016-08-14" },
};
