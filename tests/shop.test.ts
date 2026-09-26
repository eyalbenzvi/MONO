import { describe, expect, it } from "vitest";
import { SHIRTS, dedupeByFamily, diversify } from "@/lib/catalog";
import { TIER_LABEL, matchTier, tierOf, topFraction } from "@/lib/match";
import { rankShirts, updateUserVector } from "@/lib/recommendation";
import { createInitialVector } from "@/types/shirt";

/** A formed profile: liked a run of abstract prints, passed on the rest. */
function profile() {
  let v = createInitialVector();
  for (const s of SHIRTS.slice(0, 60)) v = updateUserVector(v, s.features, s.category === "abstract" ? "like" : "dislike");
  return v;
}

describe("shop diversity (I4)", () => {
  const vector = profile();
  const ranked = dedupeByFamily(rankShirts(vector, SHIRTS, "match"));
  const out = diversify(ranked);

  it("keeps every design exactly once", () => {
    expect(out).toHaveLength(ranked.length);
    expect(new Set(out.map((x) => x.shirt.id)).size).toBe(ranked.length);
  });

  it("never shows three in a row of one category or one tee colour at the top", () => {
    const top = out.slice(0, 96);
    for (let i = 2; i < top.length; i++) {
      const [a, b, c] = [top[i - 2], top[i - 1], top[i]].map((x) => x.shirt);
      expect(a.category === b.category && b.category === c.category, `category run at ${i}`).toBe(false);
      expect(a.baseColor === b.baseColor && b.baseColor === c.baseColor, `colour run at ${i}`).toBe(false);
    }
  });

  it("puts a wildcard from an unseen category in every 8th slot", () => {
    for (let slot = 7; slot < 96; slot += 8) {
      const card = out[slot];
      expect(card.wildcard, `slot ${slot}`).toBe(true);
      const before = new Set(out.slice(slot - 7, slot).map((x) => x.shirt.category));
      expect(before.has(card.shirt.category)).toBe(false);
    }
  });

  it("still leads with the best match", () => {
    expect(out[0].shirt.id).toBe(ranked[0].shirt.id);
  });

  it("can skip the colour rule when every tee is shown in one colour", () => {
    expect(diversify(ranked, { color: false })).toHaveLength(ranked.length);
  });
});

describe("match tiers (I11)", () => {
  const vector = profile();
  const ranked = rankShirts(vector, SHIRTS, "match");

  it("rank by percentile within the catalog, not the raw %", () => {
    expect(topFraction(vector, ranked[0].score)).toBe(0);
    expect(matchTier(vector, ranked[0].shirt.features)).toBe("top");
    expect(matchTier(vector, ranked[ranked.length - 1].shirt.features)).toBeNull();
    const tiers = ranked.map((r) => tierOf(vector, r.score));
    const share = (t: string) => tiers.filter((x) => x === t).length / tiers.length;
    expect(share("top")).toBeLessThan(0.05);
    expect(share("top") + share("strong") + share("good")).toBeLessThan(0.3);
    expect(TIER_LABEL.top).toBe("Top pick");
  });

  it("is monotonic: a higher score never gets a lower tier", () => {
    const order = { top: 3, strong: 2, good: 1 } as const;
    let prev = 4;
    for (const r of ranked) {
      const t = tierOf(vector, r.score);
      const v = t ? order[t] : 0;
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});
