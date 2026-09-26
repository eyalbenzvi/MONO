import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADULT_SIZES, KID_SIZES, SIZES, SIZE_GUIDE, SIZE_LABELS, isKidSize } from "@/types/shirt";

class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}
const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);
beforeEach(() => storage.clear());

describe("sizes: XS–3XL and kids' sizes", () => {
  it("adults XS–3XL, kids 3–4 to 11–12; every size has a label and measurements that grow with it", () => {
    expect(ADULT_SIZES).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(KID_SIZES).toHaveLength(5);
    expect(SIZE_LABELS["2XL"]).toBe("XXL");
    expect(SIZE_LABELS.K6).toBe("Kids 5–6");
    for (const group of [ADULT_SIZES, KID_SIZES])
      group.forEach((s, i) => i > 0 && expect(SIZE_GUIDE[s].chest).toBeGreaterThan(SIZE_GUIDE[group[i - 1]].chest));
    expect(isKidSize("K8")).toBe(true);
    expect(isKidSize("M")).toBe(false);
    expect(SIZES).toHaveLength(12);
  });

  it("a bag from before keeps its sizes; kids' and XXL sizes are stored and remembered", async () => {
    storage.setItem("mono-cart", JSON.stringify({ state: { cart: [{ id: "mono-0001", size: "M", color: "black", qty: 1 }], preferredSize: "L" }, version: 3 }));
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().cart).toEqual([{ id: "mono-0001", size: "M", color: "black", qty: 1 }]);
    useCartStore.getState().addToCart("mono-0002", "K6", "white");
    useCartStore.getState().addToCart("mono-0003", "2XL", "black");
    const saved = JSON.parse(storage.getItem("mono-cart")!).state;
    expect(saved.cart.map((l: { size: string }) => l.size)).toEqual(["M", "K6", "2XL"]);
    vi.resetModules();
    const again = await import("@/store/cartStore");
    await again.useCartStore.persist.rehydrate();
    expect(again.useCartStore.getState().cart.map((l) => l.size)).toEqual(["M", "K6", "2XL"]);
  });
});
