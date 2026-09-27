/**
 * "Like this": how close a design is to another, from what they are (the
 * feature vectors) and how they look (the dHash of their prints).
 */
import { centeredCosine } from "@/lib/recommendation";
import type { ShirtProduct } from "@/types/shirt";
import type { SearchIndex } from "./format";

export const LIKE_FEATURES = 0.6;
export const LIKE_LOOK = 0.4;

function popcount(x: number) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Differing bits between two designs' dHashes (0–64). */
export const hamming = (index: SearchIndex, a: number, b: number) => popcount(index.hash[a * 2] ^ index.hash[b * 2]) + popcount(index.hash[a * 2 + 1] ^ index.hash[b * 2 + 1]);

/** Every design's closeness to the one at `from` (−0.6…1). */
export function likeScores(index: SearchIndex, catalog: readonly ShirtProduct[], from: number): Float64Array {
  const out = new Float64Array(catalog.length);
  const f = catalog[from].features;
  for (let i = 0; i < catalog.length; i++) out[i] = LIKE_FEATURES * centeredCosine(f, catalog[i].features) + LIKE_LOOK * (1 - hamming(index, from, i) / 64);
  return out;
}
