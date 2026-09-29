/**
 * Every line an upload can be refused with, in one place (brief 6.4 and
 * 6.1): what's wrong and, where there is one, what to try. Short, factual,
 * British, no exclamation marks, no blame.
 */
import type { PrintSize } from "./convert";

export const REASONS = {
  /** The file itself. */
  format: "PNG, JPG, WebP or SVG only.",
  heavy: "Over 25 MB. Try a smaller file.",
  unreadable: "This file won't open. Try another.",
  svg: "This SVG has parts we can't print.",
  smallForFull: "Too small for Full. Try Small, or a larger file.",
  // The short side's minimum (convert MIN_SHORT.small), said as a number.
  smallForSmall: "Too small to print: it needs 800 px on its short side.",
  noWords: "Nothing to print. Write a word or two.",
  typeLoad: "This type didn't load. Try again, or another type.",
  /** The print (measure.ts tier). */
  solidDots: "Too much ink in one place. Try Lines.",
  solid: "Too much ink in one place.",
  faint: "Too faint to print. Try a stronger picture.",
  denseDots: "Too much ink to print. Try Lines.",
  dense: "Too much ink to print. Try fewer or thinner shapes.",
  plain: "Too little going on to print. Try a busier picture.",
  weak: "This one won't print well. Try another picture.",
  duplicate: "This one is already in the catalogue.",
} as const;

/** The largest file the page takes, bytes. */
export const MAX_BYTES = 25 * 1024 * 1024;

/** Lines thinner than the tee allows: Full size makes them wider; at Full, only bolder lines will do. */
export const strokeReason = (mm: number, size: PrintSize) => `Lines under ${mm} mm. ${size === "small" ? "Try Full size." : "Try bolder lines."}`;

/** Gaps between the ink too narrow to stay open. */
export const gapReason = (mm: number, size: PrintSize) => `Gaps under ${mm} mm. ${size === "small" ? "Try Full size." : "Try a simpler picture."}`;
