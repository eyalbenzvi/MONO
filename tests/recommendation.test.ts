import { describe, expect, it } from "vitest";
import {
  centeredCosine,
  cosineSimilarity,
  getCalibrationQueue,
  getNextCard,
  matchScore,
  updateUserVector,
} from "@/lib/recommendation";
import { MOCK_SHIRTS } from "@/lib/mockData";
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
});
