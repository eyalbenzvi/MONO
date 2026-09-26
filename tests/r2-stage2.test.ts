import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "./memoryStorage";
import { SHIRTS, familiesOf } from "@/lib/catalog";
import { topPicks, tierOf } from "@/lib/match";
import { makeScorer } from "@/lib/recommendation";
import { FEATURE_KEYS, createInitialVector } from "@/types/shirt";

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);
beforeEach(() => storage.clear());

const leaning = (keys: string[]) => {
  const v = createInitialVector();
  for (const k of FEATURE_KEYS) v[k] = keys.includes(k) ? 0.9 : 0.2;
  return v;
};

describe("R11 / I05: topPicks, the one helper for every 'picked for you' row", () => {
  it("three picks, from at least two categories, none from a family already in the bag", () => {
    const v = leaning(["geometric", "clean_minimal"]);
    const first = topPicks(v, 3);
    const bag = [first[0].id, first[1].id];
    const picks = topPicks(v, 3, { excludeFamilies: familiesOf(bag) });
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((s) => s.category)).size).toBeGreaterThanOrEqual(2);
    const excluded = familiesOf(bag);
    expect(picks.some((s) => excluded.has(s.family))).toBe(false);
    expect(new Set(picks.map((s) => s.family)).size).toBe(3);
  });

  it("still gives two categories for a one-note taste", () => {
    for (const k of FEATURE_KEYS) {
      const picks = topPicks(leaning([k]), 3);
      expect(new Set(picks.map((s) => s.category)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("picks come from the top of the ranking", () => {
    const v = leaning(["typography", "wit"]);
    const score = makeScorer(v);
    const best = Math.max(...SHIRTS.map((s) => score(s.features).score));
    expect(score(topPicks(v, 3)[0].features).score).toBe(best);
  });

  it("the match-tier cache holds two profiles (the grid's snapshot and the live one)", () => {
    const a = leaning(["geometric"]);
    const b = leaning(["nature"]);
    const t0 = performance.now();
    tierOf(a, 90);
    tierOf(b, 90);
    const cold = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) {
      tierOf(a, 90);
      tierOf(b, 90);
    }
    const warm = (performance.now() - t1) / 50;
    expect(warm).toBeLessThan(cold / 4);
  });
});

describe("R09: no email is kept anywhere", () => {
  it("the old device-only signup address (mono-email) is deleted on load", async () => {
    storage.setItem("mono-email", JSON.stringify({ email: "ada@example.com", source: "saved", at: 1 }));
    vi.resetModules();
    const { removeRetiredKeys } = await import("@/store/legacySession");
    removeRetiredKeys();
    expect(storage.getItem("mono-email")).toBeNull();
  });

  it("without an API, signup sends nothing and stores nothing", async () => {
    vi.resetModules();
    const { signup, apiConfigured } = await import("@/lib/api");
    expect(apiConfigured).toBe(false);
    expect(await signup("ada@example.com", "saved")).toEqual({ ok: false });
    expect(storage.length).toBe(0);
  });
});

describe("R01 / F01: the taste test shows no toasts", () => {
  it("ten taste-test swipes and a level-up after it raise no toast", async () => {
    vi.resetModules();
    const { useTasteStore } = await import("@/store/tasteStore");
    const { useUiStore } = await import("@/store/useUiStore");
    const toasts: string[] = [];
    useUiStore.subscribe((s, prev) => s.toast && s.toast !== prev.toast && toasts.push(s.toast.message));
    for (let i = 0; i < 30; i++) {
      const top = useTasteStore.getState().deck[0];
      useTasteStore.getState().commitSwipe(top.id, "like");
      if (i === 9) useTasteStore.getState().acknowledgeCalibration();
    }
    expect(useTasteStore.getState().milestones.length).toBeGreaterThan(0);
    expect(toasts).toEqual([]);
  });
});
