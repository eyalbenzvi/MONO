import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRICE } from "../scripts/gen/constants";
import { PAIR_PRICE } from "@/lib/cart";
import { MemoryStorage } from "./memoryStorage";
import { FEATURE_KEYS, createInitialVector, type UserProfileVector } from "@/types/shirt";

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
    one.useTasteStore.getState().toggleSaved("mono-0500");
    const once = one.useTasteStore.getState().preferenceVector;

    const s = await fresh();
    for (let i = 0; i < 5; i++) {
      s.useTasteStore.getState().toggleSaved("mono-0500"); // save
      s.useTasteStore.getState().toggleSaved("mono-0500"); // unsave
    }
    s.useTasteStore.getState().toggleSaved("mono-0500");
    const cycled = s.useTasteStore.getState().preferenceVector;
    expect(distance(cycled, once)).toBeLessThan(1e-9);
    expect(s.useTasteStore.getState().likedIds).toEqual(["mono-0500"]);
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

describe("R01: Daily 5, streak and milestones count honestly", () => {
  it("the taste test doesn't count towards the Daily 5; swipes after it do", async () => {
    const s = await fresh();
    calibrate(s, false);
    expect(s.useTasteStore.getState().daily.count).toBe(0);
    s.useTasteStore.getState().acknowledgeCalibration();
    s.useTasteStore.getState().commitSwipe(s.useTasteStore.getState().deck[0].id, "like");
    expect(s.useTasteStore.getState().daily.count).toBe(1);
  });

  it("swipe → undo, three times, leaves the Daily 5 where it was", async () => {
    const s = await fresh();
    calibrate(s);
    for (let i = 0; i < 3; i++) {
      s.useTasteStore.getState().commitSwipe(s.useTasteStore.getState().deck[0].id, "like");
      s.useTasteStore.getState().undoLast();
    }
    expect(s.useTasteStore.getState().daily.count).toBe(0);
  });

  it("a streak shows from its second day", async () => {
    const { currentStreak } = await fresh();
    expect(currentStreak({ day: "2026-09-26", count: 5, streak: 1, last: "2026-09-26" }, "2026-09-26")).toBe(0);
    expect(currentStreak({ day: "2026-09-26", count: 5, streak: 2, last: "2026-09-26" }, "2026-09-26")).toBe(2);
    expect(currentStreak({ day: "2026-09-25", count: 5, streak: 3, last: "2026-09-25" }, "2026-09-26")).toBe(3);
  });

  it("one source for the level word, from the profile's sharpness (no % and no swipe counts)", async () => {
    const { tasteLevel, TASTE_LEVELS } = await fresh();
    expect(TASTE_LEVELS).toEqual(["Sharpening", "Focused", "Dialled in"]);
    const at = (d: number) => {
      const v = createInitialVector();
      for (const k of FEATURE_KEYS) v[k] = 0.5 + d;
      return v;
    };
    expect(tasteLevel(at(0))).toBe("Sharpening");
    expect(tasteLevel(at(0.11))).toBe("Focused"); // sharpness 0.44
    expect(tasteLevel(at(0.2))).toBe("Dialled in"); // sharpness 0.8
  });

  it("a level reached is remembered: undo and redo doesn't announce it twice", async () => {
    const s = await fresh();
    calibrate(s);
    // A card whose like lifts the profile from Sharpening to Focused.
    const shirt = s.SHIRTS.find((x) => FEATURE_KEYS.reduce((sum, k) => sum + Math.abs(x.features[k] - 0.5), 0) > 2.4)!;
    const spread = FEATURE_KEYS.reduce((sum, k) => sum + Math.abs(shirt.features[k] - 0.5), 0);
    const t = 1.58 / spread; // sharpness just under 0.4, pointing at the shirt
    const v = createInitialVector();
    for (const k of FEATURE_KEYS) v[k] = 0.5 + t * (shirt.features[k] - 0.5);
    s.useTasteStore.setState({ preferenceVector: v, deck: [{ id: shirt.id, strategy: "greedy" }], milestones: [] });
    expect(s.tasteLevel(v)).toBe("Sharpening");

    const toasts: string[] = [];
    s.useUiStore.subscribe((u, prev) => u.toast && u.toast !== prev.toast && toasts.push(u.toast.message));
    s.useTasteStore.getState().commitSwipe(shirt.id, "like");
    expect(s.useTasteStore.getState().milestones).toEqual(["Focused"]);
    s.useTasteStore.getState().undoLast();
    expect(s.useTasteStore.getState().milestones).toEqual(["Focused"]);
    s.useTasteStore.getState().commitSwipe(shirt.id, "like");
    expect(s.useTasteStore.getState().milestones).toEqual(["Focused"]);
    expect(toasts.filter((m) => /Focused/.test(m)).length).toBeLessThanOrEqual(1);
  });

  it("migrates taste v2 → v3: milestones start empty", async () => {
    storage.setItem("mono-taste", JSON.stringify({ state: { likedIds: ["mono-0001"], daily: { day: "2026-09-25", count: 2, streak: 1, last: null } }, version: 2 }));
    const s = await fresh();
    await s.useTasteStore.persist.rehydrate();
    expect(s.useTasteStore.getState().milestones).toEqual([]);
    expect(s.useTasteStore.getState().likedIds).toEqual(["mono-0001"]);
    s.useTasteStore.getState().toggleSaved("mono-0002");
    expect(JSON.parse(storage.getItem("mono-taste")!).version).toBe(3);
  });
});

describe("R10: Get it in both adds only what's missing", () => {
  it("with black already in the bag it adds the white one only", async () => {
    const s = await fresh();
    s.useCartStore.getState().addToCart("mono-0001", "M", "black");
    s.useCartStore.getState().addPair("mono-0001", "M");
    expect(s.useCartStore.getState().cart).toEqual([
      { id: "mono-0001", size: "M", color: "black", qty: 1 },
      { id: "mono-0001", size: "M", color: "white", qty: 1 },
    ]);
  });

  it("with both in the bag it adds nothing", async () => {
    const s = await fresh();
    s.useCartStore.getState().addPair("mono-0001", "M");
    const before = s.useCartStore.getState().cart;
    expect(s.useCartStore.getState().addPair("mono-0001", "M")).toBe(false);
    expect(s.useCartStore.getState().cart).toEqual(before);
  });

  it("with one colour at the limit of 9 it adds nothing and says why", async () => {
    const s = await fresh();
    s.useCartStore.getState().addToCart("mono-0001", "M", "black", 9);
    expect(s.useCartStore.getState().addPair("mono-0001", "M")).toBe(false);
    expect(s.useCartStore.getState().cart).toEqual([{ id: "mono-0001", size: "M", color: "black", qty: 9 }]);
    expect(s.useUiStore.getState().toast?.message).toMatch(/9/);
  });

  it("labels the button by what the bag already holds", async () => {
    const { pairStatus, pairLabel } = await import("@/lib/cart");
    const price = PRICE;
    expect(pairLabel(pairStatus([], "mono-0001", "M"), price)).toBe("Get it in both");
    expect(pairLabel(pairStatus([{ id: "mono-0001", size: "M", color: "white", qty: 1 }], "mono-0001", "M"), price)).toBe("Complete the pair · +$42");
    expect(
      pairLabel(
        pairStatus(
          [
            { id: "mono-0001", size: "M", color: "white", qty: 1 },
            { id: "mono-0001", size: "M", color: "black", qty: 2 },
          ],
          "mono-0001",
          "M",
        ),
        price,
      ),
    ).toBe("In your bag ✓");
    // Another size doesn't count as this pair.
    expect(pairLabel(pairStatus([{ id: "mono-0001", size: "L", color: "white", qty: 1 }], "mono-0001", "M"), price)).toBe("Get it in both");
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
            { shirtId: "mono-0001", action: "like", source: "swipe", matchScore: 80, strategy: "greedy", timestamp: 5, evil: "<img>" },
            { shirtId: "mono-0002", action: "dislike", source: "nope", matchScore: "x", strategy: "hax", timestamp: "then" },
          ],
          deck: [{ id: "mono-0003", strategy: "hax", extra: 1 }],
        },
        version: 3,
      }),
    );
    const s = await fresh();
    await s.useTasteStore.persist.rehydrate();
    const [a, b] = s.useTasteStore.getState().swipeHistory;
    expect(a).toEqual({ shirtId: "mono-0001", action: "like", source: "swipe", matchScore: 80, strategy: "greedy", timestamp: 5 });
    expect(b).toEqual({ shirtId: "mono-0002", action: "dislike", source: "swipe", matchScore: 0, strategy: "greedy", timestamp: 0 });
    const deck = s.useTasteStore.getState().deck.find((e) => e.id === "mono-0003");
    expect(deck === undefined || deck.strategy === "greedy").toBe(true);
    expect(Object.keys(deck ?? { id: 1, strategy: 1 }).sort()).toEqual(["id", "strategy"]);
  });

  it("another tab clearing storage (key null) resets both stores here", async () => {
    const s = await fresh();
    const { syncFromStorage } = await import("@/store/sync");
    s.useTasteStore.getState().toggleSaved("mono-0001");
    s.useCartStore.getState().addToCart("mono-0001", "M");
    storage.clear();
    await syncFromStorage(null);
    expect(s.useTasteStore.getState().likedIds).toEqual([]);
    expect(s.useCartStore.getState().cart).toEqual([]);
  });
});
