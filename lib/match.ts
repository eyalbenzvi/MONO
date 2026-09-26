import { SHIRTS, paceByVariant } from "@/lib/catalog";
import { makeScorer } from "@/lib/recommendation";
import type { FeatureVector, ShirtProduct, UserProfileVector } from "@/types/shirt";

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

/**
 * The last two profiles' score distributions (LRU of 2, by vector object):
 * the shop grid ranks with a snapshot while the live vector moves on, and
 * both are asked for in turn — one slot would recompute on every call.
 */
const cache: { vector: UserProfileVector; sorted: number[] }[] = [];

/** Every design's score for this profile, ascending. */
function distribution(vector: UserProfileVector) {
  const i = cache.findIndex((c) => c.vector === vector);
  if (i !== -1) {
    const [hit] = cache.splice(i, 1);
    cache.unshift(hit);
    return hit.sorted;
  }
  const score = makeScorer(vector);
  const entry = { vector, sorted: SHIRTS.map((s) => score(s.features).score).sort((a, b) => a - b) };
  cache.unshift(entry);
  cache.length = Math.min(cache.length, 2);
  return entry.sorted;
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

/**
 * The best few designs for a profile, for every "picked for you" row (the
 * bag, after an order, the taste-test screen, the taste card): one per
 * family, none from `excludeFamilies` (already in the bag or bought), no weak prints, no
 * algorithm twice within `paceWindow`, and at least `minCategories`
 * categories. Top-k selection (a small sorted buffer), not a full sort.
 */
export function topPicks(
  vector: UserProfileVector,
  n = 3,
  { excludeFamilies = new Set<string>(), minCategories = 2, paceWindow = 3, pool = SHIRTS }: { excludeFamilies?: ReadonlySet<string>; minCategories?: number; paceWindow?: number; pool?: readonly ShirtProduct[] } = {},
): ShirtProduct[] {
  const score = makeScorer(vector);
  const k = Math.max(48, n * 16);
  const top: { shirt: ShirtProduct; score: number; raw: number }[] = [];
  const better = (a: (typeof top)[number], b: (typeof top)[number]) => a.score > b.score || (a.score === b.score && (a.raw > b.raw || (a.raw === b.raw && a.shirt.id < b.shirt.id)));
  for (const shirt of pool) {
    if (shirt.weak || excludeFamilies.has(shirt.family)) continue;
    const item = { shirt, ...score(shirt.features) };
    if (top.length === k && !better(item, top[k - 1])) continue;
    let i = top.length;
    while (i > 0 && better(item, top[i - 1])) i--;
    top.splice(i, 0, item);
    if (top.length > k) top.pop();
  }
  const families = new Set<string>();
  const unique = top.filter(({ shirt }) => !families.has(shirt.family) && families.add(shirt.family));
  const picks = paceByVariant(unique, paceWindow).slice(0, n).map((x) => x.shirt);
  // Too alike: swap the last pick for the best one from another category.
  // (The buffer can be all one category for a one-note taste: then scan.)
  if (picks.length > 1 && new Set(picks.map((s) => s.category)).size < Math.min(minCategories, n)) {
    const taken = new Set(picks.map((p) => p.category));
    let other = unique.find(({ shirt }) => !taken.has(shirt.category));
    if (!other)
      for (const shirt of pool) {
        if (shirt.weak || taken.has(shirt.category) || excludeFamilies.has(shirt.family)) continue;
        const item = { shirt, ...score(shirt.features) };
        if (!other || better(item, other)) other = item;
      }
    if (other) picks[picks.length - 1] = other.shirt;
  }
  return picks;
}
