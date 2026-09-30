/**
 * The Make index's cards: each shows its product's example print, which is
 * the same for every visitor, so it is baked once at build time
 * (scripts/images/bakeMake.ts) and shown as a picture: the chest crop of the
 * model photo, 3:4, at CARD_WIDTHS. Only a card drawn from the visitor's own
 * input (Your Taste, once the taste is known) is drawn live.
 */
import { madeBySlug, type MadeProduct } from "./products";
import { validate, type CustomSpec } from "./spec";

export const CARD_WIDTHS = [360, 720] as const;
/** A baked card's picture (under public/). */
export const cardPath = (key: string, w: number) => `/img/make/${key}-${w}.webp`;

const MONOGRAM = madeBySlug("monogram") as MadeProduct;
/** For two's card: our example couple's initials, woven (the page itself shows every print their date makes). */
export const TWO_SPEC: CustomSpec = validate({ t: "monogram", v: 1, p: { x: "ND", s: "lace", y: 2016 } }) ?? MONOGRAM.example;
export const TWO_KEY = "two";
