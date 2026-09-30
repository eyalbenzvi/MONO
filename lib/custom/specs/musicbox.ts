/**
 * Your Music Box: a tune as a music-box strip. Notes are a pitch (0–24: two
 * octaves, C4 to C6, chromatic) on a step (0–63, a step an eighth), at most
 * 64 of them, packed as delta pairs (step since the last note, pitch since
 * the last note) with packInts: in step order, a chord's notes rising, the
 * first on step 0 (a strip starts with its first note). One note, or notes on
 * one step only, is no tune: the spec needs two steps at least, and the
 * editor says so instead of drawing a strip.
 */
import { unpackInts, wordsOf, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The notes: packInts of [dStep, dPitch] a note (see above). */
  m: string;
  w?: string;
  cap?: Cap;
}

export const NAME = "Your Music Box";
export const PITCHES = 25;
export const STEPS = 64;
export const NOTES_MAX = 64;
export type Note = [step: number, pitch: number];

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** A pitch's name with its octave ("C4", "F#5"). */
export const pitchName = (p: number) => `${NAMES[p % 12]}${4 + Math.floor(p / 12)}`;
export const isSharp = (p: number) => NAMES[p % 12].length > 1;

/** Notes in the spec's order: by step, then pitch, one of each, shifted so the first is on step 0. */
export function tidyNotes(notes: readonly Note[]): Note[] {
  const seen = new Set<number>();
  const out = [...notes].filter(([s, p]) => !seen.has(s * PITCHES + p) && seen.add(s * PITCHES + p)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const first = out.length ? out[0][0] : 0;
  return out.map(([s, p]) => [s - first, p]);
}
/** Tidy notes to the packed ints (delta pairs). */
export function packNotes(notes: readonly Note[]): number[] {
  let [s0, p0] = [0, 0];
  return notes.flatMap(([s, p]) => {
    const d = [s - s0, p - p0];
    [s0, p0] = [s, p];
    return d;
  });
}
/** Why these notes aren't a strip yet, in one line, or null. */
export function notesProblem(notes: readonly Note[]): string | null {
  if (notes.length > NOTES_MAX) return `${NOTES_MAX} notes at most`;
  if (new Set(notes.map(([s]) => s)).size < 2) return "Add at least two notes, one after another.";
  return null;
}

/** The packed notes read back, or null when they aren't canonical or in range. */
export function unpackNotes(m: unknown): Note[] | null {
  const v = unpackInts(m, NOTES_MAX * 4);
  if (!v || v.length % 2 || v.length > NOTES_MAX * 2) return null;
  const out: Note[] = [];
  let [s, p] = [0, 0];
  for (let i = 0; i < v.length; i += 2) {
    const [ds, dp] = [v[i], v[i + 1]];
    if (ds < 0 || (i > 0 && ds === 0 && dp <= 0) || (i === 0 && ds !== 0)) return null;
    [s, p] = [s + ds, p + dp];
    if (s >= STEPS || p < 0 || p >= PITCHES) return null;
    out.push([s, p]);
  }
  return notesProblem(out) ? null : out;
}

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };
/** The words (`w`) were the caption's title: the editor now writes cap[0]. */
export const WORDS_TITLE = true;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!unpackNotes(p.m)) return null;
  const w = wordsOf(p);
  if (!w) return null;
  return { m: p.m as string, ...w };
}

export const detail = (p: Params) => p.w ?? `${(unpackNotes(p.m) ?? []).length} notes`;

export const PRODUCT: ProductMeta<Params> = {
  line: "Your tune as a music-box strip, a punched hole for every note.",
  from: "A tune, note by note",
  group: "you",
  base: "terminal-data",
  bases: ["terminal-data", "matrix"],
  wordsHint: "Our song",
  example: { m: "AAAAGAQABA4EAAQbACAEAAQpACYIGwAYBAAEIQAgBAAEEQAOBAAEGwAYCBcAJgQABBsAGAQABCEAIAQABBEADggbACYEAAQbABgEAAQhACAEAAQRAA4", w: "Twinkle, twinkle" },
  hints: { dense: "Try fewer notes.", faint: "Try a longer tune." },
};
