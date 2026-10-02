// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { SHIRTS } from "@/lib/catalog";
import { archetypeOf } from "@/lib/taste";
import { updateUserVector } from "@/lib/recommendation";
import { useTasteStore } from "@/store/tasteStore";
import { createInitialVector, FEATURE_KEYS } from "@/types/shirt";

const close = (a: Record<string, number>, b: Record<string, number>) => FEATURE_KEYS.every((k) => Math.abs(a[k] - b[k]) < 1e-9);

beforeEach(() => {
  localStorage.clear();
  useTasteStore.getState().reset();
});

describe("V6: removing a saved tee takes it out of the taste", () => {
  it("the taste becomes exactly what it would be had it never been saved — and so does the title", () => {
    // Three nature-leaning saves, then one very different design.
    const nature = SHIRTS.filter((s) => s.features.nature > 0.8).slice(0, 3);
    const odd =
      SHIRTS.find((s) => s.features.nature < 0.2 && s.features.geometric > 0.8 && s.features.typography > 0.6) ??
      SHIRTS.find((s) => s.features.geometric > 0.9) ??
      [...SHIRTS].sort((a, b) => a.features.nature - b.features.nature || b.features.geometric - a.features.geometric)[0];
    const { toggleSaved } = useTasteStore.getState();
    for (const s of [...nature, odd]) toggleSaved(s.id);
    let without = createInitialVector();
    for (const s of nature) without = updateUserVector(without, s.features, "like");
    const withOdd = useTasteStore.getState().preferenceVector;
    expect(close(withOdd, without)).toBe(false);

    useTasteStore.getState().removeLiked(odd.id);
    const s = useTasteStore.getState();
    expect(s.likedIds).not.toContain(odd.id);
    expect(close(s.preferenceVector, without)).toBe(true);
    expect(archetypeOf(s.preferenceVector).name).toBe(archetypeOf(without).name);
    expect(s.swipeHistory.some((e) => e.shirtId === odd.id && e.action === "like")).toBe(false);
  });

  it("the heart in the shop unsaves the same way; Undo puts the taste back exactly", () => {
    const [a, b] = SHIRTS.filter((s) => s.features.nature > 0.8);
    const { toggleSaved } = useTasteStore.getState();
    toggleSaved(a.id);
    toggleSaved(b.id);
    const before = useTasteStore.getState().preferenceVector;
    toggleSaved(b.id); // unsave
    expect(close(useTasteStore.getState().preferenceVector, updateUserVector(createInitialVector(), a.features, "like"))).toBe(true);
    useTasteStore.getState().restoreSaved(b.id, 1);
    expect(useTasteStore.getState().likedIds).toEqual([a.id, b.id]);
    expect(close(useTasteStore.getState().preferenceVector, before)).toBe(true);
  });
});
