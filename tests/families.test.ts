import { describe, expect, it } from "vitest";
import {
  SHIRTS,
  dedupeByFamily,
  familiesOf,
  familyMembers,
  getShirtById,
} from "@/lib/catalog";
import { CALIBRATION_IDS, DECK_SIZE, VARIANT_SPACING, buildDeck, calibrationDone, type DeckEntry } from "@/lib/deck";
import { getCalibrationQueue, rankShirts, updateUserVector } from "@/lib/recommendation";
import { createInitialVector, isPhoto, type CatalogEntry } from "@/types/shirt";
import FULL_CATALOG from "@/data/shirts.json";
import { PER_CATEGORY } from "../scripts/gen/constants";

/** The other designs in a shirt's family (was lib/catalog's variationsOf; only tests need it). */
const variationsOf = (shirt: (typeof SHIRTS)[number]) => familyMembers(shirt).filter((s) => s.id !== shirt.id);

/** Deterministic PRNG so simulated runs are reproducible. */
function rng(seed = 7) {
  let a = seed;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const CALIBRATION = [...CALIBRATION_IDS];

/** Play Discover: always swipe the top card, alternating like/pass. */
function simulate(swipes: number) {
  const r = rng();
  let vector = createInitialVector();
  let deck: DeckEntry[] = [];
  const history: string[] = [];
  for (let i = 0; i < swipes; i++) {
    deck = buildDeck(deck, vector, history, CALIBRATION, r);
    const top = deck[0];
    if (!top) break;
    history.push(top.id);
    vector = updateUserVector(vector, getShirtById(top.id)!.features, i % 3 ? "like" : "dislike");
    deck = deck.slice(1, 2); // the store keeps the visible next card, re-ranks the rest
  }
  return history;
}

describe("design families", () => {
  it("every shirt belongs to a family; drawn families never mix algorithms, a photo family is one subject", () => {
    const full = new Map((FULL_CATALOG as unknown as CatalogEntry[]).map((f) => [f.id, f]));
    for (const s of SHIRTS) {
      const members = familyMembers(s);
      expect(members.map((m) => m.id)).toContain(s.id);
      for (const m of members) {
        expect(m.category).toBe(s.category);
        // Two photographs of one subject are its takes (treatments differ on purpose).
        if (isPhoto(s)) expect(full.get(m.id)!.subject).toBe(full.get(s.id)!.subject);
        else expect(m.variant).toBe(s.variant);
      }
    }
  });

  it("groups the catalog into a few hundred designs with real variations", () => {
    // Generated designs (an archive work is its own family: one print per record).
    const families = new Set(SHIRTS.filter((s) => !isPhoto(s) && !s.variant.startsWith("archive-")).map((s) => s.family));
    expect(families.size).toBeGreaterThan(400);
    expect(families.size).toBeLessThan(1200);
    // Photographs: one family per subject, at most two takes each.
    const photoFamilies = new Set(SHIRTS.filter(isPhoto).map((s) => s.family));
    expect(photoFamilies.size).toBeGreaterThanOrEqual(PER_CATEGORY * 3 / 2);
    expect(SHIRTS.filter((s) => variationsOf(s).length > 0).length).toBeGreaterThan(400);
  });

  it("a family's variations exclude the shirt itself", () => {
    const withSiblings = SHIRTS.find((s) => familyMembers(s).length > 3)!;
    const v = variationsOf(withSiblings);
    expect(v).toHaveLength(familyMembers(withSiblings).length - 1);
    expect(v.map((s) => s.id)).not.toContain(withSiblings.id);
  });

  it("dedupeByFamily keeps the first of each family and counts the rest", () => {
    const ranked = rankShirts(createInitialVector(), SHIRTS);
    const deduped = dedupeByFamily(ranked);
    expect(new Set(deduped.map((d) => d.shirt.family)).size).toBe(deduped.length);
    expect(deduped.reduce((n, d) => n + d.variations + 1, 0)).toBe(SHIRTS.length);
    // the representative is the best-ranked member of its family
    const first = deduped[0];
    expect(ranked.findIndex((r) => r.shirt.family === first.shirt.family)).toBe(ranked.indexOf(ranked.find((r) => r.shirt.id === first.shirt.id)!));
  });
});

describe("Discover never shows two designs of one family", () => {
  it("calibration uses 10 different families, one per category", () => {
    expect(new Set(CALIBRATION.map((id) => getShirtById(id)!.family)).size).toBe(10);
    expect(new Set(CALIBRATION.map((id) => getShirtById(id)!.category)).size).toBe(10);
  });

  it("a long run (200 swipes) never repeats a family", () => {
    const history = simulate(200);
    expect(history).toHaveLength(200);
    expect(familiesOf(history).size).toBe(history.length);
  });

  it("a full run ends after exactly one card per family", () => {
    const families = new Set(SHIRTS.map((s) => s.family)).size;
    const history = simulate(SHIRTS.length);
    expect(history).toHaveLength(families);
  }, 60_000);

  it("paces algorithms: no repeat within the spacing window while alternatives exist", () => {
    const history = simulate(120);
    for (let i = VARIANT_SPACING; i < history.length; i++) {
      const window = history.slice(i - VARIANT_SPACING, i).map((id) => getShirtById(id)!.variant);
      expect(window).not.toContain(getShirtById(history[i])!.variant);
    }
  });

  it("drops dealt cards whose family was shown meanwhile (e.g. saved from the shop)", () => {
    const deck = buildDeck([], createInitialVector(), [], CALIBRATION, rng());
    expect(deck).toHaveLength(DECK_SIZE);
    const sibling = variationsOf(getShirtById(deck[1].id)!)[0] ?? getShirtById(deck[1].id)!;
    const next = buildDeck(deck, createInitialVector(), [sibling.id], CALIBRATION, rng());
    expect(next.map((e) => e.id)).not.toContain(deck[1].id);
    expect(familiesOf(next.map((e) => e.id)).has(sibling.family)).toBe(false);
  });

  it("calibration progress counts families, so a saved sibling completes its slot", () => {
    const target = getShirtById(CALIBRATION[3])!;
    const sibling = variationsOf(target)[0];
    if (!sibling) return; // this calibration print is one of a kind
    expect(calibrationDone(CALIBRATION, [sibling.id])).toBe(1);
  });
});

describe("display pacing", () => {
  it("paceByVariant keeps every item and avoids algorithm repeats within the window", async () => {
    const { paceByVariant } = await import("@/lib/catalog");
    const ranked = dedupeByFamily(rankShirts(getShirtById(SHIRTS[4].id)!.features, SHIRTS));
    const paced = paceByVariant(ranked, 3);
    expect(paced).toHaveLength(ranked.length);
    expect(new Set(paced.map((x) => x.shirt.id)).size).toBe(ranked.length);
    // the first 100 cards (what people actually scroll) never repeat within 3
    for (let i = 3; i < 100; i++) {
      const recent = paced.slice(i - 3, i).map((x) => x.shirt.variant);
      expect(recent).not.toContain(paced[i].shirt.variant);
    }
  });
});

describe("precomputed calibration (I8)", () => {
  it("matches the runtime algorithm: farthest-point over family leaders, a photograph among them, boldest first", () => {
    // Each family's first strong design (weak prints never rate taste).
    const leaders = [...new Map([...SHIRTS].reverse().filter((s) => !s.weak).map((s) => [s.family, s])).values()].sort((a, b) => a.n - b.n);
    const queue = getCalibrationQueue(leaders, 10, (s) => s.category, isPhoto);
    const bold = (s: (typeof queue)[number]) => s.features.contrast + s.features.density;
    const opener = queue.reduce((best, s) => (bold(s) > bold(best) ? s : best), queue[0]);
    expect(CALIBRATION_IDS).toEqual([opener, ...queue.filter((s) => s !== opener)].map((s) => s.id));
  });
});
