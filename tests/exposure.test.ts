import { describe, expect, it } from "vitest";
import { CALIBRATION_IDS, SHIRTS, dedupeByFamily, diversify } from "@/lib/catalog";
import { buildDeck } from "@/lib/deck";
import { rankShirts, updateUserVector } from "@/lib/recommendation";
import { createInitialVector, type UserProfileVector } from "@/types/shirt";

/** Simulated people who each like two categories (10 swipes, like the taste test). */
function people(n: number) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cats = [...new Set(SHIRTS.map((s) => s.category))];
  return Array.from({ length: n }, () => {
    const fav = [cats[Math.floor(rnd() * cats.length)], cats[Math.floor(rnd() * cats.length)]];
    let v: UserProfileVector = createInitialVector();
    for (let i = 0; i < 10; i++) {
      const pool = rnd() < 0.2 ? SHIRTS.filter((s) => fav.includes(s.category)) : SHIRTS;
      const s = pool[Math.floor(rnd() * pool.length)];
      v = updateUserVector(v, s.features, fav.includes(s.category) ? "like" : "dislike");
    }
    return { v, fav, rnd };
  });
}
const top24 = (v: UserProfileVector, rotate?: string) => diversify(dedupeByFamily(rankShirts(v, SHIRTS, "match", rotate ? { rotate } : {}))).slice(0, 24);

describe("U3: no longer the same designs for everyone, every day", () => {
  it("the shop's order refreshes day to day and differs between people — without losing relevance", () => {
    const crowd = people(30);
    const fixed = new Map<string, number>();
    const rotated = new Map<string, number>();
    let relFixed = 0, relRotated = 0, fresh = 0;
    crowd.forEach(({ v, fav }, u) => {
      const a = top24(v), b = top24(v, `${u}:1`), c = top24(v, `${u}:2`);
      for (const x of a) fixed.set(x.shirt.id, (fixed.get(x.shirt.id) ?? 0) + 1), (relFixed += +fav.includes(x.shirt.category));
      for (const x of b) rotated.set(x.shirt.id, (rotated.get(x.shirt.id) ?? 0) + 1), (relRotated += +fav.includes(x.shirt.category));
      const next = new Set(c.map((x) => x.shirt.id));
      fresh += b.filter((x) => !next.has(x.shirt.id)).length;
      // Same day, same person: the same order (stable while browsing).
      expect(top24(v, `${u}:1`).map((x) => x.shirt.id)).toEqual(b.map((x) => x.shirt.id));
    });
    expect(rotated.size).toBeGreaterThan(fixed.size * 1.1);
    expect(relRotated).toBeGreaterThanOrEqual(relFixed * 0.95);
    expect(fresh / (30 * 24)).toBeGreaterThan(0.5);
  });

  it("what Discover already showed steps back in the shop", () => {
    const v = people(1)[0].v;
    const first = rankShirts(v, SHIRTS, "match")[0].shirt;
    const demoted = rankShirts(v, SHIRTS, "match", { demote: new Set([first.id]) });
    expect(demoted.findIndex((x) => x.shirt.id === first.id)).toBeGreaterThan(0);
  });

  it("Discover deals a good match, not always the same one; no category three times running", () => {
    const { v } = people(1)[0];
    const deal = (seed: number) => {
      let s = seed;
      const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
      const seen = [...CALIBRATION_IDS];
      let deck = buildDeck([], v, seen, CALIBRATION_IDS, rnd);
      const out: string[] = [];
      for (let i = 0; i < 20 && deck.length; i++) {
        const c = deck.shift()!;
        out.push(c.id);
        seen.push(c.id);
        deck = buildDeck(deck, v, seen, CALIBRATION_IDS, rnd);
      }
      return out;
    };
    const a = deal(3), b = deal(4);
    expect(a.filter((id) => b.includes(id)).length).toBeLessThan(a.length * 0.7);
    const cats = a.map((id) => SHIRTS.find((s) => s.id === id)!.category);
    for (let i = 2; i < cats.length; i++) expect(cats[i] === cats[i - 1] && cats[i] === cats[i - 2]).toBe(false);
  });
});
