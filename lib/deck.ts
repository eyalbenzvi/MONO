import { CALIBRATION_IDS, SHIRTS, familiesOf, familyOf, getShirtById } from "@/lib/catalog";
import { getNextCard } from "@/lib/recommendation";
import type { RecommendationStrategy, UserProfileVector } from "@/types/shirt";

export const DECK_SIZE = 3;

/** Don't repeat an algorithm (e.g. two perspective corridors) within this many cards. */
export const VARIANT_SPACING = 5;

/**
 * The taste test: one representative per design family (so it never shows
 * two variations of one print), covering as many categories as it has
 * slots, boldest print first. Precomputed by the generator (getCalibrationQueue
 * over the family leaders); tests check it matches the runtime algorithm.
 */
export { CALIBRATION_IDS };
export const CALIBRATION_TOTAL = CALIBRATION_IDS.length;

export interface DeckEntry {
  id: string;
  strategy: RecommendationStrategy;
}

/**
 * Fill the Discover deck.
 *
 * - **No near-duplicates in a run:** once any design of a family has been
 *   shown (swiped, saved, or already in the deck), no other member of that
 *   family is dealt.
 * - **Pacing:** avoid dealing the same algorithm as any of the last
 *   VARIANT_SPACING cards; relaxed automatically when nothing else is left.
 * - Calibration cards come first (one per family by construction), then the
 *   recommender (80% greedy / 20% explore) picks from what's allowed.
 *
 * `history` is the ordered list of shown shirt ids (oldest first).
 */
export function buildDeck(
  deck: DeckEntry[],
  vector: UserProfileVector,
  history: string[],
  calibrationIds: readonly string[],
  rng: () => number = Math.random,
): DeckEntry[] {
  const seenFamilies = familiesOf(history);
  const next: DeckEntry[] = [];
  for (const e of deck) {
    const f = familyOf(e.id);
    if (!f || seenFamilies.has(f)) continue; // unknown, or its family was shown meanwhile
    next.push(e);
    seenFamilies.add(f);
  }

  const recentVariants = () =>
    new Set(
      [...history, ...next.map((e) => e.id)]
        .slice(-VARIANT_SPACING)
        .map((id) => getShirtById(id)?.variant),
    );

  while (next.length < DECK_SIZE) {
    const calibrationId = calibrationIds.find((id) => !seenFamilies.has(familyOf(id) ?? ""));
    if (calibrationId) {
      next.push({ id: calibrationId, strategy: "calibration" });
      seenFamilies.add(familyOf(calibrationId)!);
      continue;
    }
    const allowed = SHIRTS.filter((s) => !seenFamilies.has(s.family));
    if (allowed.length === 0) break;
    const recent = recentVariants();
    const paced = allowed.filter((s) => !recent.has(s.variant));
    const pick = getNextCard(vector, paced.length ? paced : allowed, [], undefined, rng);
    if (!pick) break;
    next.push({ id: pick.shirt.id, strategy: pick.strategy });
    seenFamilies.add(pick.shirt.family);
  }
  return next;
}

/** Calibration progress in families, so a sibling saved from the shop still counts. */
export function calibrationDone(calibrationIds: readonly string[], history: string[]) {
  const seen = familiesOf(history);
  return calibrationIds.filter((id) => seen.has(familyOf(id) ?? "")).length;
}
