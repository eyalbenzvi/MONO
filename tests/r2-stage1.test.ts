import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRICE } from "../scripts/gen/constants";
import { PAIR_PRICE } from "@/lib/cart";
import { MemoryStorage } from "./memoryStorage";
import { FEATURE_KEYS, type UserProfileVector } from "@/types/shirt";
import { B1, B4, B9, W1 } from "./fixtures";

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);
beforeEach(() => storage.clear());

/** Fresh store modules per test: state starts clean, persistence re-reads storage. */
async function fresh() {
  vi.resetModules();
  const taste = await import("@/store/tasteStore");
  const cart = await import("@/store/cartStore");
  const ui = await import("@/store/useUiStore");
  const deck = await import("@/lib/deck");
  const lib = await import("@/lib/taste");
  const catalog = await import("@/lib/catalog");
  return { ...taste, ...cart, ...ui, ...deck, ...lib, SHIRTS: catalog.SHIRTS };
}

type Stores = Awaited<ReturnType<typeof fresh>>;

/** Swipe the ten taste-test cards (alternating) and, optionally, acknowledge the result screen. */
function calibrate(s: Stores, acknowledge = true) {
  for (let i = 0; i < s.CALIBRATION_TOTAL; i++) {
    const top = s.useTasteStore.getState().deck[0];
    s.useTasteStore.getState().commitSwipe(top.id, i % 2 ? "dislike" : "like");
  }
  if (acknowledge) s.useTasteStore.getState().acknowledgeCalibration();
}

const distance = (a: UserProfileVector, b: UserProfileVector) => Math.sqrt(FEATURE_KEYS.reduce((sum, k) => sum + (a[k] - b[k]) ** 2, 0));

describe("R05: saving the same tee again doesn't train again", () => {
  it("five save / unsave cycles move the vector exactly as far as one save", async () => {
    const one = await fresh();
    one.useTasteStore.getState().toggleSaved(B9);
    const once = one.useTasteStore.getState().preferenceVector;

    const s = await fresh();
    for (let i = 0; i < 5; i++) {
      s.useTasteStore.getState().toggleSaved(B9); // save
      s.useTasteStore.getState().toggleSaved(B9); // unsave
    }
    s.useTasteStore.getState().toggleSaved(B9);
    const cycled = s.useTasteStore.getState().preferenceVector;
    expect(distance(cycled, once)).toBeLessThan(1e-9);
    expect(s.useTasteStore.getState().likedIds).toEqual([B9]);
  });

  it("a tee already swiped in Discover doesn't train again when hearted in the shop", async () => {
    const s = await fresh();
    const top = s.useTasteStore.getState().deck[0].id;
    s.useTasteStore.getState().commitSwipe(top, "like");
    const after = s.useTasteStore.getState().preferenceVector;
    s.useTasteStore.getState().toggleSaved(top); // unsave (it was liked)
    s.useTasteStore.getState().toggleSaved(top); // save again
    expect(distance(s.useTasteStore.getState().preferenceVector, after)).toBeLessThan(1e-9);
  });
});

describe("R01: no gamification (Daily 5, streaks and taste levels removed)", () => {
  it("migrates old profiles to v6: the Daily 5 and levels go, the taste stays", async () => {
    storage.setItem(
      "mono-taste",
      JSON.stringify({ state: { likedIds: [W1], daily: { day: "2026-09-25", count: 2, streak: 1, last: null }, milestones: ["Focused"], lastUpdate: null }, version: 2 }),
    );
    const s = await fresh();
    await s.useTasteStore.persist.rehydrate();
    const state = s.useTasteStore.getState() as unknown as Record<string, unknown>;
    expect(state.daily).toBeUndefined();
    expect(state.milestones).toBeUndefined();
    expect(s.useTasteStore.getState().likedIds).toEqual([W1]);
    s.useTasteStore.getState().toggleSaved(B4);
    const saved = JSON.parse(storage.getItem("mono-taste")!);
    expect(saved.version).toBe(6);
    expect(saved.state.daily).toBeUndefined();
    expect(saved.state.milestones).toBeUndefined();
  });

  it("swiping after the taste test shows no toast (the haptic stays)", async () => {
    const s = await fresh();
    calibrate(s);
    const toasts: string[] = [];
    s.useUiStore.subscribe((u, prev) => u.toast && u.toast !== prev.toast && toasts.push(u.toast.message));
    for (let i = 0; i < 6; i++) s.useTasteStore.getState().commitSwipe(s.useTasteStore.getState().deck[0].id, i % 2 ? "like" : "dislike");
    expect(toasts).toEqual([]);
  });
});

describe("R10: Get it in both adds only what's missing", () => {
  it("with black already in the bag it adds the white one only", async () => {
    const s = await fresh();
    s.useCartStore.getState().addToCart(W1, "M", "black");
    s.useCartStore.getState().addPair(W1, "M");
    expect(s.useCartStore.getState().cart).toEqual([
      { id: W1, size: "M", color: "black", qty: 1 },
      { id: W1, size: "M", color: "white", qty: 1 },
    ]);
  });

  it("with both in the bag it adds nothing", async () => {
    const s = await fresh();
    s.useCartStore.getState().addPair(W1, "M");
    const before = s.useCartStore.getState().cart;
    expect(s.useCartStore.getState().addPair(W1, "M")).toBe(false);
    expect(s.useCartStore.getState().cart).toEqual(before);
  });

  it("with one colour at the limit of 9 it adds nothing and says why", async () => {
    const s = await fresh();
    s.useCartStore.getState().addToCart(W1, "M", "black", 9);
    expect(s.useCartStore.getState().addPair(W1, "M")).toBe(false);
    expect(s.useCartStore.getState().cart).toEqual([{ id: W1, size: "M", color: "black", qty: 9 }]);
    expect(s.useUiStore.getState().toast?.message).toMatch(/9/);
  });

  it("labels the button by what the bag already holds: [verb] · [size] · [price]", async () => {
    const { pairStatus, ctaLabel } = await import("@/lib/cart");
    const price = PRICE;
    expect(ctaLabel({ price })).toBe(`Add to bag · $${PRICE}`);
    expect(ctaLabel({ price, size: "M" })).toBe(`Add to bag · M · $${PRICE}`);
    expect(ctaLabel({ price, size: "M", both: true, status: pairStatus([], W1, "M") })).toBe(`Add the pair · M · $${PAIR_PRICE}`);
    expect(ctaLabel({ price, both: true })).toBe(`Add the pair · $${PAIR_PRICE}`);
    expect(ctaLabel({ price, size: "M", both: true, status: pairStatus([{ id: W1, size: "M", color: "white", qty: 1 }], W1, "M") })).toBe(`Complete the pair · +$${PAIR_PRICE - PRICE}`);
    const both = pairStatus(
      [
        { id: W1, size: "M", color: "white", qty: 1 },
        { id: W1, size: "M", color: "black", qty: 2 },
      ],
      W1,
      "M",
    );
    expect(ctaLabel({ price, size: "M", both: true, status: both })).toBe("In your bag · Checkout");
    // Another size doesn't count as this pair.
    expect(ctaLabel({ price, size: "M", both: true, status: pairStatus([{ id: W1, size: "L", color: "white", qty: 1 }], W1, "M") })).toBe(`Add the pair · M · $${PAIR_PRICE}`);
    expect(ctaLabel({ verb: "Buy now", price, size: "M" })).toBe(`Buy now · M · $${PRICE}`);
  });
});

describe("R24: undo never reopens a finished taste test", () => {
  it("after the result screen, Z can't take back the tenth card", async () => {
    const s = await fresh();
    calibrate(s);
    const before = s.useTasteStore.getState();
    expect(s.canUndo(before)).toBe(false);
    s.useTasteStore.getState().undoLast();
    const after = s.useTasteStore.getState();
    expect(after.seen).toEqual(before.seen);
    expect(after.calibrationAcknowledged).toBe(true);
    expect(s.calibrationDone(s.CALIBRATION_IDS, after.seen)).toBe(s.CALIBRATION_TOTAL);
  });

  it("the swipe after it can still be undone", async () => {
    const s = await fresh();
    calibrate(s);
    const id = s.useTasteStore.getState().deck[0].id;
    s.useTasteStore.getState().commitSwipe(id, "like");
    expect(s.canUndo(s.useTasteStore.getState())).toBe(true);
    s.useTasteStore.getState().undoLast();
    expect(s.useTasteStore.getState().deck[0].id).toBe(id);
  });

  it("dialogs are tracked in state, so a closing one doesn't swallow keys", async () => {
    const s = await fresh();
    expect(s.useUiStore.getState().dialogs).toBe(0);
    const close = s.openDialog();
    expect(s.useUiStore.getState().dialogs).toBe(1);
    close();
    close(); // idempotent
    expect(s.useUiStore.getState().dialogs).toBe(0);
  });
});

describe("R31: the latest drop without spreading the catalog into Math.max", () => {
  it("works for catalogs far larger than an argument list can hold", async () => {
    const { latestDrop } = await fresh();
    const many = Array.from({ length: 300_000 }, (_, i) => ({ dropDate: i % 97 }));
    expect(latestDrop(many)).toBe(96);
    expect(latestDrop([])).toBe(0);
  });
});

describe("I16: stored state is whitelisted field by field", () => {
  it("unknown strategies and extra fields in history and deck are not kept", async () => {
    storage.setItem(
      "mono-taste",
      JSON.stringify({
        state: {
          swipeHistory: [
            { shirtId: W1, action: "like", source: "swipe", matchScore: 80, strategy: "greedy", timestamp: 5, evil: "<img>" },
            { shirtId: B4, action: "dislike", source: "nope", matchScore: "x", strategy: "hax", timestamp: "then" },
          ],
          deck: [{ id: B1, strategy: "hax", extra: 1 }],
        },
        version: 3,
      }),
    );
    const s = await fresh();
    await s.useTasteStore.persist.rehydrate();
    const [a, b] = s.useTasteStore.getState().swipeHistory;
    expect(a).toEqual({ shirtId: W1, action: "like", source: "swipe", matchScore: 80, strategy: "greedy", timestamp: 5 });
    expect(b).toEqual({ shirtId: B4, action: "dislike", source: "swipe", matchScore: 0, strategy: "greedy", timestamp: 0 });
    const deck = s.useTasteStore.getState().deck.find((e) => e.id === B1);
    expect(deck === undefined || deck.strategy === "greedy").toBe(true);
    expect(Object.keys(deck ?? { id: 1, strategy: 1 }).sort()).toEqual(["id", "strategy"]);
  });

  it("another tab clearing storage (key null) resets both stores here", async () => {
    const s = await fresh();
    const { syncFromStorage } = await import("@/store/sync");
    s.useTasteStore.getState().toggleSaved(W1);
    s.useCartStore.getState().addToCart(W1, "M");
    storage.clear();
    await syncFromStorage(null);
    expect(s.useTasteStore.getState().likedIds).toEqual([]);
    expect(s.useCartStore.getState().cart).toEqual([]);
  });
});
