import { CALIBRATION_IDS, SHIRTS, familiesOf, familyOf, getShirtById } from "@/lib/catalog";
import { getNextCard, makeScorer } from "@/lib/recommendation";
import type { RecommendationStrategy, ShirtProduct, UserProfileVector } from "@/types/shirt";

export const DECK_SIZE = 3;

/** Don't repeat an algorithm (e.g. two perspective corridors) within this many cards. */
export const VARIANT_SPACING = 5;

/**
 * The taste test: one representative per design family (so it never shows
 * two variations of one print), covering as many categories as it has
 * slots, boldest print first. Precomputed by the generator (getCalibrationQueue
 * over the family leaders); tests check it matches the runtime algorithm.
 */
export { CALIBRATION_IDS, CALIBRATION_TOTAL } from "@/lib/catalog";

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
    // Nor the category of the last two cards.
    const recentCats = new Set([...history, ...next.map((e) => e.id)].slice(-CATEGORY_SPACING).map((id) => getShirtById(id)?.category));
    const paced = allowed.filter((s) => !recent.has(s.variant) && !recentCats.has(s.category));
    const pool = paced.length ? paced : allowed.filter((s) => !recent.has(s.variant)).length ? allowed.filter((s) => !recent.has(s.variant)) : allowed;
    const pick = rng() < EXPLORE_SHARE ? getNextCard(vector, pool, [], "explore", rng) : sampleTop(vector, pool, rng);
    if (!pick) break;
    next.push({ id: pick.shirt.id, strategy: pick.strategy });
    seenFamilies.add(pick.shirt.family);
  }
  return next;
}

/** Don't deal a category that was on either of the last this-many cards. */
export const CATEGORY_SPACING = 2;
/** Share of cards that probe taste the profile hasn't committed to. */
export const EXPLORE_SHARE = 0.2;
/** Greedy cards are drawn from this many best matches, not always the very best. */
export const SAMPLE_TOP = 15;

/**
 * A good match, not always the same one: one of the SAMPLE_TOP best, drawn
 * with weights that favour the closest (softmax over the match score), so
 * two people with similar taste — or the same person on another day — see
 * different cards.
 */
function sampleTop(vector: UserProfileVector, pool: ShirtProduct[], rng: () => number) {
  if (!pool.length) return null;
  const score = makeScorer(vector);
  const top = pool.map((shirt) => ({ shirt, s: score(shirt.features).score })).sort((a, b) => b.s - a.s).slice(0, SAMPLE_TOP);
  const w = top.map((t) => Math.exp((t.s - top[0].s) / 4));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) if ((r -= w[i]) <= 0) return { shirt: top[i].shirt, strategy: "greedy" as const };
  return { shirt: top[0].shirt, strategy: "greedy" as const };
}

/** Calibration progress in families, so a sibling saved from the shop still counts. */
export function calibrationDone(calibrationIds: readonly string[], history: string[]) {
  const seen = familiesOf(history);
  return calibrationIds.filter((id) => seen.has(familyOf(id) ?? "")).length;
}
