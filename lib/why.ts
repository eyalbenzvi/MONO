import { becauseOf } from "@/lib/because";
import { SHIRTS } from "@/lib/catalog";
import { tierOf, topFraction, type MatchTier } from "@/lib/match";
import { explainMatch, matchScore } from "@/lib/recommendation";
import type { FeatureKey, ShirtProduct, UserProfileVector } from "@/types/shirt";

/** Why a design is shown as a match: every value computed from this visitor's taste. */
export interface WhyMatch {
  tier: MatchTier;
  /** Traits the taste leans to that this design has too (strongest first). */
  shared: FeatureKey[];
  /** Top N% of the catalog for this taste (at least 1). */
  rankPct: number;
  total: number;
  /** The saved design it's most like (another family), when one is alike enough. */
  like: ShirtProduct | null;
  /** It's one the visitor saved. */
  saved: boolean;
}

/**
 * The reasons behind a "Top pick" / "strong match" line, or null when there
 * are none worth saying: not in the top tiers, or no trait in common (a
 * percentile alone, from a barely formed taste, isn't a reason). The line
 * is shown only when this is not null.
 */
export function whyMatch(vector: UserProfileVector, shirt: ShirtProduct, likedIds: readonly string[]): WhyMatch | null {
  const score = matchScore(vector, shirt.features);
  const tier = tierOf(vector, score);
  if (tier !== "top" && tier !== "strong") return null;
  const shared = explainMatch(vector, shirt.features, 3);
  if (shared.length === 0) return null;
  const saved = likedIds.includes(shirt.id);
  return {
    tier,
    shared,
    rankPct: Math.max(1, Math.ceil(topFraction(vector, score) * 100)),
    total: SHIRTS.length,
    like: saved ? null : becauseOf(shirt, likedIds),
    saved,
  };
}
