/**
 * Your Sampler: a Victorian cross-stitch sampler. The alphabet and the
 * figures, the name and the year in the middle, a line of words, a border and
 * motifs, every stitch an X, in the pixel font (lib/custom/draw/pixelFont).
 * Drawn by lib/custom/templates/sampler.
 */
import { BORDERS, MOTIFS, type Border, type Motif } from "../draw/sampler";
import { FIRST_YEAR, LAST_YEAR, int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  n: string;
  y?: number;
  /** A line of words (optional), on one or two rows. */
  w?: string;
  b: Border;
  /** One to three motifs: one in the middle, two in the lower corners, three both. */
  mo: Motif[];
  cap?: Cap;
}

export const NAME = "Your Sampler";
/** The stitches the pixel font has: letters, figures and a little punctuation. */
export const STITCHABLE = /^[A-Za-z0-9 .!?:-]+$/;
export const SAMPLER_NAME_MAX = 13;
export const SAMPLER_WORDS_MAX = 26;
/** A row of stitched letters: thirteen at most. */
export const ROW_CHARS = 13;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** The words on their rows: broken at spaces, at most two rows of ROW_CHARS; null when they won't go. */
export function wordRows(w: string): string[] | null {
  const rows: string[] = [];
  let row = "";
  for (const word of w.toUpperCase().split(" ").filter(Boolean)) {
    if (word.length > ROW_CHARS) return null;
    const next = row ? `${row} ${word}` : word;
    if (next.length <= ROW_CHARS) row = next;
    else {
      rows.push(row);
      row = word;
    }
  }
  if (row) rows.push(row);
  return rows.length <= 2 ? rows : null;
}

const stitchable = (s: unknown, max: number): s is string => label(s, max) && STITCHABLE.test(s as string);

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!stitchable(p.n, SAMPLER_NAME_MAX) || !BORDERS.includes(p.b as Border)) return null;
  if (p.y !== undefined && !int(p.y, FIRST_YEAR, LAST_YEAR)) return null;
  if (p.w !== undefined && (!stitchable(p.w, SAMPLER_WORDS_MAX) || !wordRows(p.w as string))) return null;
  if (!Array.isArray(p.mo) || p.mo.length < 1 || p.mo.length > 3 || !p.mo.every((m) => MOTIFS.includes(m as Motif))) return null;
  return { n: p.n as string, ...(p.y !== undefined ? { y: p.y as number } : {}), ...(p.w !== undefined ? { w: p.w as string } : {}), b: p.b as Border, mo: [...(p.mo as Motif[])] };
}

export const detail = (p: Params) => (p.y ? `${p.n} · ${p.y}` : p.n);

export const PRODUCT: ProductMeta<Params> = {
  line: "A Victorian cross-stitch sampler with your name, every stitch an X.",
  from: "A name and a year",
  group: "name",
  base: "tiling",
  bases: ["tiling", "ascii-shade"],
  wordsHint: "Maya",
  hints: { dense: "Try fewer words.", faint: "Try adding a line of words." },
  example: { n: "Maya", y: 2019, w: "Home is where the tea is", b: "diamonds", mo: ["tree", "heart", "house"] },
};
