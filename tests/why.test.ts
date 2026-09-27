import { describe, expect, it } from "vitest";
import { SHIRTS } from "@/lib/catalog";
import { BECAUSE_MIN } from "@/lib/because";
import { tierOf, topFraction } from "@/lib/match";
import { centeredCosine, matchScore, updateUserVector } from "@/lib/recommendation";
import { whyMatch } from "@/lib/why";
import { createInitialVector, FEATURE_LABELS, type UserProfileVector } from "@/types/shirt";

/** A taste formed by liking a few designs and passing on a few (as the taste test does). */
function tasteFrom(likes: number[], passes: number[]) {
  let v: UserProfileVector = createInitialVector();
  for (const i of likes) v = updateUserVector(v, SHIRTS[i].features, "like");
  for (const i of passes) v = updateUserVector(v, SHIRTS[i].features, "dislike");
  return v;
}

describe("V4: why a design is 'for you' — every reason is real", () => {
  it("a neutral taste has no reasons, so no personal line", () => {
    const v = createInitialVector();
    expect(SHIRTS.slice(0, 200).every((s) => whyMatch(v, s, []) === null)).toBe(true);
  });

  it("for many tastes and designs: shared traits are ones the taste leans to and the design has; rank and tier agree; the liked design is saved and alike", () => {
    let checked = 0;
    for (let t = 0; t < 12; t++) {
      // Spread over the whole catalogue, whatever its size.
      const at = (k: number) => k % SHIRTS.length;
      const likes = [t * 7, t * 7 + 300, t * 7 + 900, t * 7 + 1500].map(at);
      const v = tasteFrom(likes, [t * 7 + 50, t * 7 + 2000].map(at));
      const liked = likes.map((i) => SHIRTS[i].id);
      for (const s of SHIRTS.filter((_, i) => i % 23 === t)) {
        const why = whyMatch(v, s, liked);
        if (!why) continue;
        checked++;
        for (const k of why.shared) {
          expect(v[k]).toBeGreaterThan(0.5);
          expect(s.features[k]).toBeGreaterThan(0.5);
          expect(FEATURE_LABELS[k]).toBeTruthy();
        }
        const score = matchScore(v, s.features);
        expect(why.tier).toBe(tierOf(v, score));
        expect(why.rankPct).toBe(Math.max(1, Math.ceil(topFraction(v, score) * 100)));
        expect(why.rankPct).toBeLessThanOrEqual(why.tier === "top" ? 2 : 8);
        if (why.like) {
          expect(liked).toContain(why.like.id);
          expect(why.like.family).not.toBe(s.family);
          expect(centeredCosine(why.like.features, s.features)).toBeGreaterThan(BECAUSE_MIN);
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("a design you saved says so, and names no other", () => {
    const likes = [3, 400, 1200].map((k) => k % SHIRTS.length);
    const v = tasteFrom(likes, [60]);
    const liked = likes.map((i) => SHIRTS[i].id);
    const top = SHIRTS.map((s) => ({ s, why: whyMatch(v, s, [...liked, s.id]) })).find((x) => x.why);
    expect(top).toBeDefined();
    expect(top!.why!.saved).toBe(true);
    expect(top!.why!.like).toBeNull();
  });
});
