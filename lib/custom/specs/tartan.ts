/**
 * Your Tartan: a family name, and optionally the sett written out (advanced:
 * the stripes edited). Without one, the sett is derived from the name
 * (lib/custom/draw/tartan). A sett is 4–8 stripes, each a tone and a thread
 * count: K the densest hatch, D dense, L sparse, W blank ("K8W2D12L4").
 */
import { label, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The family name, as it prints in "The <Name> Sett". */
  n: string;
  /** The sett, when edited: tone letters and counts, 4–8 stripes, neighbours unlike. */
  t?: string;
  w?: string;
}

export const NAME = "Your Tartan";
export const TARTAN_NAME_MAX = 18;
export const TONES = ["K", "D", "L", "W"] as const;
export type Tone = (typeof TONES)[number];
export const STRIPES_MIN = 4, STRIPES_MAX = 8, COUNT_MAX = 16, SETT_MAX = 64;

/** A sett's stripes, or null when it isn't one (the form, 4–8 stripes, counts 1–16 without leading zeros, neighbours unlike, 64 threads at most). */
export function parseSett(t: unknown): [Tone, number][] | null {
  if (typeof t !== "string" || !/^([KDLW][1-9]\d?){4,8}$/.test(t)) return null;
  const out = [...t.matchAll(/([KDLW])(\d+)/g)].map((m) => [m[1] as Tone, Number(m[2])] as [Tone, number]);
  if (out.length < STRIPES_MIN || out.length > STRIPES_MAX || out.some(([, c]) => c > COUNT_MAX)) return null;
  if (out.some(([tone], i) => i > 0 && tone === out[i - 1][0])) return null;
  return out.reduce((a, [, c]) => a + c, 0) <= SETT_MAX ? out : null;
}
export const settText = (s: [Tone, number][]) => s.map(([t, c]) => `${t}${c}`).join("");

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, TARTAN_NAME_MAX)) return null;
  if (p.t !== undefined && !parseSett(p.t)) return null;
  const w = wordsOf(p);
  if (!w) return null;
  return { n: p.n, ...(p.t !== undefined ? { t: p.t as string } : {}), ...w };
}

export const detail = (p: Params) => `The ${p.n} Sett`;

export const PRODUCT: ProductMeta<Params> = {
  line: "A tartan woven from your family name, its sett printed underneath.",
  from: "A family name",
  group: "name",
  base: "tiling",
  wordsHint: "Est. 1952",
  example: { n: "Mackenzie" },
  hints: { dense: "Try more blank or sparse stripes.", faint: "Try a denser stripe or two." },
};
