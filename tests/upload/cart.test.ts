import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../memoryStorage";

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);

async function fresh() {
  vi.resetModules();
  return { ...(await import("@/store/cartStore")), ...(await import("@/lib/cart")), ...(await import("@/lib/upload/designs")), ...(await import("@/lib/catalog")) };
}

const REF = { id: "u1abc", mode: "dots" as const, size: "full" as const, hash: "0a1b2c3d" };

beforeEach(() => storage.clear());

describe("cart v6: uploaded prints", () => {
  it("an upload line resolves (make-yours), costs the made-for-you price, and its hash names the line", async () => {
    const { useCartStore, cartTotals, YOURS_ID, getShirtById } = await fresh();
    expect(getShirtById(YOURS_ID)?.colors).toEqual(["black", "white"]);
    const s = useCartStore.getState();
    expect(s.addToCart(YOURS_ID, "L", "black", 1, { upload: REF, silent: true })).toBe(true);
    s.addToCart(YOURS_ID, "L", "black", 1, { upload: REF, silent: true });
    s.addToCart(YOURS_ID, "L", "black", 1, { upload: { ...REF, id: "u2abc", hash: "ffff0000" }, silent: true });
    const cart = useCartStore.getState().cart;
    expect(cart.map((l) => [l.upload?.hash, l.qty])).toEqual([["0a1b2c3d", 2], ["ffff0000", 1]]);
    expect(cartTotals(cart).subtotal).toBe(3 * 75);
  });
  it("the pair of one upload is $130", async () => {
    const { useCartStore, cartTotals, YOURS_ID } = await fresh();
    useCartStore.getState().addPair(YOURS_ID, "M", { upload: REF, silent: true });
    const t = cartTotals(useCartStore.getState().cart);
    expect(t.count).toBe(2);
    expect(t.subtotal - t.discount).toBe(130);
  });
  it("a malformed upload reference is refused on add and dropped on load; a line can't be both personalised and uploaded", async () => {
    const { useCartStore, sanitizeCart, uploadRef, YOURS_ID } = await fresh();
    expect(useCartStore.getState().addToCart(YOURS_ID, "L", "black", 1, { upload: { ...REF, mode: "raw" as never }, silent: true })).toBe(false);
    for (const bad of [{ ...REF, id: "../x" }, { ...REF, hash: "zz" }, { ...REF, size: "huge" }, null, 3]) expect(uploadRef(bad)).toBeNull();
    const s = sanitizeCart({
      cart: [
        { id: YOURS_ID, size: "L", color: "black", qty: 1, upload: REF },
        { id: YOURS_ID, size: "L", color: "white", qty: 1, upload: { ...REF, hash: "no" } },
        { id: YOURS_ID, size: "M", color: "black", qty: 1, upload: REF, custom: { t: "code", v: 1, p: { x: "NOA", k: "card" } } },
      ],
    });
    expect(s.cart).toEqual([{ id: YOURS_ID, size: "L", color: "black", qty: 1, upload: REF }]);
  });
  it("the last order keeps only an upload's mode (never its id, file or hash); v5 bags migrate untouched", async () => {
    const { orderItem, migrateCart, YOURS_ID } = await fresh();
    expect(orderItem({ id: YOURS_ID, size: "L", color: "black", qty: 1, upload: REF })).toEqual({ id: YOURS_ID, size: "L", color: "black", qty: 1, upload: { mode: "dots" } });
    expect(orderItem({ id: "mono-0001", size: "L", color: "black", qty: 1, custom: { t: "code", v: 1, p: { x: "NOA", k: "card" } } })).toEqual({ id: "mono-0001", size: "L", color: "black", qty: 1, custom: { t: "code" } });
    const v5 = { cart: [{ id: "mono-0001", size: "M", color: "black", qty: 1 }], lastOrder: null, selectedSizes: {}, selectedColors: {}, preferredSize: "M" };
    expect(migrateCart(v5, 5)).toEqual(v5);
  });
  it("analytics: an upload is <colour>-upload at the made-for-you price, with nothing of the file", async () => {
    const { useCartStore, YOURS_ID } = await fresh();
    const w = { dataLayer: [] as Record<string, unknown>[] };
    vi.stubGlobal("window", w);
    useCartStore.getState().addToCart(YOURS_ID, "L", "white", 1, { upload: REF, silent: true });
    const ev = w.dataLayer.find((e) => e.event === "add_to_cart")!;
    expect((ev.items as { item_variant: string; price: number }[])[0]).toMatchObject({ item_variant: "white-upload", price: 75 });
    expect(JSON.stringify(ev)).not.toMatch(/u1abc|0a1b2c3d/);
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", storage);
  });
});
