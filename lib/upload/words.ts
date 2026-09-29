/**
 * "Your words": the types they're set in and how lines are laid out, pure
 * (no DOM), so the worker (decode wordsPixels), the page and the tests share
 * it. Six faces, each measured through the print checks at Full and Small on
 * both tees before it was chosen (strokes and gaps clear the floors in all of
 * them); their files are public/fonts/words (scripts/tools/buildWordsFonts.py).
 * A face's letters are capped in height (maxCapCm): bold letters taller than
 * about 9–11 cm print as a slab of ink, so short words print narrower than
 * the box rather than being refused.
 */

export type Face = "mono" | "grotesk" | "condensed" | "serif" | "gothic" | "hand";
export type WordsLayout = "even" | "fill";
export type WordsAlign = "centre" | "left";
export interface WordsType {
  face: Face;
  /** Every line the same size, or each scaled to the widest (a stacked block). */
  layout: WordsLayout;
  /** Same size only (Fill width is centred). */
  align: WordsAlign;
  /** Set in capitals, whatever was typed. */
  caps: boolean;
}
export const WORDS_DEFAULT: WordsType = { face: "mono", layout: "even", align: "centre", caps: false };

export interface FaceInfo {
  label: string;
  /** public/fonts/words/<file>. */
  file: string;
  /** Letters a line holds (a condensed face holds more). */
  chars: number;
  /** Line pitch, in the size's em (lines never closer than their letters allow, whatever this says). */
  leading: number;
  /** The tallest a capital prints, cm (measured: the largest that passes on both tees, a little under). */
  maxCapCm: number;
}
export const FACES: Record<Face, FaceInfo> = {
  mono: { label: "Mono", file: "dejavu-sans-mono-bold.woff2", chars: 24, leading: 1.25, maxCapCm: 9.5 },
  grotesk: { label: "Grotesk", file: "inter-extrabold.woff2", chars: 24, leading: 1.1, maxCapCm: 8 },
  condensed: { label: "Condensed", file: "anton.woff2", chars: 32, leading: 1.05, maxCapCm: 9 },
  serif: { label: "Serif", file: "fraunces-black.woff2", chars: 24, leading: 1.1, maxCapCm: 9 },
  gothic: { label: "Gothic", file: "pirata-one.woff2", chars: 24, leading: 1.15, maxCapCm: 10.5 },
  hand: { label: "Hand", file: "caveat-brush.woff2", chars: 24, leading: 1.1, maxCapCm: 11 },
};
export const FACE_IDS = Object.keys(FACES) as Face[];
export const isFace = (v: unknown): v is Face => typeof v === "string" && v in FACES;
/** The family a face is registered under in the worker (never a name the system might also have). */
export const familyOf = (f: Face) => `MONO words ${f}`;

/** At most this many lines. */
export const WORD_LINES = 3;
/** The most letters any face holds on a line (the field's own cap). */
export const WORD_CHARS_MAX = Math.max(...FACE_IDS.map((f) => FACES[f].chars));
/**
 * What every face can set: ASCII, Latin-1 and Latin Extended-A (not the soft
 * hyphen, the vulgar fractions, or two deprecated letters no face has), and
 * the curly quotes, dashes and ellipsis a phone's keyboard types.
 */
export const PRINTABLE = /^[\x20-\x7E -¬®-»¿-ňŊ-ž‘’“”–—…]*$/;
/** A line as it prints (Capitals: "ß" becomes "SS", so limits are counted after this). */
export const cased = (l: string, caps: boolean) => (caps ? l.toUpperCase() : l);
/** Characters as a person counts them (an accented letter typed as two code points is one). */
export const letters = (l: string) => [...l.normalize("NFC")].length;

/** The size words are set at before they're fitted to the print, px. */
export const BASE_PX = 160;
/** Fill width never scales a short line past this (so "A" under "BECOMING" can't take the block over). */
export const FILL_MAX = 2.5;

export interface Run {
  text: string;
  /** The anchor: the line's centre (align "center") or its left edge, px. */
  x: number;
  /** The baseline, px. */
  y: number;
  px: number;
  align: "center" | "left";
}
export interface Metrics {
  /** The advance width. */
  w: number;
  /** Ink above and below the baseline. */
  asc: number;
  desc: number;
}

/**
 * The lines laid out at BASE_PX: each line's size (Fill width: scaled to the
 * widest, up to FILL_MAX), its baseline (the face's leading, but never closer
 * than the letters' own ink plus 8% of the size), the canvas around them with
 * a quarter-em margin, and capPx, the capital height of the largest line (what
 * the print's letter cap is measured against). `m` measures a string at a
 * size in the face (the worker's measureText); it may be linear in px.
 */
export function layoutWords(lines: string[], t: WordsType, m: (s: string, px: number) => Metrics): { w: number; h: number; capPx: number; runs: Run[] } {
  const f = FACES[t.face];
  const text = lines.map((l) => cased(l, t.caps));
  const base = text.map((l) => m(l, BASE_PX));
  const widest = Math.max(1, ...base.map((b) => b.w));
  const px = text.map((_, i) => (t.layout === "fill" ? Math.min(BASE_PX * FILL_MAX, (BASE_PX * widest) / Math.max(1, base[i].w)) : BASE_PX));
  const at = text.map((l, i) => (px[i] === BASE_PX ? base[i] : m(l, px[i])));
  const top = Math.max(...px);
  const margin = Math.round(0.25 * top);
  const lineW = Math.max(1, ...at.map((a) => a.w));
  const w = Math.ceil(lineW + 2 * margin);
  const ys: number[] = [];
  text.forEach((_, i) => {
    if (i === 0) return ys.push(margin + Math.max(at[0].asc, 0.8 * px[0]));
    const pitch = Math.max(f.leading * Math.max(px[i - 1], px[i]), at[i - 1].desc + at[i].asc + 0.08 * top);
    ys.push(ys[i - 1] + pitch);
  });
  const last = text.length - 1;
  const h = Math.ceil(ys[last] + Math.max(at[last].desc, 0.25 * px[last]) + margin);
  const left = t.layout === "even" && t.align === "left";
  const runs = text.map((l, i) => ({ text: l, x: left ? margin : w / 2, y: ys[i], px: px[i], align: left ? ("left" as const) : ("center" as const) }));
  const capPx = m("H", top).asc;
  return { w, h, capPx, runs };
}
