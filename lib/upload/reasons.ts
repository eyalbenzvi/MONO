/**
 * Every line an upload can be refused with, in one place (brief 6.4 and
 * 6.1): what's wrong and, where there is one, what to try. Short, factual,
 * British, no exclamation marks, no blame.
 */

export const REASONS = {
  /** The file itself. */
  format: "This file won’t open here. Try a JPG or PNG.",
  heavy: "Over 25 MB. Try a smaller copy of it.",
  unreadable: "This file won’t open. Try a JPG or PNG.",
  // More pixels than a picture needs (lib/upload/header MAX_PIXELS): refused before it's opened.
  huge: "Too big to open: over 100 megapixels.",
  svg: "This SVG has parts we can’t print. Try it saved as a PNG.",
  smallForFull: "Too small for Full. Try Small, or a larger file.",
  // The short side's minimum (convert MIN_SHORT.small); the file's own size is said when it's known (smallReason).
  smallForSmall: "Too small to print. Try a larger file.",
  // A crop of a picture big enough on its own: the crop is what's too small.
  smallCrop: "This crop is too small to print. Try a larger crop.",
  /** The print (measure.ts tier): what's wrong, never an action (the fixes offered are the actions). */
  solidDots: "Too much ink: it would print as a solid patch.",
  solid: "Too much ink: it would print as a solid patch.",
  faint: "Too faint: it would print as a grey haze.",
  denseDots: "Too much ink: the tee would be mostly ink.",
  dense: "Too much ink: the tee would be mostly ink.",
  plain: "Too little in it to print.",
  blank: "It’s one flat colour: there’s nothing in it to print.",
  weak: "Too little detail to print well.",
} as const;

/** A picture too small to print, with its size and what it needs. */
export const smallReason = (w: number, h: number, min: number) => `Too small to print: ${w} × ${h} px. It needs ${min} px on its short side.`;

/** The largest file the page takes, bytes. */
export const MAX_BYTES = 25 * 1024 * 1024;

/** Lines thinner than the tee allows. */
export const strokeReason = (mm: number) => `Lines too thin to print (under ${mm} mm).`;

/** Gaps between the ink too narrow to stay open. */
export const gapReason = (mm: number) => `Gaps too narrow to print (under ${mm} mm): they’d fill in.`;
