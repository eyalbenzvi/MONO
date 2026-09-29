/**
 * Your Island: an island grown from a name (seeded noise, lib/custom/
 * templates/island), with up to six places on it, named for your people.
 */
import { int, label } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The island's name (its seed and its title). */
  n: string;
  /** Up to ISLAND_PLACES place names. */
  x?: string[];
  /** Another island from the same name: 1–ISLAND_REDRAWS (absent: the first). */
  s?: number;
}

export const NAME = "Your Island";
export const ISLAND_NAME_MAX = 20;
export const ISLAND_PLACE_MAX = 14;
export const ISLAND_PLACES = 6;
export const ISLAND_REDRAWS = 99;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, ISLAND_NAME_MAX)) return null;
  let x: { x?: string[] } = {};
  if (p.x !== undefined) {
    // Present means one place at least (none is written as no list).
    if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > ISLAND_PLACES || !p.x.every((v) => label(v, ISLAND_PLACE_MAX))) return null;
    x = { x: [...(p.x as string[])] };
  }
  if (p.s !== undefined && !int(p.s, 1, ISLAND_REDRAWS)) return null;
  return { n: p.n as string, ...x, ...(p.s !== undefined ? { s: p.s as number } : {}) };
}

export const detail = (p: Params) => p.n;

export const PRODUCT: ProductMeta<Params> = {
  line: "An island named for your family, with a place for each of you.",
  from: "A name and your people",
  group: "people",
  base: "contours",
  wordsHint: "Isle of Levi",
  hints: { dense: "Try fewer or shorter names.", faint: "Try another island." },
  example: { n: "Isle of Levi", x: ["Noa", "Dan", "Maya", "Ari", "Tamar"] },
};
