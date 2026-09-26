// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRICE } from "../scripts/gen/constants";
import { PAIR_PRICE } from "@/lib/cart";

vi.mock("@/lib/shareImage", () => ({ renderTasteImage: async () => new Blob(["png"], { type: "image/png" }) }));

async function fresh() {
  vi.resetModules();
  window.dataLayer = [];
  sessionStorage.clear();
  localStorage.clear();
  const analytics = await import("@/lib/analytics");
  const cart = await import("@/store/cartStore");
  const taste = await import("@/store/tasteStore");
  return { ...analytics, ...cart, ...taste };
}

const events = (name?: string) => (window.dataLayer ?? []).filter((e) => !name || e.event === name) as Record<string, any>[];

beforeEach(() => {
  window.dataLayer = [];
});

describe("R06: commerce events in GA4's shape", () => {
  it("add_to_cart: currency, value and items with id, name, category, colour, size, price, quantity — and its source", async () => {
    const s = await fresh();
    s.useCartStore.getState().addToCart("mono-0001", "M", "white", 1, { source: "grid" });
    const [e] = events("add_to_cart");
    expect(e).toMatchObject({ currency: "USD", value: PRICE, source: "grid" });
    expect(e.items).toEqual([{ item_id: "mono-0001", item_name: expect.any(String), item_category: expect.any(String), item_variant: "white", size: "M", price: PRICE, quantity: 1 }]);
  });

  it("the pair counts as $90 (not $96), its saving as the items' discount; completing it counts +$42", async () => {
    const s = await fresh();
    s.useCartStore.getState().addPair("mono-0001", "M", { source: "product" });
    const [pair] = events("add_to_cart");
    expect(pair.value).toBe(90);
    expect(pair.items.map((i: any) => [i.item_variant, i.price, i.discount])).toEqual([
      ["black", PRICE, PRICE - PAIR_PRICE / 2],
      ["white", PRICE, PRICE - PAIR_PRICE / 2],
    ]);
    const t = await fresh();
    t.useCartStore.getState().addToCart("mono-0006", "M", "black");
    t.useCartStore.getState().addPair("mono-0006", "M");
    expect(events("add_to_cart")[1]).toMatchObject({ value: 42, items: [{ item_variant: "white", discount: 6 }] });
  });

  it("remove_from_cart when a line goes down or out (and for the mini bag's Undo)", async () => {
    const s = await fresh();
    s.useCartStore.getState().addToCart("mono-0001", "M", "black", 3);
    s.useCartStore.getState().setCartQty({ id: "mono-0001", size: "M", color: "black" }, 1);
    expect(events("remove_from_cart")[0]).toMatchObject({ value: 96, items: [{ quantity: 2 }] });
    s.useCartStore.getState().undoAdd({ id: "mono-0001", size: "M", added: ["black"] });
    expect(events("remove_from_cart")[1]).toMatchObject({ source: "minibag", items: [{ quantity: 1 }] });
  });

  it("purchase: transaction id, total, shipping, discount; items add up to what was paid for goods; the first touch attached", async () => {
    const s = await fresh();
    s.captureLanding({ search: "?utm_source=news&utm_medium=email&utm_campaign=drop&ref=friend", pathname: "/shop/" } as Location, "https://mail.example");
    s.useCartStore.getState().addPair("mono-0001", "M");
    s.useCartStore.getState().addToCart("mono-0001", "L", "black");
    s.useCartStore.getState().placeOrder({ name: "A", email: "a@b.co", address: "1 St", city: "X", zip: "1234", country: "US" });
    const [p] = events("purchase");
    expect(p).toMatchObject({ currency: "USD", value: 138, shipping: 0, discount: 6 });
    expect(p.transaction_id).toMatch(/^MONO-/);
    expect(s.itemsValue(p.items)).toBe(138);
    expect(p.first_touch).toMatchObject({ utm_source: "news", utm_campaign: "drop", ref: "friend", landing_path: "/shop/", referrer: "https://mail.example" });
    expect(JSON.stringify(p)).not.toMatch(/a@b\.co|1 St/);
  });
});

describe("R02: landing and first touch", () => {
  it("landing records the tags once per page load; the session's first touch is kept", async () => {
    const s = await fresh();
    s.captureLanding({ search: "?utm_source=a&taste=abc", pathname: "/" } as Location, "");
    s.captureLanding({ search: "?utm_source=b", pathname: "/shop/" } as Location, "");
    expect(events("landing")).toHaveLength(1);
    expect(events("landing")[0]).toMatchObject({ utm_source: "a", has_taste: true, has_list: false, landing_path: "/", referrer: null });
    s.resetLanding();
    s.captureLanding({ search: "?utm_source=b", pathname: "/shop/" } as Location, "");
    expect(s.firstTouch()).toMatchObject({ utm_source: "a" });
  });
});

describe("R06: shares count only when they happen; undo is tracked", () => {
  it("a dismissed share sheet sends no share_taste; a completed one does", async () => {
    const s = await fresh();
    const { shareTaste } = await import("@/lib/shareTaste");
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" })), canShare: () => true });
    await shareTaste(s.useTasteStore.getState().preferenceVector);
    expect(events("share_taste")).toHaveLength(0);
    (navigator.share as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await shareTaste(s.useTasteStore.getState().preferenceVector);
    expect(events("share_taste")).toHaveLength(1);
    expect(events("share")).toHaveLength(0);
  });

  it("undo", async () => {
    const s = await fresh();
    const id = s.useTasteStore.getState().deck[0].id;
    s.useTasteStore.getState().commitSwipe(id, "like");
    s.useTasteStore.getState().undoLast();
    expect(events("undo")).toEqual([expect.objectContaining({ id, action: "like" })]);
  });
});
