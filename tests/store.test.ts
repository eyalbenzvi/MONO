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

/** Fresh store modules per test: state starts clean, persistence re-reads storage. */
async function fresh() {
  vi.resetModules();
  const taste = await import("@/store/tasteStore");
  const cart = await import("@/store/cartStore");
  const ui = await import("@/store/useUiStore");
  const legacy = await import("@/store/legacySession");
  return { ...taste, ...cart, ...ui, ...legacy };
}

beforeEach(() => storage.clear());

const CUSTOMER = { name: "Ada Lovelace", email: "ada@example.com", address: "12 Analytical St", city: "Tel Aviv", zip: "6100001", country: "IL" };

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

describe("taste store", () => {
  it("the gesture legend stays through flips and zoom, and goes after the first swipe (R8)", async () => {
    const { useTasteStore, useUiStore } = await fresh();
    useUiStore.getState().toggleFlip();
    useUiStore.getState().toggleFlip(false);
    useUiStore.getState().setZoom(useTasteStore.getState().deck[0].id);
    useUiStore.getState().setZoom(null);
    expect(useTasteStore.getState().onboardingSeen).toBe(false);
    useTasteStore.getState().commitSwipe(useTasteStore.getState().deck[0].id, "dislike");
    expect(useTasteStore.getState().onboardingSeen).toBe(true);
  });

  it("commitSwipe: like trains the vector, records history + seen and advances the deck", async () => {
    const { useTasteStore } = await fresh();
    const s0 = useTasteStore.getState();
    const top = s0.deck[0].id;
    s0.commitSwipe(top, "like");
    const s1 = useTasteStore.getState();
    expect(s1.likedIds).toEqual([top]);
    expect(s1.seen).toEqual([top]);
    expect(s1.swipeHistory).toHaveLength(1);
    expect(s1.swipeHistory[0]).toMatchObject({ shirtId: top, action: "like", source: "swipe" });
    expect(s1.preferenceVector).not.toEqual(s0.preferenceVector);
    expect(s1.deck[0].id).not.toBe(top);
    expect(s1.lastUpdate?.shirtId).toBe(top);
  });

  it("commitSwipe ignores a card that isn't on top (duplicate / racing commits)", async () => {
    const { useTasteStore } = await fresh();
    const s0 = useTasteStore.getState();
    s0.commitSwipe(s0.deck[1].id, "like");
    expect(useTasteStore.getState().swipeHistory).toHaveLength(0);
  });

  it("commitSwipe resets the card's UI state (flip) and pushes an analytics event", async () => {
    const { useTasteStore, useUiStore } = await fresh();
    const dl: unknown[] = [];
    vi.stubGlobal("window", { dataLayer: dl });
    useUiStore.setState({ isFlipped: true });
    const s0 = useTasteStore.getState();
    s0.commitSwipe(s0.deck[0].id, "dislike");
    expect(useUiStore.getState().isFlipped).toBe(false);
    expect(dl).toContainEqual(expect.objectContaining({ event: "swipe", action: "dislike" }));
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", storage);
  });

  it("undoLast restores the vector, lists and the card on top", async () => {
    const { useTasteStore, canUndo, useUiStore } = await fresh();
    const s0 = useTasteStore.getState();
    const top = s0.deck[0].id;
    s0.commitSwipe(top, "dislike");
    expect(canUndo(useTasteStore.getState())).toBe(true);
    useTasteStore.getState().undoLast();
    const s2 = useTasteStore.getState();
    expect(s2.preferenceVector).toEqual(s0.preferenceVector);
    expect(s2.dislikedIds).toEqual([]);
    expect(s2.seen).toEqual([]);
    expect(s2.swipeHistory).toHaveLength(0);
    expect(s2.deck[0].id).toBe(top);
    expect(canUndo(s2)).toBe(false);
    expect(useUiStore.getState().undoFx?.id).toBe(top);
  });

  it("toggleSaved: saving trains + records a shop event, unsaving removes it", async () => {
    const { useTasteStore } = await fresh();
    const id = "mono-0043";
    const before = useTasteStore.getState().preferenceVector;
    useTasteStore.getState().toggleSaved(id);
    let s = useTasteStore.getState();
    expect(s.likedIds).toContain(id);
    expect(s.seen).toContain(id);
    expect(s.swipeHistory.at(-1)).toMatchObject({ shirtId: id, source: "shop", action: "like" });
    expect(s.preferenceVector).not.toEqual(before);
    useTasteStore.getState().toggleSaved(id);
    s = useTasteStore.getState();
    expect(s.likedIds).not.toContain(id);
  });

  it("reset clears taste (the bag lives in its own store)", async () => {
    const { useTasteStore, useCartStore } = await fresh();
    const st = useTasteStore.getState();
    st.commitSwipe(st.deck[0].id, "like");
    useCartStore.getState().addToCart("mono-0001", "S", "black");
    useTasteStore.getState().reset();
    expect(useTasteStore.getState().swipeHistory).toEqual([]);
    expect(useTasteStore.getState().seen).toEqual([]);
    expect(useCartStore.getState().cart).toHaveLength(1);
  });

  it("history is capped, but every seen id is kept for the deck", async () => {
    const { useTasteStore, HISTORY_LIMIT } = await fresh();
    const events = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => ({
      shirtId: `mono-${String(i + 1).padStart(4, "0")}`,
      action: "dislike" as const,
      source: "swipe" as const,
      matchScore: 50,
      strategy: "greedy" as const,
      timestamp: i,
    }));
    useTasteStore.setState({ swipeHistory: events.slice(0, -1), seen: events.slice(0, -1).map((e) => e.shirtId), deck: [] });
    useTasteStore.getState().fillDeck();
    const s = useTasteStore.getState();
    s.commitSwipe(s.deck[0].id, "like");
    const after = useTasteStore.getState();
    expect(after.swipeHistory).toHaveLength(HISTORY_LIMIT);
    expect(after.seen).toHaveLength(HISTORY_LIMIT + 20);
  });
});

describe("taste store v2 (F10)", () => {
  it("migrates v1 → v2 with an empty Daily 5 and counts Discover swipes after the taste test", async () => {
    storage.setItem("mono-taste", JSON.stringify({ state: { likedIds: ["mono-0001"], onboardingSeen: true, calibrationAcknowledged: true }, version: 1 }));
    const { useTasteStore } = await fresh();
    await useTasteStore.persist.rehydrate();
    expect(useTasteStore.getState().likedIds).toEqual(["mono-0001"]);
    expect(useTasteStore.getState().daily).toMatchObject({ count: 0, streak: 0, last: null });
    useTasteStore.getState().fillDeck(); // as AppShell does after hydration
    useTasteStore.getState().commitSwipe(useTasteStore.getState().deck[0].id, "like");
    expect(useTasteStore.getState().daily.count).toBe(1);
    expect(JSON.parse(storage.getItem("mono-taste")!).version).toBe(4);
  });
});

describe("cart store", () => {
  it("remembers one size for every design once chosen (F1)", async () => {
    const { useCartStore, sizeFor } = await fresh();
    expect(sizeFor(useCartStore.getState(), "mono-0006")).toBeUndefined();
    useCartStore.getState().setSize("mono-0001", "L");
    expect(sizeFor(useCartStore.getState(), "mono-0006")).toBe("L");
    useCartStore.getState().addToCart("mono-0003", "S", "black");
    expect(useCartStore.getState().preferredSize).toBe("S");
    // a size picked for one design still wins for that design
    expect(sizeFor(useCartStore.getState(), "mono-0001")).toBe("L");
    expect(sizeFor(useCartStore.getState(), "mono-0009")).toBe("S");
  });

  it("addPair adds one black and one white in the size, priced as the pair (F5)", async () => {
    const { useCartStore, useUiStore } = await fresh();
    const { cartTotals } = await import("@/lib/cart");
    expect(useCartStore.getState().addPair("mono-0004", "M")).toBe(true);
    const { cart } = useCartStore.getState();
    expect(cart).toEqual([
      { id: "mono-0004", size: "M", color: "black", qty: 1 },
      { id: "mono-0004", size: "M", color: "white", qty: 1 },
    ]);
    expect(cartTotals(cart).total).toBe(90);
    expect(useUiStore.getState().added).toMatchObject({ id: "mono-0004", size: "M", pair: true });
  });

  it("migrates cart v1 → v2, seeding the remembered size", async () => {
    storage.setItem("mono-cart", JSON.stringify({ state: { cart: [{ id: "mono-0001", size: "S", color: "black", qty: 1 }, { id: "mono-0006", size: "XL", color: "white", qty: 1 }], selectedSizes: { "mono-0003": "M" } }, version: 1 }));
    const { useCartStore } = await fresh();
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().preferredSize).toBe("XL");
    expect(JSON.parse(storage.getItem("mono-cart")!).version).toBe(4);
    storage.setItem("mono-cart", JSON.stringify({ state: { cart: [], selectedSizes: { "mono-0003": "M" } }, version: 1 }));
    const again = await fresh();
    await again.useCartStore.persist.rehydrate();
    expect(again.useCartStore.getState().preferredSize).toBe("M");
    storage.setItem("mono-cart", JSON.stringify({ state: { cart: [] }, version: 1 }));
    const empty = await fresh();
    await empty.useCartStore.persist.rehydrate();
    expect(empty.useCartStore.getState().preferredSize).toBeNull();
  });

  it("every add confirms once, in the mini bag (no toast); Undo takes back exactly that add (round 2, R13)", async () => {
    const { useCartStore, useUiStore } = await fresh();
    useCartStore.getState().addToCart("mono-0001", "M", "black");
    expect(useUiStore.getState().toast).toBeNull();
    expect(useUiStore.getState().added).toMatchObject({ id: "mono-0001", size: "M", color: "black", added: ["black"] });
    useCartStore.getState().addToCart("mono-0001", "M", "black");
    useCartStore.getState().undoAdd(useUiStore.getState().added!);
    expect(useCartStore.getState().cart).toEqual([{ id: "mono-0001", size: "M", color: "black", qty: 1 }]);
    useUiStore.setState({ added: null });
    useCartStore.getState().addToCart("mono-0006", "M", "black", 1, { silent: true });
    expect(useUiStore.getState().added).toBeNull();
  });

  it("addToCart merges identical lines and remembers size + colour", async () => {
    const { useCartStore } = await fresh();
    const st = useCartStore.getState();
    st.addToCart("mono-0001", "M", "black");
    st.addToCart("mono-0001", "M", "black");
    st.addToCart("mono-0001", "L", "black");
    const s = useCartStore.getState();
    expect(s.cart).toHaveLength(2);
    expect(s.cart.find((l) => l.size === "M")?.qty).toBe(2);
    expect(s.selectedSizes["mono-0001"]).toBe("L");
    expect(s.selectedColors["mono-0001"]).toBe("black");
  });

  it("placeOrder turns the bag into an order and empties it", async () => {
    const { useCartStore } = await fresh();
    useCartStore.getState().addToCart("mono-0001", "M", "white");
    const order = useCartStore.getState().placeOrder(CUSTOMER);
    expect(order).not.toBeNull();
    expect(order!.customer.city).toBe("Tel Aviv");
    expect(order!.arrives.to).toBeGreaterThan(order!.arrives.from);
    const s = useCartStore.getState();
    expect(s.cart).toEqual([]);
    expect(s.lastOrder?.number).toBe(order!.number);
    expect(s.lastOrder?.items).toHaveLength(1);
    expect(useCartStore.getState().placeOrder(CUSTOMER)).toBeNull();
  });

  it("R28: the saved last order holds no personal details", async () => {
    const { useCartStore } = await fresh();
    useCartStore.getState().addToCart("mono-0001", "M", "white");
    useCartStore.getState().placeOrder(CUSTOMER);
    const saved = storage.getItem("mono-cart")!;
    // As stored values (quoted): a short one like the country "IL" can turn up inside the random order number.
    for (const v of Object.values(CUSTOMER)) expect(saved).not.toContain(JSON.stringify(v));
    expect(Object.keys(useCartStore.getState().lastOrder!).sort()).toEqual(["items", "number", "placedAt", "shipping", "subtotal", "total"]);
  });

  it("R28: migrating to v3 clears the name and email kept by older versions", async () => {
    storage.setItem(
      "mono-cart",
      JSON.stringify({ state: { cart: [], lastOrder: { number: "MONO-ABC", items: [{ id: "mono-0001", size: "M", color: "black", qty: 1 }], subtotal: 48, shipping: 6, total: 54, name: "Ada Lovelace", email: "ada@example.com", placedAt: 1 } }, version: 2 }),
    );
    const { useCartStore } = await fresh();
    await useCartStore.persist.rehydrate();
    const o = useCartStore.getState().lastOrder!;
    expect(o.number).toBe("MONO-ABC");
    expect(o.total).toBe(54);
    expect(JSON.stringify(o)).not.toContain("Ada");
    const saved = storage.getItem("mono-cart")!;
    expect(saved).not.toContain("ada@example.com");
    expect(JSON.parse(saved).version).toBe(4);
  });
});

describe("stage-1 fixes", () => {
  it("R2: Pass in Discover, then Save in the shop → Undo is disabled and can't roll back the wrong thing", async () => {
    const { useTasteStore, canUndo } = await fresh();
    const top = useTasteStore.getState().deck[0].id;
    useTasteStore.getState().commitSwipe(top, "dislike");
    const afterPass = useTasteStore.getState().preferenceVector;
    useTasteStore.getState().toggleSaved(top);
    const afterSave = useTasteStore.getState();
    expect(canUndo(afterSave)).toBe(false);
    afterSave.undoLast();
    expect(useTasteStore.getState().preferenceVector).toEqual(afterSave.preferenceVector);
    // Round 2, R05: a design trains once — the pass already did.
    expect(useTasteStore.getState().preferenceVector).toEqual(afterPass);
    expect(useTasteStore.getState().likedIds).toEqual([top]);
  });

  it("R2: a like never duplicates an id that is already saved", async () => {
    const { useTasteStore } = await fresh();
    const top = useTasteStore.getState().deck[0].id;
    useTasteStore.setState({ likedIds: [top] });
    useTasteStore.getState().commitSwipe(top, "like");
    expect(useTasteStore.getState().likedIds).toEqual([top]);
  });

  it("R19: finishing the taste test clears queued button swipes", async () => {
    const { useTasteStore, useUiStore } = await fresh();
    const { CALIBRATION_TOTAL } = await import("@/lib/deck");
    for (let i = 0; i < CALIBRATION_TOTAL - 1; i++) {
      const s = useTasteStore.getState();
      s.commitSwipe(s.deck[0].id, i % 2 ? "like" : "dislike");
    }
    useUiStore.setState({ swipeQueue: [1, 2, 3].map((n) => ({ action: "like" as const, nonce: n })) });
    const s = useTasteStore.getState();
    s.commitSwipe(s.deck[0].id, "like", true);
    expect(useUiStore.getState().swipeQueue).toEqual([]);
  });

  it("R20: going over 9 per line shows a limit toast instead of 'added'", async () => {
    const { useCartStore, useUiStore } = await fresh();
    useCartStore.getState().addToCart("mono-0001", "M", "black", 8);
    useCartStore.getState().addToCart("mono-0001", "M", "black", 3);
    expect(useCartStore.getState().cart[0].qty).toBe(9);
    expect(useUiStore.getState().toast?.message).toMatch(/max 9/i);
  });

  it("R20: a size change that would merge past 9 is refused", async () => {
    const { useCartStore, useUiStore } = await fresh();
    useCartStore.getState().addToCart("mono-0001", "M", "black", 6);
    useCartStore.getState().addToCart("mono-0001", "L", "black", 5);
    useCartStore.getState().changeCartItem({ id: "mono-0001", size: "M", color: "black" }, { size: "L" });
    expect(useCartStore.getState().cart.map((l) => [l.size, l.qty])).toEqual([["M", 6], ["L", 5]]);
    expect(useUiStore.getState().toast?.message).toMatch(/max 9/i);
  });

  it("I15: Start over can be undone (snapshot / restore brings Saved back)", async () => {
    const { useTasteStore } = await fresh();
    useTasteStore.getState().toggleSaved("mono-0003");
    const snap = useTasteStore.getState().snapshot();
    useTasteStore.getState().reset();
    expect(useTasteStore.getState().likedIds).toEqual([]);
    useTasteStore.getState().restore(snap);
    expect(useTasteStore.getState().likedIds).toEqual(["mono-0003"]);
    expect(useTasteStore.getState().swipeHistory).toEqual(snap.swipeHistory);
  });
});

/* ------------------------------------------------------------------ */
/* Persistence: guards and migrations                                  */
/* ------------------------------------------------------------------ */

describe("stored state guard", () => {
  it("malformed or hand-edited storage falls back to defaults, keeping what is valid", async () => {
    storage.setItem(
      "mono-taste",
      JSON.stringify({ state: { likedIds: ["mono-0005", 42, "mono-9999", "mono-0005"], preferenceVector: { geometric: "x", wit: 2, nature: 0.3 }, swipeHistory: "nope", deck: [{ id: "bogus" }], onboardingSeen: "yes" }, version: 1 }),
    );
    storage.setItem("mono-cart", JSON.stringify({ state: { cart: [{ id: "mono-0001", size: "M", color: "black", qty: 3 }, { id: "mono-0001", size: "XXXL", color: "red", qty: -1 }], selectedSizes: { "mono-0001": "L", "mono-0006": 7 } }, version: 1 }));
    const { useTasteStore, useCartStore } = await fresh();
    await useTasteStore.persist.rehydrate();
    await useCartStore.persist.rehydrate();
    const t = useTasteStore.getState();
    expect(t.likedIds).toEqual(["mono-0005"]);
    expect(t.preferenceVector.geometric).toBe(0.5);
    expect(t.preferenceVector.wit).toBe(1);
    expect(t.preferenceVector.nature).toBe(0.3);
    expect(t.swipeHistory).toEqual([]);
    expect(t.onboardingSeen).toBe(false);
    const c = useCartStore.getState();
    expect(c.cart).toEqual([{ id: "mono-0001", size: "M", color: "black", qty: 3 }]);
    expect(c.selectedSizes).toEqual({ "mono-0001": "L" });
  });
});

const LEGACY = "mono-session-v1";
const TEN = { geometric: 0.8, typography: 0.2, architectural: 0.7, abstract: 0.3, line_art: 0.4, halftone_raster: 0.3, density: 0.6, contrast: 0.8, dark_industrial: 0.7, clean_minimal: 0.3 };
const FOURTEEN = { ...TEN, pictorial: 0.9, wit: 0.1, retro: 0.6, nature: 0.2 };

const base = (vector: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  likedIds: ["mono-0007"],
  dislikedIds: ["mono-0008"],
  preferenceVector: vector,
  swipeHistory: [
    { shirtId: "mono-0007", action: "like", source: "swipe", matchScore: 70, strategy: "calibration", timestamp: 1 },
    { shirtId: "mono-0008", action: "dislike", source: "swipe", matchScore: 40, strategy: "calibration", timestamp: 2 },
  ],
  deck: [],
  selectedSizes: { "mono-0007": "M" },
  lastUpdate: null,
  calibrationAcknowledged: true,
  onboardingSeen: true,
  ...extra,
});

/** Old single-store session → split stores, as the app does on load. */
async function migrateFrom(version: number, state: unknown) {
  storage.setItem(LEGACY, JSON.stringify({ state, version }));
  const m = await fresh();
  m.migrateLegacySession(storage as unknown as Storage);
  await m.useTasteStore.persist.rehydrate();
  await m.useCartStore.persist.rehydrate();
  return { taste: m.useTasteStore.getState(), cart: m.useCartStore.getState() };
}

describe("migration from the old single store (mono-session-v1)", () => {
  it("v2 sessions (old 25-shirt catalog) start fresh", async () => {
    const { taste } = await migrateFrom(2, base(TEN));
    expect(taste.likedIds).toEqual([]);
    expect(taste.swipeHistory).toEqual([]);
    expect(storage.getItem(LEGACY)).toBeNull();
  });

  it("v3: 10-dim taste extended with neutral 0.5, bag lines get their original colour, seen rebuilt", async () => {
    const { taste, cart } = await migrateFrom(3, base(TEN, { cart: [{ id: "mono-0001", size: "M", qty: 2 }], lastOrder: null }));
    expect(Object.keys(taste.preferenceVector).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(taste.preferenceVector.geometric).toBe(0.8);
    expect(taste.preferenceVector.pictorial).toBe(0.5);
    expect(taste.preferenceVector.figurative).toBe(0.5);
    expect(taste.preferenceVector.classic).toBe(0.5);
    expect(taste.seen).toEqual(["mono-0007", "mono-0008"]);
    expect(taste.likedIds).toEqual(["mono-0007"]);
    expect(taste.calibrationAcknowledged).toBe(true);
    expect(cart.cart[0]).toMatchObject({ id: "mono-0001", size: "M", qty: 2 });
    expect(cart.cart[0].color === "black" || cart.cart[0].color === "white").toBe(true);
    expect(cart.selectedSizes["mono-0007"]).toBe("M");
    expect(storage.getItem(LEGACY)).toBeNull();
  });

  it("v4 keeps chosen colours and extends the vector", async () => {
    const { taste, cart } = await migrateFrom(4, base(TEN, { cart: [{ id: "mono-0006", size: "L", qty: 1, color: "white" }], selectedColors: { "mono-0006": "white" }, lastOrder: null }));
    expect(cart.cart[0].color).toBe("white");
    expect(cart.selectedColors["mono-0006"]).toBe("white");
    expect(taste.preferenceVector.nature).toBe(0.5);
    expect(taste.preferenceVector.classic).toBe(0.5);
  });

  it("v5: 14-dim taste kept, figurative + classic added at 0.5 (also in lastUpdate)", async () => {
    const { taste } = await migrateFrom(
      5,
      base(FOURTEEN, { cart: [], selectedColors: {}, lastOrder: null, lastUpdate: { shirtId: "mono-0008", action: "dislike", before: FOURTEEN, after: FOURTEEN } }),
    );
    expect(taste.preferenceVector.pictorial).toBe(0.9);
    expect(taste.preferenceVector.figurative).toBe(0.5);
    expect(taste.preferenceVector.classic).toBe(0.5);
    expect(taste.lastUpdate?.before.classic).toBe(0.5);
    expect(taste.lastUpdate?.after.figurative).toBe(0.5);
    for (const k of FEATURE_KEYS) expect(Number.isFinite(taste.preferenceVector[k])).toBe(true);
  });

  it("v6 (last single-store version) moves across unchanged, order included", async () => {
    const full = { ...FOURTEEN, figurative: 0.7, classic: 0.2 };
    const order = { number: "MONO-ABC123", items: [{ id: "mono-0003", size: "S", color: "black", qty: 1 }], subtotal: 48, shipping: 6, total: 54, name: "A", email: "a@example.com", placedAt: 1 };
    const { taste, cart } = await migrateFrom(6, base(full, { cart: [], selectedColors: {}, lastOrder: order }));
    expect(taste.preferenceVector.figurative).toBe(0.7);
    expect(taste.preferenceVector.classic).toBe(0.2);
    expect(cart.lastOrder?.number).toBe("MONO-ABC123");
    expect(cart.lastOrder?.items).toHaveLength(1);
  });

  it("drops bag lines whose design no longer exists", async () => {
    const { cart } = await migrateFrom(4, base(TEN, { cart: [{ id: "mono-9999", size: "M", qty: 1, color: "black" }], lastOrder: null }));
    expect(cart.cart).toEqual([]);
  });

  it("never overwrites the new stores if they already exist", async () => {
    storage.setItem("mono-taste", JSON.stringify({ state: { likedIds: ["mono-0100"] }, version: 1 }));
    const { taste } = await migrateFrom(6, base(TEN));
    expect(taste.likedIds).toEqual(["mono-0100"]);
    expect(storage.getItem(LEGACY)).toBeNull();
  });
});
