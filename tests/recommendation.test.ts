import { describe, expect, it } from "vitest";
import {
  centeredCosine,
  cosineSimilarity,
  explainMatch,
  getCalibrationQueue,
  getNextCard,
  matchScore,
  rankShirts,
  similarShirts,
  topTraits,
  profileSharpness,
  biggestShift,
  updateUserVector,
} from "@/lib/recommendation";
import { SHIRTS } from "@/lib/catalog";
import { FEATURE_KEYS, createInitialVector, type FeatureVector } from "@/types/shirt";

const vec = (fill: (i: number) => number): FeatureVector =>
  Object.fromEntries(FEATURE_KEYS.map((k, i) => [k, fill(i)])) as FeatureVector;

describe("cosineSimilarity", () => {
  it("is 100 for identical and parallel vectors", () => {
    const a = vec((i) => (i + 1) / 10);
    expect(cosineSimilarity(a, a)).toBeCloseTo(100, 6);
    expect(cosineSimilarity(a, vec((i) => (i + 1) / 20))).toBeCloseTo(100, 6);
  });

  it("is 0 for orthogonal vectors and zero vectors", () => {
    const a = vec((i) => (i % 2 === 0 ? 1 : 0));
    const b = vec((i) => (i % 2 === 1 ? 1 : 0));
    expect(cosineSimilarity(a, b)).toBe(0);
    expect(cosineSimilarity(a, vec(() => 0))).toBe(0);
  });

  it("matches a hand-computed value", () => {
    // a = [1,1,0...], b = [1,0,0...] -> cos = 1/sqrt(2)
    const a = vec((i) => (i < 2 ? 1 : 0));
    const b = vec((i) => (i === 0 ? 1 : 0));
    expect(cosineSimilarity(a, b)).toBeCloseTo(100 / Math.SQRT2, 6);
  });
});

describe("centeredCosine", () => {
  it("is -1 for mirrored vectors and 0 for neutral", () => {
    const a = vec((i) => (i % 2 ? 0.9 : 0.1));
    const b = vec((i) => (i % 2 ? 0.1 : 0.9));
    expect(centeredCosine(a, b)).toBeCloseTo(-1, 6);
    expect(centeredCosine(a, createInitialVector())).toBe(0);
  });
});

describe("updateUserVector", () => {
  const cur = createInitialVector();
  const shirt = vec((i) => (i < 5 ? 1 : 0));

  it("applies like: cur + 0.15 * (f - cur)", () => {
    const next = updateUserVector(cur, shirt, "like");
    expect(next.geometric).toBeCloseTo(0.5 + 0.15 * 0.5, 10);
    expect(next.density).toBeCloseTo(0.5 - 0.15 * 0.5, 10);
  });

  it("applies dislike: cur - 0.08 * (f - cur)", () => {
    const next = updateUserVector(cur, shirt, "dislike");
    expect(next.geometric).toBeCloseTo(0.5 - 0.08 * 0.5, 10);
    expect(next.density).toBeCloseTo(0.5 + 0.08 * 0.5, 10);
  });

  it("clamps to [0, 1]", () => {
    const edge = vec((i) => (i < 5 ? 0.99 : 0.01));
    const opposite = vec((i) => (i < 5 ? 0 : 1));
    let v = edge;
    for (let n = 0; n < 50; n++) v = updateUserVector(v, opposite, "dislike");
    for (const k of FEATURE_KEYS) {
      expect(v[k]).toBeGreaterThanOrEqual(0);
      expect(v[k]).toBeLessThanOrEqual(1);
    }
    expect(v.geometric).toBe(1);
    expect(v.density).toBe(0);
  });

  it("does not mutate the input", () => {
    const copy = { ...cur };
    updateUserVector(cur, shirt, "like");
    expect(cur).toEqual(copy);
  });

  it("converges toward repeatedly liked features", () => {
    let v = createInitialVector();
    for (let n = 0; n < 40; n++) v = updateUserVector(v, shirt, "like");
    expect(cosineSimilarity(v, shirt)).toBeGreaterThan(99);
  });
});

describe("getCalibrationQueue", () => {
  it("returns 10 unique shirts", () => {
    const q = getCalibrationQueue(SHIRTS);
    expect(q).toHaveLength(10);
    expect(new Set(q.map((s) => s.id)).size).toBe(10);
  });

  it("avoids near-duplicates better than a naive first-10 slice", () => {
    // Farthest-point sampling minimises the *closest* pair, so compare that.
    const maxPairwise = (list: typeof SHIRTS) => {
      let max = -1;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          max = Math.max(max, centeredCosine(list[i].features, list[j].features));
      return max;
    };
    expect(maxPairwise(getCalibrationQueue(SHIRTS))).toBeLessThan(maxPairwise(SHIRTS.slice(0, 10)));
  });

  it("probes every generative category", () => {
    const cats = new Set(getCalibrationQueue(SHIRTS, 10, (s) => s.category).map((s) => s.category));
    expect(cats.size).toBe(10);
  });

  it("handles small inputs", () => {
    expect(getCalibrationQueue([])).toEqual([]);
    expect(getCalibrationQueue(SHIRTS.slice(0, 3))).toHaveLength(3);
  });
});

describe("getNextCard", () => {
  const userVec = SHIRTS[0].features;

  it("greedy picks the highest match among unseen", () => {
    const res = getNextCard(userVec, SHIRTS, [], "greedy")!;
    expect(res.shirt.id).toBe(SHIRTS[0].id);
    const others = SHIRTS.filter((s) => s.id !== res.shirt.id);
    for (const s of others) expect(matchScore(userVec, s.features)).toBeLessThanOrEqual(res.score);
  });

  it("skips seen ids and returns null when exhausted", () => {
    const res = getNextCard(userVec, SHIRTS, [SHIRTS[0].id], "greedy")!;
    expect(res.shirt.id).not.toBe(SHIRTS[0].id);
    expect(getNextCard(userVec, SHIRTS, SHIRTS.map((s) => s.id))).toBeNull();
  });

  it("explore picks the most orthogonal shirt", () => {
    const res = getNextCard(userVec, SHIRTS, [], "explore")!;
    const minAbs = Math.min(...SHIRTS.map((s) => Math.abs(centeredCosine(userVec, s.features))));
    expect(Math.abs(centeredCosine(userVec, res.shirt.features))).toBeCloseTo(minAbs, 10);
  });

  it("rolls ~80/20 greedy/explore when strategy is omitted", () => {
    expect(getNextCard(userVec, SHIRTS, [], undefined, () => 0.1)!.strategy).toBe("explore");
    expect(getNextCard(userVec, SHIRTS, [], undefined, () => 0.5)!.strategy).toBe("greedy");
  });
});

describe("shop ranking", () => {
  const userVec = SHIRTS[3].features;

  it("orders by match score by default and keeps every shirt", () => {
    const ranked = rankShirts(userVec, SHIRTS);
    expect(ranked).toHaveLength(SHIRTS.length);
    // The shirt whose features *are* the user vector must rank at the top score.
    expect(ranked[0].score).toBe(matchScore(userVec, SHIRTS[3].features));
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it("sorts by price when asked", () => {
    const asc = rankShirts(userVec, SHIRTS, "price-asc").map((r) => r.shirt.price);
    const desc = rankShirts(userVec, SHIRTS, "price-desc").map((r) => r.shirt.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it("similarShirts excludes the shirt itself and returns the closest styles", () => {
    const base = SHIRTS[0];
    const sim = similarShirts(base, SHIRTS, 4);
    expect(sim).toHaveLength(4);
    expect(sim.map((s) => s.id)).not.toContain(base.id);
    const worst = Math.min(...sim.map((s) => centeredCosine(base.features, s.features)));
    const rest = SHIRTS.filter((s) => s.id !== base.id && !sim.includes(s));
    for (const s of rest) expect(centeredCosine(base.features, s.features)).toBeLessThanOrEqual(worst);
  });

  it("explainMatch only names traits the user actually leans towards", () => {
    const v = { ...createInitialVector(), architectural: 0.9, clean_minimal: 0.8, typography: 0.1 };
    const shirt = { ...createInitialVector(0.2), architectural: 0.95, clean_minimal: 0.9, typography: 0.05 };
    const reasons = explainMatch(v, shirt);
    expect(reasons).toEqual(["architectural", "clean_minimal"]);
    expect(explainMatch(createInitialVector(), shirt)).toEqual([]);
  });

  it("topTraits lists the strongest leanings first", () => {
    const v = { ...createInitialVector(), halftone_raster: 0.8, contrast: 0.7, abstract: 0.3 };
    expect(topTraits(v)).toEqual(["halftone_raster", "contrast"]);
  });
});

describe("display helpers (no effect on scores)", () => {
  it("profileSharpness grows as the profile leaves neutral", () => {
    expect(profileSharpness(createInitialVector())).toBe(0);
    let v = createInitialVector();
    const s0 = profileSharpness(v);
    for (let i = 0; i < 5; i++) v = updateUserVector(v, SHIRTS[0].features, "like");
    expect(profileSharpness(v)).toBeGreaterThan(s0);
    expect(profileSharpness(vec(() => 1))).toBe(1);
  });

  it("biggestShift names the most-moved trait in the swipe's direction", () => {
    const before = createInitialVector();
    const shirt = { ...createInitialVector(0.5), typography: 1, halftone_raster: 0.9 };
    expect(biggestShift(before, updateUserVector(before, shirt, "like"), "like")).toBe("typography");
    expect(biggestShift(before, updateUserVector(before, shirt, "dislike"), "dislike")).toBe("typography");
    expect(biggestShift(before, before, "like")).toBeNull();
  });
});
