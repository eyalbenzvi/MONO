import { describe, expect, it } from "vitest";
import { ARCHETYPES as CARICATURES } from "../scripts/gen/copy3";
import { SHIRTS } from "@/lib/catalog";
import { ARCHETYPE_NAMES, TRAIT_WORDS, latestDrop, archetypeOf, decodeTaste, encodeTaste, isNew, noteOf, sharedTraits, tasteSentence, traitLine } from "@/lib/taste";
import { FEATURE_KEYS } from "@/types/shirt";
import { createInitialVector } from "@/types/shirt";

describe("taste archetypes (F3)", () => {
  it("never reuse a caricature character's name", () => {
    const taken = new Set(CARICATURES.map((c) => c.name));
    for (const n of ARCHETYPE_NAMES) expect(taken.has(n), n).toBe(false);
    expect(new Set(ARCHETYPE_NAMES).size).toBe(ARCHETYPE_NAMES.length);
  });

  it("are deterministic from the strongest traits", () => {
    const v = { ...createInitialVector(0.3), architectural: 0.9, dark_industrial: 0.8 };
    expect(archetypeOf(v).name).toBe("The Brutalist");
    expect(archetypeOf(v).traits.slice(0, 2)).toEqual(["architectural", "dark_industrial"]);
    expect(archetypeOf({ ...createInitialVector(0.3), classic: 0.95 }).name).toBe("The Curator");
    expect(archetypeOf(createInitialVector()).name).toBe("The Open Mind");
  });
});

describe("taste codes", () => {
  it("round-trip a profile in 34 characters (two per feature)", () => {
    const v = { ...createInitialVector(0.37), wit: 1, nature: 0, photographic: 0.9 };
    const code = encodeTaste(v);
    expect(code).toHaveLength(34);
    expect(decodeTaste(code)).toEqual(v);
  });

  it("links shared before the photographs (32 characters) still open, the photo lean at neutral", () => {
    const old = encodeTaste({ ...createInitialVector(0.37), wit: 1 }).slice(0, 32);
    expect(decodeTaste(old)).toEqual({ ...createInitialVector(0.37), wit: 1, photographic: 0.5 });
    expect(decodeTaste(old.slice(0, 30))).toBeNull();
  });

  it("reject anything malformed", () => {
    expect(decodeTaste(null)).toBeNull();
    expect(decodeTaste("abc")).toBeNull();
    expect(decodeTaste("zz".repeat(16))).toBeNull(); // 1295 > 100
    expect(decodeTaste("<>".repeat(16))).toBeNull();
  });

});

describe("the taste in words (1.6)", () => {
  it("every trait has words, lower-case, never the engine's label", () => {
    for (const k of FEATURE_KEYS) {
      expect(TRAIT_WORDS[k], k).toMatch(/^[a-z]/);
    }
    expect(TRAIT_WORDS.density).toBe("dense prints");
    expect(TRAIT_WORDS.halftone_raster).toBe("printed-dot textures");
    expect(TRAIT_WORDS.photographic).toBe("photographs");
    expect(traitLine(["density", "nature"])).toBe("Dense prints · nature");
  });

  it("one sentence from the top traits", () => {
    const v = { ...createInitialVector(0.3), density: 0.95, contrast: 0.9, nature: 0.85 };
    expect(tasteSentence(v)).toBe("Dense, high-contrast prints drawn from nature.");
    expect(tasteSentence({ ...createInitialVector(0.3), nature: 0.9 })).toBe("Prints drawn from nature.");
    expect(tasteSentence(createInitialVector())).toBe("Open to anything, for now.");
  });

  it("a friend's comparison names what's shared, or nothing", () => {
    const a = { ...createInitialVector(0.3), geometric: 0.9, retro: 0.8 };
    const b = { ...createInitialVector(0.3), geometric: 0.8, nature: 0.9 };
    expect(sharedTraits(a, b)).toEqual(["geometric"]);
    expect(sharedTraits(a, { ...createInitialVector(0.3), nature: 0.9 })).toEqual([]);
  });

  it("the stylist note speaks only when the lean is clear", () => {
    expect(noteOf(createInitialVector())).toBeNull();
    expect(noteOf({ ...createInitialVector(), density: 0.7 })).toBe("Noted: dense prints");
  });
});

const LATEST_DROP = latestDrop(SHIRTS);

describe("drops (F13, round 2 I12)", () => {
  it("the latest drop is Monday 28 Sep 2026, content wave 1 (explicit dates from the generator)", () => {
    expect(new Date(LATEST_DROP).toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(SHIRTS.reduce((m, s) => Math.max(m, s.dropDate), 0)).toBe(LATEST_DROP);
  });

  it('"New this week" for the seven days after a drop, on the viewer\'s clock', () => {
    const DAY = 86400000;
    expect(isNew(LATEST_DROP, LATEST_DROP + 4 * DAY)).toBe(true);
    expect(isNew(LATEST_DROP, LATEST_DROP)).toBe(true);
    expect(isNew(LATEST_DROP, LATEST_DROP - DAY)).toBe(false);
    // a week later, without a new drop, nothing is new
    expect(isNew(LATEST_DROP, LATEST_DROP + 7 * DAY)).toBe(false);
  });
});
