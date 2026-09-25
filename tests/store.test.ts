import { beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_KEYS } from "@/types/shirt";

/* ------------------------------------------------------------------ */
/* localStorage stub (node environment)                                */
/* ------------------------------------------------------------------ */

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

const KEY = "mono-session-v1";

/** Fresh store module per test: state starts clean, persistence re-reads storage. */
async function freshStore() {
  vi.resetModules();
  const mod = await import("@/store/useShirtStore");
  return mod;
}

beforeEach(() => storage.clear());

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

describe("store actions", () => {
  it("commitSwipe: like trains the vector, records history and advances the deck", async () => {
    const { useShirtStore } = await freshStore();
    const s0 = useShirtStore.getState();
    const top = s0.deck[0].id;
    s0.commitSwipe(top, "like");
    const s1 = useShirtStore.getState();
    expect(s1.likedIds).toEqual([top]);
    expect(s1.swipeHistory).toHaveLength(1);
    expect(s1.swipeHistory[0]).toMatchObject({ shirtId: top, action: "like", source: "swipe" });
    expect(s1.preferenceVector).not.toEqual(s0.preferenceVector);
    expect(s1.deck[0].id).not.toBe(top);
    expect(s1.lastUpdate?.shirtId).toBe(top);
  });

  it("commitSwipe ignores a card that isn't on top (duplicate / racing commits)", async () => {
    const { useShirtStore } = await freshStore();
    const s0 = useShirtStore.getState();
    s0.commitSwipe(s0.deck[1].id, "like");
    expect(useShirtStore.getState().swipeHistory).toHaveLength(0);
  });

  it("undoLast restores the vector, lists and the card on top", async () => {
    const { useShirtStore, canUndo } = await freshStore();
    const s0 = useShirtStore.getState();
    const top = s0.deck[0].id;
    s0.commitSwipe(top, "dislike");
    expect(canUndo(useShirtStore.getState())).toBe(true);
    useShirtStore.getState().undoLast();
    const s2 = useShirtStore.getState();
    expect(s2.preferenceVector).toEqual(s0.preferenceVector);
    expect(s2.dislikedIds).toEqual([]);
    expect(s2.swipeHistory).toHaveLength(0);
    expect(s2.deck[0].id).toBe(top);
    expect(canUndo(s2)).toBe(false);
  });

  it("toggleSaved: saving trains + records a shop event, unsaving removes it", async () => {
    const { useShirtStore } = await freshStore();
    const id = "mono-0042";
    const before = useShirtStore.getState().preferenceVector;
    useShirtStore.getState().toggleSaved(id);
    let s = useShirtStore.getState();
    expect(s.likedIds).toContain(id);
    expect(s.swipeHistory.at(-1)).toMatchObject({ shirtId: id, source: "shop", action: "like" });
    expect(s.preferenceVector).not.toEqual(before);
    useShirtStore.getState().toggleSaved(id);
    s = useShirtStore.getState();
    expect(s.likedIds).not.toContain(id);
  });

  it("addToCart merges identical lines and remembers size + colour", async () => {
    const { useShirtStore } = await freshStore();
    const st = useShirtStore.getState();
    st.addToCart("mono-0001", "M", "black");
    st.addToCart("mono-0001", "M", "black");
    st.addToCart("mono-0001", "L", "black");
    const s = useShirtStore.getState();
    expect(s.cart).toHaveLength(2);
    expect(s.cart.find((l) => l.size === "M")?.qty).toBe(2);
    expect(s.selectedSizes["mono-0001"]).toBe("L");
    expect(s.selectedColors["mono-0001"]).toBe("black");
  });

  it("placeOrder turns the bag into an order and empties it", async () => {
    const { useShirtStore } = await freshStore();
    useShirtStore.getState().addToCart("mono-0001", "M", "white");
    const order = useShirtStore.getState().placeOrder({ name: "A", email: "a@example.com" });
    expect(order).not.toBeNull();
    const s = useShirtStore.getState();
    expect(s.cart).toEqual([]);
    expect(s.lastOrder?.number).toBe(order!.number);
    expect(s.lastOrder?.items).toHaveLength(1);
    expect(useShirtStore.getState().placeOrder({ name: "A", email: "a@example.com" })).toBeNull();
  });

  it("reset clears taste but keeps the bag", async () => {
    const { useShirtStore } = await freshStore();
    const st = useShirtStore.getState();
    st.commitSwipe(st.deck[0].id, "like");
    st.addToCart("mono-0001", "S", "black");
    useShirtStore.getState().reset();
    const s = useShirtStore.getState();
    expect(s.swipeHistory).toEqual([]);
    expect(s.cart).toHaveLength(1);
  });
});

describe("stage-1 fixes", () => {
  it("R2: Pass in Discover, then Save in the shop → Undo is disabled and can't roll back the wrong thing", async () => {
    const { useShirtStore, canUndo } = await freshStore();
    const top = useShirtStore.getState().deck[0].id;
    useShirtStore.getState().commitSwipe(top, "dislike");
    const afterPass = useShirtStore.getState().preferenceVector;
    useShirtStore.getState().toggleSaved(top);
    const afterSave = useShirtStore.getState();
    expect(canUndo(afterSave)).toBe(false);
    afterSave.undoLast();
    expect(useShirtStore.getState().preferenceVector).toEqual(afterSave.preferenceVector);
    expect(useShirtStore.getState().preferenceVector).not.toEqual(afterPass);
    expect(useShirtStore.getState().likedIds).toEqual([top]);
  });

  it("R2: a like never duplicates an id that is already saved", async () => {
    const { useShirtStore } = await freshStore();
    const top = useShirtStore.getState().deck[0].id;
    useShirtStore.setState({ likedIds: [top] });
    useShirtStore.getState().commitSwipe(top, "like");
    expect(useShirtStore.getState().likedIds).toEqual([top]);
  });

  it("R19: finishing the taste test clears queued button swipes", async () => {
    const { useShirtStore, CALIBRATION_TOTAL } = await freshStore();
    for (let i = 0; i < CALIBRATION_TOTAL - 1; i++) {
      const s = useShirtStore.getState();
      s.commitSwipe(s.deck[0].id, i % 2 ? "like" : "dislike");
    }
    useShirtStore.setState({ swipeQueue: [1, 2, 3].map((n) => ({ action: "like" as const, nonce: n })) });
    const s = useShirtStore.getState();
    s.commitSwipe(s.deck[0].id, "like", true);
    expect(useShirtStore.getState().swipeQueue).toEqual([]);
  });

  it("R20: going over 9 per line shows a limit toast instead of 'added'", async () => {
    const { useShirtStore } = await freshStore();
    useShirtStore.getState().addToCart("mono-0001", "M", "black", 8);
    useShirtStore.getState().addToCart("mono-0001", "M", "black", 3);
    const s = useShirtStore.getState();
    expect(s.cart[0].qty).toBe(9);
    expect(s.toast?.message).toMatch(/max 9/i);
  });

  it("R20: a size change that would merge past 9 is refused", async () => {
    const { useShirtStore } = await freshStore();
    useShirtStore.getState().addToCart("mono-0001", "M", "black", 6);
    useShirtStore.getState().addToCart("mono-0001", "L", "black", 5);
    useShirtStore.getState().changeCartItem({ id: "mono-0001", size: "M", color: "black" }, { size: "L" });
    const s = useShirtStore.getState();
    expect(s.cart.map((l) => [l.size, l.qty])).toEqual([["M", 6], ["L", 5]]);
    expect(s.toast?.message).toMatch(/max 9/i);
  });

  it("I15: Start over can be undone (snapshot / restore brings Saved back)", async () => {
    const { useShirtStore } = await freshStore();
    useShirtStore.getState().toggleSaved("mono-0003");
    const snap = useShirtStore.getState().snapshot();
    useShirtStore.getState().reset();
    expect(useShirtStore.getState().likedIds).toEqual([]);
    useShirtStore.getState().restore(snap);
    expect(useShirtStore.getState().likedIds).toEqual(["mono-0003"]);
    expect(useShirtStore.getState().swipeHistory).toEqual(snap.swipeHistory);
  });
});

/* ------------------------------------------------------------------ */
/* Persistence migrations                                              */
/* ------------------------------------------------------------------ */

const TEN = { geometric: 0.8, typography: 0.2, architectural: 0.7, abstract: 0.3, line_art: 0.4, halftone_raster: 0.3, density: 0.6, contrast: 0.8, dark_industrial: 0.7, clean_minimal: 0.3 };
const FOURTEEN = { ...TEN, pictorial: 0.9, wit: 0.1, retro: 0.6, nature: 0.2 };

const base = (vector: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  likedIds: ["mono-0007"],
  dislikedIds: ["mono-0008"],
  preferenceVector: vector,
  swipeHistory: [{ shirtId: "mono-0007", action: "like", source: "swipe", matchScore: 70, strategy: "calibration", timestamp: 1 }],
  deck: [],
  selectedSizes: { "mono-0007": "M" },
  lastUpdate: null,
  calibrationAcknowledged: true,
  onboardingSeen: true,
  ...extra,
});

async function migrateFrom(version: number, state: unknown) {
  storage.setItem(KEY, JSON.stringify({ state, version }));
  const { useShirtStore } = await freshStore();
  await useShirtStore.persist.rehydrate();
  return useShirtStore.getState();
}

describe("persist migrations", () => {
  it("v2 sessions (old 25-shirt catalog) start fresh", async () => {
    const s = await migrateFrom(2, base(TEN));
    expect(s.likedIds).toEqual([]);
    expect(s.swipeHistory).toEqual([]);
  });

  it("v3 → current: 10-dim taste extended with neutral 0.5, bag lines get their original colour", async () => {
    const s = await migrateFrom(3, base(TEN, { cart: [{ id: "mono-0001", size: "M", qty: 2 }], lastOrder: null }));
    expect(Object.keys(s.preferenceVector).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(s.preferenceVector.geometric).toBe(0.8);
    expect(s.preferenceVector.pictorial).toBe(0.5);
    expect(s.preferenceVector.figurative).toBe(0.5);
    expect(s.preferenceVector.classic).toBe(0.5);
    expect(s.cart[0]).toMatchObject({ id: "mono-0001", size: "M", qty: 2 });
    expect(s.cart[0].color === "black" || s.cart[0].color === "white").toBe(true);
    expect(s.likedIds).toEqual(["mono-0007"]);
  });

  it("v4 → current keeps chosen colours and extends the vector", async () => {
    const s = await migrateFrom(4, base(TEN, { cart: [{ id: "mono-0002", size: "L", qty: 1, color: "white" }], selectedColors: { "mono-0002": "white" }, lastOrder: null }));
    expect(s.cart[0].color).toBe("white");
    expect(s.selectedColors["mono-0002"]).toBe("white");
    expect(s.preferenceVector.nature).toBe(0.5);
    expect(s.preferenceVector.classic).toBe(0.5);
  });

  it("v5 → current: 14-dim taste kept, figurative + classic added at 0.5 (also in lastUpdate)", async () => {
    const s = await migrateFrom(
      5,
      base(FOURTEEN, {
        cart: [],
        selectedColors: {},
        lastOrder: null,
        lastUpdate: { shirtId: "mono-0007", action: "like", before: FOURTEEN, after: FOURTEEN },
      }),
    );
    expect(s.preferenceVector.pictorial).toBe(0.9);
    expect(s.preferenceVector.figurative).toBe(0.5);
    expect(s.preferenceVector.classic).toBe(0.5);
    expect(s.lastUpdate?.before.classic).toBe(0.5);
    expect(s.lastUpdate?.after.figurative).toBe(0.5);
    for (const k of FEATURE_KEYS) expect(Number.isFinite(s.preferenceVector[k])).toBe(true);
  });

  it("drops bag lines whose design no longer exists", async () => {
    const s = await migrateFrom(4, base(TEN, { cart: [{ id: "mono-9999", size: "M", qty: 1, color: "black" }], lastOrder: null }));
    expect(s.cart).toEqual([]);
  });
});
