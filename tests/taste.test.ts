import { describe, expect, it } from "vitest";
import { ARCHETYPES as CARICATURES } from "../scripts/gen/copy3";
import { SHIRTS } from "@/lib/catalog";
import {
  ARCHETYPE_NAMES,
  DAILY_GOAL,
  latestDrop,
  archetypeOf,
  countSwipe,
  currentStreak,
  decodeTaste,
  emptyDaily,
  encodeTaste,
  isNew,
  tasteOverlap,
} from "@/lib/taste";
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

  it("overlap is 100 for the same taste and low for opposites", () => {
    const a = { ...createInitialVector(0.3), geometric: 0.9 };
    const b = { ...createInitialVector(0.7), geometric: 0.1 };
    expect(tasteOverlap(a, a)).toBe(100);
    expect(tasteOverlap(a, b)).toBeLessThan(10);
  });
});

describe("Daily 5 (F10)", () => {
  it("counts per day and grows the streak on consecutive days", () => {
    let d = { ...emptyDaily(), day: "2026-09-24" };
    for (let i = 0; i < DAILY_GOAL; i++) d = countSwipe(d, "2026-09-24");
    expect(d).toMatchObject({ count: 5, streak: 1, last: "2026-09-24" });
    d = countSwipe(d, "2026-09-24"); // a sixth doesn't count twice
    expect(d.streak).toBe(1);
    for (let i = 0; i < DAILY_GOAL; i++) d = countSwipe(d, "2026-09-25");
    expect(d).toMatchObject({ count: 5, streak: 2, last: "2026-09-25" });
    expect(currentStreak(d, "2026-09-26")).toBe(2); // still alive today
    expect(currentStreak(d, "2026-09-27")).toBe(0); // missed a day
    for (let i = 0; i < DAILY_GOAL; i++) d = countSwipe(d, "2026-09-28");
    expect(d.streak).toBe(1); // restarts after a gap
  });
});

const LATEST_DROP = latestDrop(SHIRTS);

describe("drops (F13, round 2 I12)", () => {
  it("the latest drop is Monday 21 Sep 2026 (explicit dates from the generator)", () => {
    expect(new Date(LATEST_DROP).toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(SHIRTS.reduce((m, s) => Math.max(m, s.dropDate), 0)).toBe(LATEST_DROP);
  });

  it('"New this week" for the seven days after a drop, on the viewer\'s clock', () => {
    expect(isNew(LATEST_DROP, Date.UTC(2026, 8, 25))).toBe(true);
    expect(isNew(LATEST_DROP, LATEST_DROP)).toBe(true);
    expect(isNew(LATEST_DROP, Date.UTC(2026, 8, 20))).toBe(false);
    // a week later, without a new drop, nothing is new
    expect(isNew(LATEST_DROP, Date.UTC(2026, 8, 28))).toBe(false);
  });
});
