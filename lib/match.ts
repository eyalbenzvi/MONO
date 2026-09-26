import { SHIRTS } from "@/lib/catalog";
import { makeScorer } from "@/lib/recommendation";
import type { FeatureVector, UserProfileVector } from "@/types/shirt";

/**
 * What a match score means to a person. Raw cosine scores bunch up (most of
 * the catalog lands at 90%+ once a profile forms), so the UI speaks in
 * tiers by *percentile within the catalog* instead of a bare percentage.
 */
export type MatchTier = "top" | "strong" | "good";

export const TIER_LABEL: Record<MatchTier, string> = {
  top: "Top pick",
  strong: "Strong match",
  good: "Good match",
};

/** Share of the catalog (from the top) each tier covers. */
const TIER_CUTS: [MatchTier, number][] = [
  ["top", 0.02],
  ["strong", 0.08],
  ["good", 0.2],
];

let cache: { vector: UserProfileVector; sorted: number[] } | null = null;

/** Every design's score for this profile, ascending (cached per vector object). */
function distribution(vector: UserProfileVector) {
  if (cache?.vector !== vector) {
    const score = makeScorer(vector);
    cache = { vector, sorted: SHIRTS.map((s) => score(s.features).score).sort((a, b) => a - b) };
  }
  return cache.sorted;
}

/** Fraction of the catalog that scores strictly higher (0 = the very best). */
export function topFraction(vector: UserProfileVector, score: number) {
  const sorted = distribution(vector);
  // First index with a value > score.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= score) lo = mid + 1;
    else hi = mid;
  }
  return (sorted.length - lo) / sorted.length;
}

export function tierOf(vector: UserProfileVector, score: number): MatchTier | null {
  const f = topFraction(vector, score);
  return TIER_CUTS.find(([, cut]) => f < cut)?.[0] ?? null;
}

export function matchTier(vector: UserProfileVector, features: FeatureVector): MatchTier | null {
  return tierOf(vector, makeScorer(vector)(features).score);
}
