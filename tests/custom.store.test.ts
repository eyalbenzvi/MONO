import { beforeEach, describe, expect, it, vi } from "vitest";
import shirts from "../data/shirts.json";
import { CUSTOM_LIKE } from "@/lib/recommendation";
import { FEATURE_KEYS } from "@/types/shirt";

class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
}
const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);

async function fresh() {
  vi.resetModules();
  return { ...(await import("@/store/tasteStore")), ...(await import("@/store/cartStore")), ...(await import("@/store/useUiStore")) };
}

const SKY = (shirts as unknown as { id: string; variant: string; features: Record<string, number> }[]).find((s) => s.variant === "sky-night")!;

beforeEach(() => storage.clear());

describe("personalised prints: the taste", () => {
  it("'Use this' is a third of a like of the base design (CUSTOM_LIKE), once per design, and keeps no inputs", async () => {
    const { useTasteStore } = await fresh();
    const v0 = { ...useTasteStore.getState().preferenceVector };
    useTasteStore.getState().likeCustom(SKY.id);
    const v1 = useTasteStore.getState().preferenceVector;
    for (const k of FEATURE_KEYS) expect(v1[k]).toBeCloseTo(v0[k] + CUSTOM_LIKE * (SKY.features[k] - v0[k]), 10);
    useTasteStore.getState().likeCustom(SKY.id);
    expect(useTasteStore.getState().preferenceVector).toEqual(v1);
    expect(useTasteStore.getState().customLiked).toEqual([SKY.id]);
    expect(CUSTOM_LIKE).toBeCloseTo(0.15 / 3, 2);
    // Saved never holds a personalised print: the heart saves the design.
    expect(useTasteStore.getState().likedIds).toEqual([]);
  });
});
