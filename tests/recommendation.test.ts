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
  updateUserVector,
} from "@/lib/recommendation";
import { MOCK_SHIRTS } from "@/lib/mockData";
import { FEATURE_KEYS, createInitialVector, teeColorForTone, type FeatureVector } from "@/types/shirt";

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
    const q = getCalibrationQueue(MOCK_SHIRTS);
    expect(q).toHaveLength(10);
    expect(new Set(q.map((s) => s.id)).size).toBe(10);
  });

  it("is more diverse than a naive first-10 slice", () => {
    const avgPairwise = (list: typeof MOCK_SHIRTS) => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          sum += centeredCosine(list[i].features, list[j].features);
          n++;
        }
      return sum / n;
    };
    expect(avgPairwise(getCalibrationQueue(MOCK_SHIRTS))).toBeLessThan(
      avgPairwise(MOCK_SHIRTS.slice(0, 10)),
    );
  });

  it("handles small inputs", () => {
    expect(getCalibrationQueue([])).toEqual([]);
    expect(getCalibrationQueue(MOCK_SHIRTS.slice(0, 3))).toHaveLength(3);
  });
});

describe("getNextCard", () => {
  const userVec = MOCK_SHIRTS[0].features;

  it("greedy picks the highest match among unseen", () => {
    const res = getNextCard(userVec, MOCK_SHIRTS, [], "greedy")!;
    expect(res.shirt.id).toBe(MOCK_SHIRTS[0].id);
    const others = MOCK_SHIRTS.filter((s) => s.id !== res.shirt.id);
    for (const s of others) expect(matchScore(userVec, s.features)).toBeLessThanOrEqual(res.score);
  });

  it("skips seen ids and returns null when exhausted", () => {
    const res = getNextCard(userVec, MOCK_SHIRTS, [MOCK_SHIRTS[0].id], "greedy")!;
    expect(res.shirt.id).not.toBe(MOCK_SHIRTS[0].id);
    expect(getNextCard(userVec, MOCK_SHIRTS, MOCK_SHIRTS.map((s) => s.id))).toBeNull();
  });

  it("explore picks the most orthogonal shirt", () => {
    const res = getNextCard(userVec, MOCK_SHIRTS, [], "explore")!;
    const minAbs = Math.min(...MOCK_SHIRTS.map((s) => Math.abs(centeredCosine(userVec, s.features))));
    expect(Math.abs(centeredCosine(userVec, res.shirt.features))).toBeCloseTo(minAbs, 10);
  });

  it("rolls ~80/20 greedy/explore when strategy is omitted", () => {
    expect(getNextCard(userVec, MOCK_SHIRTS, [], undefined, () => 0.1)!.strategy).toBe("explore");
    expect(getNextCard(userVec, MOCK_SHIRTS, [], undefined, () => 0.5)!.strategy).toBe("greedy");
  });
});

describe("mock data", () => {
  it("has 25 shirts with valid vectors", () => {
    expect(MOCK_SHIRTS).toHaveLength(25);
    for (const s of MOCK_SHIRTS) {
      for (const k of FEATURE_KEYS) {
        expect(s.features[k]).toBeGreaterThanOrEqual(0);
        expect(s.features[k]).toBeLessThanOrEqual(1);
      }
      expect(["black", "white"]).toContain(s.baseColor);
    }
  });

  it("derives tee colour from the artwork tone (white ink on black, black ink on white)", () => {
    for (const s of MOCK_SHIRTS) expect(s.baseColor).toBe(teeColorForTone(s.artTone));
    expect(teeColorForTone("dark")).toBe("black");
    expect(teeColorForTone("light")).toBe("white");
    const blacks = MOCK_SHIRTS.filter((s) => s.baseColor === "black").length;
    expect(blacks).toBeGreaterThan(5);
    expect(MOCK_SHIRTS.length - blacks).toBeGreaterThan(5);
  });

  it("has back prints only — no front artwork", () => {
    for (const s of MOCK_SHIRTS) {
      expect(s.backImageUrl).toMatch(/^https:/);
      expect(s).not.toHaveProperty("frontImageUrl");
    }
  });
});

describe("shop ranking", () => {
  const userVec = MOCK_SHIRTS[3].features;

  it("orders by match score by default and keeps every shirt", () => {
    const ranked = rankShirts(userVec, MOCK_SHIRTS);
    expect(ranked).toHaveLength(MOCK_SHIRTS.length);
    expect(ranked[0].shirt.id).toBe(MOCK_SHIRTS[3].id);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it("sorts by price when asked", () => {
    const asc = rankShirts(userVec, MOCK_SHIRTS, "price-asc").map((r) => r.shirt.price);
    const desc = rankShirts(userVec, MOCK_SHIRTS, "price-desc").map((r) => r.shirt.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it("similarShirts excludes the shirt itself and returns the closest styles", () => {
    const base = MOCK_SHIRTS[0];
    const sim = similarShirts(base, MOCK_SHIRTS, 4);
    expect(sim).toHaveLength(4);
    expect(sim.map((s) => s.id)).not.toContain(base.id);
    const worst = Math.min(...sim.map((s) => centeredCosine(base.features, s.features)));
    const rest = MOCK_SHIRTS.filter((s) => s.id !== base.id && !sim.includes(s));
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
