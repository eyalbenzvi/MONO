import {
  FEATURE_KEYS,
  type FeatureKey,
  type FeatureVector,
  type RecommendationStrategy,
  type ShirtProduct,
  type SwipeAction,
  type UserProfileVector,
} from "@/types/shirt";

export const LIKE_RATE = 0.15;
export const DISLIKE_RATE = 0.08;
export const EXPLORE_PROBABILITY = 0.2;
export const CALIBRATION_SIZE = 10;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));


/**
 * Cosine similarity mapped to a 0–100 percentage.
 *
 * All vectors live in the positive orthant ([0,1]^n) so the raw cosine is
 * already in [0, 1]; we scale it to a percentage. A zero vector has no
 * direction, so it scores 0.
 */
export function cosineSimilarity(vecA: FeatureVector, vecB: FeatureVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of FEATURE_KEYS) {
    dot += vecA[k] * vecB[k];
    magA += vecA[k] * vecA[k];
    magB += vecB[k] * vecB[k];
  }
  if (magA === 0 || magB === 0) return 0;
  const cos = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  return clamp01(cos) * 100;
}

/**
 * Cosine similarity of the *centered* vectors (each value minus 0.5).
 *
 * Raw cosine between positive vectors is compressed into a narrow high band
 * (most pairs land at 75–95%). Centering around the neutral 0.5 point makes
 * "high vs. low" on each axis count, which is what we want both for
 * diversity (calibration / explore) and for a readable match score.
 * Returns a value in [-1, 1]; 0 when either vector is neutral.
 */
export function centeredCosine(vecA: FeatureVector, vecB: FeatureVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of FEATURE_KEYS) {
    const a = vecA[k] - 0.5;
    const b = vecB[k] - 0.5;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * User-facing match score (0–100). Blends the plain cosine similarity with
 * the centered cosine so scores spread across the range as the profile
 * sharpens, while a fresh (all 0.5) profile shows the plain cosine.
 */
export function matchScore(userVec: UserProfileVector, features: FeatureVector): number {
  const raw = cosineSimilarity(userVec, features); // 0..100
  let spread = 0;
  for (const k of FEATURE_KEYS) spread += Math.abs(userVec[k] - 0.5);
  // How far the profile has moved from neutral; saturates quickly.
  const confidence = clamp01(spread / (FEATURE_KEYS.length * 0.12));
  const centered = ((centeredCosine(userVec, features) + 1) / 2) * 100; // 0..100
  return Math.round(raw * (1 - confidence) + centered * confidence);
}

/**
 * Move the user vector toward (like) or away from (dislike) a shirt.
 *   like:    new = cur + 0.15 * (features - cur)
 *   dislike: new = cur - 0.08 * (features - cur)
 * Each dimension is clamped to [0, 1].
 */
export function updateUserVector(
  currentVec: UserProfileVector,
  shirtFeatures: FeatureVector,
  action: SwipeAction,
): UserProfileVector {
  const next = { ...currentVec };
  for (const k of FEATURE_KEYS) {
    const delta = shirtFeatures[k] - currentVec[k];
    const updated =
      action === "like"
        ? currentVec[k] + LIKE_RATE * delta
        : currentVec[k] - DISLIKE_RATE * delta;
    next[k] = clamp01(updated);
  }
  return next;
}

/**
 * Pick the first N cards for cold start via greedy farthest-point sampling:
 * start with the most "opinionated" shirt (furthest from neutral), then keep
 * adding the shirt whose maximum centered-cosine similarity to anything
 * already chosen is lowest. This yields a maximally orthogonal set that
 * probes every axis of taste.
 */
export function getCalibrationQueue(
  shirts: ShirtProduct[],
  size: number = CALIBRATION_SIZE,
  /** Optional coverage key (e.g. category): prefer candidates whose key is not used yet. */
  keyOf?: (s: ShirtProduct) => string,
): ShirtProduct[] {
  if (shirts.length === 0) return [];
  const pool = [...shirts];
  const distFromNeutral = (s: ShirtProduct) =>
    FEATURE_KEYS.reduce((sum, k) => sum + (s.features[k] - 0.5) ** 2, 0);

  pool.sort((a, b) => distFromNeutral(b) - distFromNeutral(a) || a.id.localeCompare(b.id));
  const chosen: ShirtProduct[] = [pool.shift()!];

  while (chosen.length < Math.min(size, shirts.length)) {
    let bestIdx = 0;
    let bestScore = Infinity;
    const used = keyOf ? new Set(chosen.map(keyOf)) : null;
    const coverageLeft = used !== null && pool.some((c) => !used.has(keyOf!(c)));
    pool.forEach((candidate, idx) => {
      if (coverageLeft && used!.has(keyOf!(candidate))) return;
      const maxSim = Math.max(
        ...chosen.map((c) => centeredCosine(c.features, candidate.features)),
      );
      if (maxSim < bestScore) {
        bestScore = maxSim;
        bestIdx = idx;
      }
    });
    chosen.push(pool.splice(bestIdx, 1)[0]);
  }
  return chosen;
}

export interface NextCardResult {
  shirt: ShirtProduct;
  strategy: Exclude<RecommendationStrategy, "calibration">;
  score: number;
}

/**
 * Choose the next card from the unseen pool.
 *  - greedy:  highest match score to the user vector.
 *  - explore: the shirt most orthogonal to the user vector (centered cosine
 *             closest to 0) — probes taste dimensions the profile hasn't
 *             committed to, without serving an obvious anti-match.
 * When `strategy` is omitted it is rolled: 80% greedy / 20% explore.
 */
export function getNextCard(
  userVec: UserProfileVector,
  availableShirts: ShirtProduct[],
  seenIds: Iterable<string>,
  strategy?: "greedy" | "explore",
  rng: () => number = Math.random,
): NextCardResult | null {
  const seen = new Set(seenIds);
  const unseen = availableShirts.filter((s) => !seen.has(s.id));
  if (unseen.length === 0) return null;

  const chosenStrategy = strategy ?? (rng() < EXPLORE_PROBABILITY ? "explore" : "greedy");

  let best = unseen[0];
  let bestKey = chosenStrategy === "greedy" ? -Infinity : Infinity;
  for (const shirt of unseen) {
    const key =
      chosenStrategy === "greedy"
        ? matchScore(userVec, shirt.features) + cosineSimilarity(userVec, shirt.features) / 1000
        : Math.abs(centeredCosine(userVec, shirt.features));
    if (chosenStrategy === "greedy" ? key > bestKey : key < bestKey) {
      bestKey = key;
      best = shirt;
    }
  }
  return { shirt: best, strategy: chosenStrategy, score: matchScore(userVec, best.features) };
}

/** Per-feature contribution breakdown for the debug panel. */
export function similarityBreakdown(userVec: UserProfileVector, features: FeatureVector) {
  const dot = FEATURE_KEYS.reduce((s, k) => s + userVec[k] * features[k], 0);
  return FEATURE_KEYS.map((k) => ({
    key: k,
    user: userVec[k],
    shirt: features[k],
    product: userVec[k] * features[k],
    share: dot === 0 ? 0 : (userVec[k] * features[k]) / dot,
  }));
}

/* ------------------------------------------------------------------ */
/* Shop helpers                                                        */
/* ------------------------------------------------------------------ */

export type ShopSort = "match" | "price-asc" | "price-desc";

export interface RankedShirt {
  shirt: ShirtProduct;
  score: number;
}

/** Catalog ordered for the storefront. Ties fall back to raw cosine, then id. */
export function rankShirts(
  userVec: UserProfileVector,
  shirts: ShirtProduct[],
  sort: ShopSort = "match",
): RankedShirt[] {
  const ranked = shirts.map((shirt) => ({
    shirt,
    score: matchScore(userVec, shirt.features),
    raw: cosineSimilarity(userVec, shirt.features),
  }));
  ranked.sort((a, b) => {
    if (sort === "price-asc" && a.shirt.price !== b.shirt.price) return a.shirt.price - b.shirt.price;
    if (sort === "price-desc" && a.shirt.price !== b.shirt.price) return b.shirt.price - a.shirt.price;
    return b.score - a.score || b.raw - a.raw || a.shirt.id.localeCompare(b.shirt.id);
  });
  return ranked.map(({ shirt, score }) => ({ shirt, score }));
}

/** Prints closest in style to `shirt` (centered cosine), excluding itself. */
export function similarShirts(shirt: ShirtProduct, shirts: ShirtProduct[], n = 4): ShirtProduct[] {
  return shirts
    .filter((s) => s.id !== shirt.id)
    .map((s) => ({ s, sim: centeredCosine(shirt.features, s.features) }))
    .sort((a, b) => b.sim - a.sim || a.s.id.localeCompare(b.s.id))
    .slice(0, n)
    .map(({ s }) => s);
}

/**
 * Features that push this shirt's match up: both the user and the shirt sit
 * on the same side of neutral. Returned strongest first.
 */
export function explainMatch(userVec: UserProfileVector, features: FeatureVector, n = 3) {
  return FEATURE_KEYS.map((key) => ({ key, weight: (userVec[key] - 0.5) * (features[key] - 0.5) }))
    .filter((f) => f.weight > 0.001 && userVec[f.key] > 0.5)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
    .map((f) => f.key);
}

/** The user's strongest leanings (dimensions furthest above neutral). */
export function topTraits(userVec: UserProfileVector, n = 3) {
  return FEATURE_KEYS.filter((k) => userVec[k] > 0.52)
    .sort((a, b) => userVec[b] - userVec[a])
    .slice(0, n);
}

/**
 * Display-only "how defined is this taste profile" in [0, 1], from how far
 * the vector has moved away from neutral. Uses a gentler scale than the
 * confidence inside matchScore (which saturates after a handful of swipes)
 * so the meter keeps moving; it does not affect any score.
 */
export function profileSharpness(userVec: UserProfileVector): number {
  let spread = 0;
  for (const k of FEATURE_KEYS) spread += Math.abs(userVec[k] - 0.5);
  return clamp01(spread / (FEATURE_KEYS.length * 0.25));
}

/** The feature a swipe moved most — used for the "learning" chip after each swipe. */
export function biggestShift(before: UserProfileVector, after: UserProfileVector, action: SwipeAction) {
  let best: FeatureKey | null = null;
  let bestDelta = 0;
  for (const k of FEATURE_KEYS) {
    const d = after[k] - before[k];
    // like → largest increase; pass → largest decrease
    const signed = action === "like" ? d : -d;
    if (signed > bestDelta) {
      bestDelta = signed;
      best = k;
    }
  }
  return best;
}
