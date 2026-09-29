"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_QTY, addItem, cartTotals, changeItem, customKey, pairPrice, pairStatus, sameLine, setItemQty, unitPrice, type LineKey } from "@/lib/cart";
import { validate, type CustomSpec } from "@/lib/custom/spec";
import { getShirtById } from "@/lib/catalog";
import { firstTouch, itemOf, track, trackEcommerce, type AddSource } from "@/lib/analytics";
import { useUiStore, type AddedNote } from "@/store/useUiStore";
import { SIZES, teeColor, type BaseColor, type CartItem, type Customer, type Order, type OrderItem, type OrderRecord, type ShirtSize, type UploadRef } from "@/types/shirt";
import { arrivalRange } from "@/lib/delivery";

export const CART_KEY = "mono-cart";

/** The bag, the last order, and per-design size / colour picks. */
export interface CartState {
  cart: CartItem[];
  /** The last order, without personal details (see OrderRecord). */
  lastOrder: OrderRecord | null;
  selectedSizes: Record<string, ShirtSize>;
  /** Tee colour picked per design; missing = the design's original colour. */
  selectedColors: Record<string, BaseColor>;
  /**
   * The shopper's size, remembered once chosen anywhere: the default for
   * every design (so "Add to bag · M" works in one tap).
   */
  preferredSize: ShirtSize | null;
}

export interface AddOptions {
  /** The caller confirms it itself (e.g. "Add all" says how many): no mini bag. */
  silent?: boolean;
  /** Where the add happened (analytics). */
  source?: AddSource;
  /** A personalised print (only ever from its product page). */
  custom?: CustomSpec;
  /** An uploaded print (only ever from /make/yours/). */
  upload?: UploadRef;
}

interface CartActions {
  setSize: (id: string, size: ShirtSize) => void;
  setColor: (id: string, color: BaseColor) => void;
  /** Adds in the given colour, else the one picked for this design, else its original. */
  addToCart: (id: string, size: ShirtSize, color?: BaseColor, qty?: number, options?: AddOptions) => boolean;
  /** "The pair": one black and one white of the design, in `size`. */
  addPair: (id: string, size: ShirtSize, options?: AddOptions) => boolean;
  setCartQty: (line: LineKey, qty: number) => void;
  /** Take back exactly what one add put in the bag (the mini bag's Undo). */
  undoAdd: (note: Pick<AddedNote, "id" | "size" | "added" | "custom" | "upload">) => void;
  changeCartItem: (line: LineKey, to: Partial<Pick<CartItem, "size" | "color" | "custom">>) => void;
  /** Returns the full order (with the customer, for the confirmation); persists only its record. */
  placeOrder: (customer: Customer) => Order | null;
}

export const initialCart = (): CartState => ({ cart: [], lastOrder: null, selectedSizes: {}, selectedColors: {}, preferredSize: null });

const cartOf = (s: CartState): CartState => ({
  cart: s.cart,
  lastOrder: s.lastOrder,
  selectedSizes: s.selectedSizes,
  selectedColors: s.selectedColors,
  preferredSize: s.preferredSize,
});

/** The size to offer for a design: picked for it, else the remembered one. */
export const sizeFor = (s: Pick<CartState, "selectedSizes" | "preferredSize">, id: string): ShirtSize | undefined =>
  s.selectedSizes[id] ?? s.preferredSize ?? undefined;

const toast = (message: string) => useUiStore.getState().showToast(message);

/* Guard for state read from localStorage: keep only well-formed entries. */
const isColor = (c: unknown): c is BaseColor => c === "black" || c === "white";
const isSize = (s: unknown): s is ShirtSize => (SIZES as readonly unknown[]).includes(s);
const wellFormed = (i: CartItem) => i && getShirtById(i.id) && isSize(i.size) && isColor(i.color) && Number.isInteger(i.qty) && i.qty > 0;
/**
 * Bag lines: well formed, and a personalised one's spec valid (lib/custom
 * validate; the place list isn't loaded here, so its city is checked when the
 * print is drawn). A line whose spec is invalid is dropped, never kept as the
 * original at the original's price.
 */
const lines = (x: unknown): CartItem[] =>
  Array.isArray(x)
    ? (x as CartItem[]).flatMap((i) => {
        if (!wellFormed(i)) return [];
        const line: CartItem = { id: i.id, size: i.size, color: i.color, qty: Math.min(i.qty, MAX_QTY) };
        if (i.upload !== undefined) {
          const upload = uploadRef(i.upload);
          return upload && i.custom === undefined ? [{ ...line, upload }] : [];
        }
        if (i.custom === undefined) return [line];
        const custom = validate(i.custom);
        return custom ? [{ ...line, custom }] : [];
      })
    : [];
const MODES: readonly UploadRef["mode"][] = ["dots", "lines", "line", "vector"];
/** A bag line's upload reference, well formed or null (its raster's presence is checked apart, in IndexedDB). */
export function uploadRef(x: unknown): UploadRef | null {
  const u = x as Partial<UploadRef> | null;
  if (!u || typeof u !== "object") return null;
  if (typeof u.id !== "string" || !/^[a-z0-9]{4,24}$/.test(u.id) || typeof u.hash !== "string" || !/^[0-9a-f]{4,32}$/.test(u.hash)) return null;
  if (!MODES.includes(u.mode as UploadRef["mode"]) || (u.size !== "full" && u.size !== "small")) return null;
  return { id: u.id, mode: u.mode as UploadRef["mode"], size: u.size, hash: u.hash };
}
/** An order's lines: a personalised one keeps only its template, an uploaded one only its mode (never the inputs). */
export const orderItem = (i: CartItem | OrderItem): OrderItem => ({
  id: i.id,
  size: i.size,
  color: i.color,
  qty: i.qty,
  ...(i.custom ? { custom: { t: i.custom.t } } : {}),
  ...(i.upload && MODES.includes(i.upload.mode) ? { upload: { mode: i.upload.mode } } : {}),
});
const orderLines = (x: unknown): OrderItem[] => (Array.isArray(x) ? (x as OrderItem[]).filter(wellFormed as (i: OrderItem) => boolean).map((i) => orderItem({ ...i, qty: Math.min(i.qty, MAX_QTY) })) : []);
/**
 * Bag lines in a colour the design isn't sold in (T3: a design sold in one
 * colour, or a bag from before) move to the colour it is sold in, merged
 * with a line already there (up to MAX_QTY) — never silently dropped.
 */
export function offeredLines(items: CartItem[]): CartItem[] {
  const out: CartItem[] = [];
  for (const i of items) {
    const shirt = getShirtById(i.id);
    const color = shirt ? teeColor(shirt, i.color) : i.color;
    const same = out.find((o) => sameLine(o, { ...i, color }));
    if (same) same.qty = Math.min(MAX_QTY, same.qty + i.qty);
    else out.push({ ...i, color });
  }
  return out;
}

function picks<T>(x: unknown, ok: (v: unknown) => v is T): Record<string, T> {
  const out: Record<string, T> = {};
  if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (getShirtById(k) && ok(v)) out[k] = v;
  return out;
}

export function sanitizeCart(raw: unknown): CartState {
  if (!raw || typeof raw !== "object") return initialCart();
  const r = raw as Partial<Record<keyof CartState, unknown>>;
  const o = r.lastOrder as Partial<OrderRecord> | null | undefined;
  return {
    cart: offeredLines(lines(r.cart)),
    lastOrder: o && typeof o.number === "string" && Array.isArray(o.items) ? orderRecord(o as OrderRecord) : null,
    selectedSizes: picks(r.selectedSizes, isSize),
    // Only colours the design is sold in (T3).
    selectedColors: Object.fromEntries(Object.entries(picks(r.selectedColors, isColor)).filter(([id, c]) => getShirtById(id)!.colors.includes(c))),
    preferredSize: isSize(r.preferredSize) ? r.preferredSize : null,
  };
}

/** Only the non-personal fields of an order (whitelist: anything else is dropped). */
function orderRecord(o: OrderRecord): OrderRecord {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    number: o.number,
    items: orderLines(o.items),
    subtotal: num(o.subtotal),
    ...(o.discount ? { discount: num(o.discount) } : {}),
    shipping: num(o.shipping),
    total: num(o.total),
    placedAt: num(o.placedAt),
  };
}

/**
 * v1 → v2 adds `preferredSize`: seeded from the newest bag line, else the
 * most recent size picked for any design, else unset.
 */
export function migrateCart(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== "object") return persisted;
  const s = { ...(persisted as Record<string, unknown>) };
  if (version < 2) {
    const cart = Array.isArray(s.cart) ? (s.cart as { size?: unknown }[]) : [];
    const picked = s.selectedSizes && typeof s.selectedSizes === "object" ? Object.values(s.selectedSizes as object) : [];
    const candidates = [...cart.map((l) => l?.size).reverse(), ...picked.reverse()];
    s.preferredSize = candidates.find(isSize) ?? null;
  }
  // v2 → v3: the last order no longer keeps the customer's name / email.
  if (version < 3 && s.lastOrder && typeof s.lastOrder === "object") {
    const { name: _name, email: _email, ...rest } = s.lastOrder as Record<string, unknown>;
    s.lastOrder = rest;
  }
  // v3 → v4 (T3): some designs are sold in one colour only — bag lines and
  // remembered picks in the other colour move to (or fall back on) the original.
  if (version < 4) {
    if (Array.isArray(s.cart)) s.cart = offeredLines(lines(s.cart));
    if (s.selectedColors && typeof s.selectedColors === "object")
      s.selectedColors = Object.fromEntries(Object.entries(s.selectedColors as Record<string, unknown>).filter(([id, c]) => isColor(c) && getShirtById(id)?.colors.includes(c)));
  }
  // v4 → v5: personalised prints. Bag lines stay as they are (none were
  // personalised); the last order keeps only a line's template, never its inputs.
  if (version < 5 && s.lastOrder && typeof s.lastOrder === "object") {
    const o = s.lastOrder as Record<string, unknown>;
    s.lastOrder = { ...o, items: orderLines(o.items) };
  }
  // v5 → v6: uploaded prints (a line's `upload`). Nothing to move: no line had one.
  return s;
}

/** A line's print, checked: null when one was given but isn't valid (nothing is added). */
function resolvePrint(options: { custom?: unknown; upload?: unknown }): { custom?: CustomSpec; upload?: UploadRef } | null {
  const custom = options.custom ? validate(options.custom) ?? undefined : undefined;
  if (options.custom && !custom) return null;
  const upload = options.upload ? uploadRef(options.upload) ?? undefined : undefined;
  if (options.upload && !upload) return null;
  return { custom, upload };
}

/** Only the print fields a line has (no `custom: undefined` keys). */
const printFields = (custom?: CustomSpec, upload?: UploadRef) => ({ ...(custom ? { custom } : {}), ...(upload ? { upload } : {}) });

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      ...initialCart(),

      setSize: (id, size) => {
        set((s) => ({ selectedSizes: { ...s.selectedSizes, [id]: size }, preferredSize: size }));
        track("select_size", { id, size });
      },

      setColor: (id, color) => {
        // A colour the design isn't sold in is never remembered (T3).
        const shirt = getShirtById(id);
        if (shirt && shirt.colors.includes(color)) set((s) => ({ selectedColors: { ...s.selectedColors, [id]: color } }));
      },

      addToCart: (id, size, color, qty = 1, options = {}) => {
        const shirt = getShirtById(id);
        if (!shirt) return false;
        const tee = teeColor(shirt, color ?? get().selectedColors[id]);
        const print = resolvePrint(options);
        if (!print) return false;
        const { custom, upload } = print;
        const { items, capped } = addItem(get().cart, { id, size, color: tee, qty, ...printFields(custom, upload) });
        set((s) => ({
          cart: items,
          selectedSizes: { ...s.selectedSizes, [id]: size },
          selectedColors: { ...s.selectedColors, [id]: tee },
          preferredSize: size,
        }));
        if (capped) toast(`Max ${MAX_QTY} per item`);
        else {
          // One confirmation everywhere: the mini bag (with Undo).
          if (!options.silent) useUiStore.getState().noteAdded({ id, size, color: tee, added: Array(qty).fill(tee), ...printFields(custom, upload) });
          trackEcommerce("add_to_cart", { items: [itemOf(shirt, { color: tee, size, quantity: qty, custom, upload })], source: options.source ?? "product" });
        }
        return !capped;
      },

      addPair: (id, size, options = {}) => {
        const shirt = getShirtById(id);
        // The pair needs both colours (T3: some designs come in one).
        if (!shirt || shirt.colors.length < 2) return false;
        // Only what's missing: with one colour already in the bag, this
        // completes the pair; with both, there's nothing to add.
        const print = resolvePrint(options);
        if (!print) return false;
        const { custom, upload } = print;
        const status = pairStatus(get().cart, id, size, custom, upload);
        if (status.capped) {
          toast(`Max ${MAX_QTY} per item — the pair wasn't added`);
          return false;
        }
        if (status.missing.length === 0) return false;
        let items = get().cart;
        for (const color of status.missing) items = addItem(items, { id, size, color, qty: 1, ...printFields(custom, upload) }).items;
        set((s) => ({ cart: items, selectedSizes: { ...s.selectedSizes, [id]: size }, preferredSize: size }));
        if (!options.silent) useUiStore.getState().noteAdded({ id, size, color: status.missing.length === 1 ? status.missing[0] : shirt.baseColor, added: status.missing, pair: true, ...printFields(custom, upload) });
        // The pair is worth its pair price, not two full prices: its saving is
        // the items' discount (all of it on the tee that completes a pair).
        const saving = 2 * unitPrice({ custom, upload }, shirt) - pairPrice(custom, upload);
        const discount = saving / status.missing.length;
        trackEcommerce("add_to_cart", { items: status.missing.map((color) => itemOf(shirt, { color, size, discount, custom, upload })), source: options.source ?? "product", pair: true });
        return true;
      },

      setCartQty: (line, qty) => {
        const before = get().cart.find((i) => sameLine(i, line))?.qty ?? 0;
        set((s) => ({ cart: setItemQty(s.cart, line, qty) }));
        const removed = before - Math.max(0, Math.min(qty, MAX_QTY));
        const shirt = getShirtById(line.id);
        if (removed > 0 && shirt) trackEcommerce("remove_from_cart", { items: [itemOf(shirt, { color: line.color, size: line.size, quantity: removed, custom: line.custom, upload: line.upload })] });
      },

      undoAdd: ({ id, size, added, custom, upload }) => {
        let items = get().cart;
        const shirt = getShirtById(id);
        const removed: BaseColor[] = [];
        for (const color of added) {
          const line = items.find((i) => sameLine(i, { id, size, color, custom, upload }));
          if (line) {
            items = setItemQty(items, line, line.qty - 1);
            removed.push(color);
          }
        }
        set({ cart: items });
        if (shirt && removed.length) trackEcommerce("remove_from_cart", { items: removed.map((color) => itemOf(shirt, { color, size, custom, upload })), source: "minibag" });
      },

      changeCartItem: (line, to) => {
        if (to.color && !getShirtById(line.id)?.colors.includes(to.color)) return;
        const { items, capped } = changeItem(get().cart, line, to);
        if (capped) toast(`Max ${MAX_QTY} per item`);
        else set({ cart: items });
      },

      placeOrder: (customer) => {
        const { cart } = get();
        const totals = cartTotals(cart);
        if (totals.count === 0) return null;
        const now = Date.now();
        const record: OrderRecord = {
          number: `MONO-${now.toString(36).toUpperCase().slice(-6)}`,
          // A personalised line is stored as its template only: the place, date or year stay in the confirmation on screen.
          items: cart.map(orderItem),
          subtotal: totals.subtotal,
          ...(totals.discount ? { discount: totals.discount } : {}),
          shipping: totals.shipping,
          total: totals.total,
          placedAt: now,
        };
        const { from, to } = arrivalRange(new Date(now), cart.some((l) => l.upload));
        const order: Order = { ...record, items: cart, customer, arrives: { from: from.getTime(), to: to.getTime() } };
        // Persist the record only: no name, email or address on the device.
        set({ lastOrder: record, cart: [] });
        // Uploaded prints go to the (simulated) review; their working copies leave the device.
        const uploads = [...new Set(cart.flatMap((l) => (l.upload ? [l.upload.id] : [])))];
        if (uploads.length) {
          void import("@/store/makeStore").then((m) => m.useMakeStore.getState().submitReviews(record.number, uploads));
          void import("@/lib/upload/store").then((m) => (m.available() ? Promise.all(uploads.map(m.dropSource)) : undefined)).catch(() => {});
        }
        // Per print: a design, and a personalised one's spec (its pairs are its own).
        const printOf = (l: { id: string; custom?: CustomSpec; upload?: UploadRef }) => `${l.id}|${customKey(l.custom, l.upload)}`;
        const saving = new Map(totals.pairs.map((p) => [`${p.id}|${p.key ?? ""}`, p.saving]));
        const units = new Map<string, number>();
        for (const l of totals.lines) units.set(printOf(l), (units.get(printOf(l)) ?? 0) + l.qty);
        trackEcommerce("purchase", {
          transaction_id: order.number,
          value: order.total,
          shipping: order.shipping,
          discount: order.discount ?? 0,
          // A design's pair saving, spread over its units (items add up to the value).
          items: totals.lines.map((l) => itemOf(l.shirt, { color: l.color, size: l.size, quantity: l.qty, custom: l.custom, upload: l.upload, discount: saving.has(printOf(l)) ? saving.get(printOf(l))! / units.get(printOf(l))! : undefined })),
          first_touch: firstTouch(),
        });
        return order;
      },
    }),
    {
      name: CART_KEY,
      version: 6,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateCart,
      skipHydration: true,
      partialize: (s): CartState => cartOf(s),
      merge: (persisted, current) => ({ ...current, ...sanitizeCart(persisted) }),
    },
  ),
);

export const useCartCount = () => useCartStore((s) => s.cart.reduce((sum, i) => sum + i.qty, 0));
