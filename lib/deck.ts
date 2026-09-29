import { SHIRTS, familiesOf, familyOf, getShirtById } from "@/lib/catalog";
import { centeredCosine, makeScorer } from "@/lib/recommendation";
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
  /** The taste isn't known yet after the test: keep probing (see probePick). */
  probe?: { needLikes: boolean },
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
    const shown = [...history, ...next.map((e) => e.id)];
    // Nor the category of the last two cards.
    const recentCats = new Set(shown.slice(-CATEGORY_SPACING).map((id) => getShirtById(id)?.category));
    // A drawn template (one generator's algorithm) is dealt once; archive and photo groups aren't templates.
    const usedTemplates = new Set(shown.map((id) => getShirtById(id)).filter((s) => s?.medium === "drawn").map((s) => s!.variant));
    const fresh = allowed.filter((s) => s.medium !== "drawn" || !usedTemplates.has(s.variant));
    const base = fresh.length ? fresh : allowed;
    const paced = base.filter((s) => !recent.has(s.variant) && !recentCats.has(s.category));
    const pool = paced.length ? paced : base.filter((s) => !recent.has(s.variant)).length ? base.filter((s) => !recent.has(s.variant)) : base;
    const pick = probe
      ? // Still short of likes: every other card is a best guess from the passes so far.
        probe.needLikes && rng() < 0.5
        ? sampleTop(vector, pool, rng)
        : probePick(pool, shown)
      : rng() < EXPLORE_SHARE
        ? wildcard(pool, shown)
        : sampleTop(vector, pool, rng);
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

/**
 * A wildcard: the best design (by the editorial rank, which is led by print
 * quality) from the category shown least so far — a probe of taste the
 * profile hasn't met, never a weak print.
 */
export function wildcard(pool: ShirtProduct[], shown: string[]) {
  const strong = pool.filter((s) => !s.weak);
  const from = strong.length ? strong : pool;
  if (!from.length) return null;
  const count = new Map<string, number>();
  for (const id of shown) {
    const c = getShirtById(id)?.category;
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  const least = Math.min(...from.map((s) => count.get(s.category) ?? 0));
  const best = from.filter((s) => (count.get(s.category) ?? 0) === least).reduce((a, b) => (b.rank < a.rank ? b : a));
  return { shirt: best, strategy: "explore" as const };
}

/** How many recent cards a probe keeps away from. */
export const PROBE_WINDOW = 20;

/**
 * A card unlike anything shown lately (the lowest greatest centred cosine to
 * the last PROBE_WINDOW cards): the taste test's farthest-point idea, carried
 * on until there are enough likes and passes to know the taste.
 */
export function probePick(pool: ShirtProduct[], history: string[]) {
  const recent = history.slice(-PROBE_WINDOW).map((id) => getShirtById(id)?.features).filter((f): f is ShirtProduct["features"] => !!f);
  let best: ShirtProduct | null = null;
  let bestSim = Infinity;
  for (const s of pool) {
    let sim = -Infinity;
    for (const f of recent) sim = Math.max(sim, centeredCosine(s.features, f));
    if (sim < bestSim) (bestSim = sim), (best = s);
  }
  return best ? { shirt: best, strategy: "calibration" as const } : null;
}

/** Calibration progress in families, so a sibling saved from the shop still counts. */
export function calibrationDone(calibrationIds: readonly string[], history: string[]) {
  const seen = familiesOf(history);
  return calibrationIds.filter((id) => seen.has(familyOf(id) ?? "")).length;
}
