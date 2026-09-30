import { describe, expect, it } from "vitest";
import { SHIRTS, dedupeByFamily, diversify } from "@/lib/catalog";
import { TIER_LABEL, matchTier, tierOf, topFraction } from "@/lib/match";
import { rankShirts, updateUserVector } from "@/lib/recommendation";
import { createInitialVector } from "@/types/shirt";

/** A formed profile: liked a run of systems prints (op art, curves), passed on the rest. */
function profile() {
  let v = createInitialVector();
  for (const s of SHIRTS.slice(0, 60)) v = updateUserVector(v, s.features, s.category === "systems" ? "like" : "dislike");
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
    // "Top pick" is the only tier word people see.
    expect(Object.values(TIER_LABEL).join(" ")).not.toMatch(/match/i);
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

describe("the shop's filters: tee colour and categories (no sort)", () => {
  const all = SHIRTS.map((shirt) => ({ shirt }));
  it("a tee colour keeps only designs sold on it: photographs only on their own tee, never as a negative", async () => {
    const { filterShop } = await import("@/lib/catalog");
    for (const tee of ["black", "white"] as const) {
      const kept = filterShop(all, { tee, cats: [] });
      expect(kept.length).toBe(SHIRTS.filter((s) => s.colors.includes(tee)).length);
      expect(kept.every(({ shirt }) => shirt.colors.includes(tee))).toBe(true);
      // Everything but the photographs of the other tee.
      expect(all.length - kept.length).toBe(SHIRTS.filter((s) => s.medium === "photo" && !s.colors.includes(tee)).length);
    }
  });

  it("one or more categories keep those; none is all; they combine with the colour", async () => {
    const { filterShop } = await import("@/lib/catalog");
    const { SHIRT_CATEGORIES } = await import("@/types/shirt");
    expect(filterShop(all, { tee: null, cats: [] })).toHaveLength(all.length);
    const two = filterShop(all, { tee: null, cats: ["photographs", "sky"] });
    expect(two.length).toBe(SHIRTS.filter((s) => s.category === "photographs" || s.category === "sky").length);
    const whitePhotos = filterShop(all, { tee: "white", cats: ["photographs"] });
    expect(whitePhotos.every(({ shirt }) => shirt.category === "photographs" && shirt.colors.includes("white"))).toBe(true);
    // Every category has designs with no colour chosen (a colour can empty one: its row is then disabled).
    for (const c of SHIRT_CATEGORIES) expect(filterShop(all, { tee: null, cats: [c] }).length, c).toBeGreaterThan(20);
  });

  it("toggling keeps the catalogue's order, and choosing every category is the same as all", async () => {
    const { toggleCategory } = await import("@/lib/catalog");
    const { SHIRT_CATEGORIES } = await import("@/types/shirt");
    expect(toggleCategory(["sky"], "photographs")).toEqual(SHIRT_CATEGORIES.filter((c) => c === "sky" || c === "photographs"));
    expect(toggleCategory(["sky", "photographs"], "sky")).toEqual(["photographs"]);
    let cats: (typeof SHIRT_CATEGORIES)[number][] = [];
    for (const c of SHIRT_CATEGORIES) cats = toggleCategory(cats, c);
    expect(cats).toEqual([]);
  });

  it("the address: ?c=&cat=a.b, unknown values dropped, every category = all, an old ?m=photo = photographs", async () => {
    const { filtersFromQuery } = await import("@/lib/catalog");
    const { SHIRT_CATEGORIES } = await import("@/types/shirt");
    const q = (s: string) => filtersFromQuery(new URLSearchParams(s));
    expect(q("c=black&cat=sky.photographs.nope")).toEqual({ tee: "black", cats: SHIRT_CATEGORIES.filter((c) => c === "sky" || c === "photographs") });
    expect(q("c=grey")).toEqual({ tee: null, cats: [] });
    expect(q(`cat=${SHIRT_CATEGORIES.join(".")}`).cats).toEqual([]);
    expect(q("c=white&m=photo")).toEqual({ tee: "white", cats: ["photographs"] });
    expect(q("m=ink").cats).toEqual([]);
  });
});
