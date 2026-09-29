/**
 * A tartan's sett from a name, and the woven cloth in one ink. The sett is
 * seeded by the name (FNV-1a of it in lower case): 4–8 stripes, neighbours
 * unlike and mostly dark against light, a ground stripe of 12 or more, thread counts from a tartan's
 * usual run (2 to 16), 64 threads at most. The cloth is a 2/2 twill: warp
 * thread i shows over weft thread j when (i + j) mod 4 < 2, so the tones
 * step along the diagonal. Each visible thread is a short stroke along its
 * own direction, its weight the tone's; the densest tone is capped at under
 * half a thread, so every cell keeps air beside it and no stripe crossing
 * ever reads as a slab.
 */
import { mulberry32 } from "../rng";
import { fnv1aChars } from "@/lib/hash";
import { STRIPES_MAX, STRIPES_MIN, SETT_MAX, type Tone } from "../specs/tartan";

const fnv = fnv1aChars;
const COUNTS = [2, 2, 4, 4, 4, 6, 6, 8, 8, 12, 16];

export function deriveSett(name: string): [Tone, number][] {
  const rnd = mulberry32(fnv(`tartan:${name.toLowerCase()}`));
  const DARK: Tone[] = ["K", "D"], LIGHT: Tone[] = ["L", "W"];
  for (;;) {
    const n = STRIPES_MIN + Math.floor(rnd() * (STRIPES_MAX - STRIPES_MIN + 1));
    const out: [Tone, number][] = [];
    for (let i = 0; i < n; i++) {
      // Mostly dark against light (the plaid reads in its crossings), now and then two darks or two lights side by side.
      const prev = out[i - 1]?.[0];
      const group = prev === undefined ? (rnd() < 0.5 ? DARK : LIGHT) : (DARK.includes(prev) ? rnd() < 0.75 : rnd() >= 0.75) ? LIGHT : DARK;
      const choices = group.filter((t) => t !== prev);
      out.push([choices[Math.floor(rnd() * choices.length)], COUNTS[Math.floor(rnd() * COUNTS.length)]]);
    }
    const tones = new Set(out.map(([t]) => t));
    const sum = out.reduce((a, [, c]) => a + c, 0);
    // A dark, a light, a ground stripe wide enough to carry the check, and a sett that fits.
    if ((tones.has("K") || tones.has("D")) && (tones.has("L") || tones.has("W")) && out.some(([, c]) => c >= 12) && sum <= SETT_MAX && sum >= 24) return out;
  }
}

/** The full repeat of a symmetric sett: out to the far pivot and back (each pivot once). */
export function repeatOf(sett: [Tone, number][]): Tone[] {
  const half = sett.flatMap(([t, c]) => Array<Tone>(c).fill(t));
  const back = sett.slice(1, -1).reverse().flatMap(([t, c]) => Array<Tone>(c).fill(t));
  return [...half, ...back];
}

/** Stroke weight of a visible thread, as a share of the thread's width (W: none). The densest is capped under a half. */
export const WEIGHT: Record<Tone, number> = { K: 0.5, D: 0.3, L: 0.12, W: 0 };
