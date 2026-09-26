"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_QTY, PAIR_PRICE, addItem, cartTotals, changeItem, pairStatus, setItemQty } from "@/lib/cart";
import { getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { useUiStore } from "@/store/useUiStore";
import { SIZES, type BaseColor, type CartItem, type Customer, type Order, type OrderRecord, type ShirtSize } from "@/types/shirt";
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
  /** The caller shows its own confirmation (the product page's mini bag); no toast. */
  quiet?: boolean;
}

interface CartActions {
  setSize: (id: string, size: ShirtSize) => void;
  setColor: (id: string, color: BaseColor) => void;
  /** Adds in the given colour, else the one picked for this design, else its original. */
  addToCart: (id: string, size: ShirtSize, color?: BaseColor, qty?: number, options?: AddOptions) => boolean;
  /** "The pair": one black and one white of the design, in `size`. */
  addPair: (id: string, size: ShirtSize, options?: AddOptions) => boolean;
  setCartQty: (line: Pick<CartItem, "id" | "size" | "color">, qty: number) => void;
  changeCartItem: (line: Pick<CartItem, "id" | "size" | "color">, to: Partial<Pick<CartItem, "size" | "color">>) => void;
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
const lines = (x: unknown): CartItem[] =>
  Array.isArray(x)
    ? (x as CartItem[]).filter((i) => i && getShirtById(i.id) && isSize(i.size) && isColor(i.color) && Number.isInteger(i.qty) && i.qty > 0).map((i) => ({ id: i.id, size: i.size, color: i.color, qty: Math.min(i.qty, MAX_QTY) }))
    : [];
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
    cart: lines(r.cart),
    lastOrder: o && typeof o.number === "string" && Array.isArray(o.items) ? orderRecord(o as OrderRecord) : null,
    selectedSizes: picks(r.selectedSizes, isSize),
    selectedColors: picks(r.selectedColors, isColor),
    preferredSize: isSize(r.preferredSize) ? r.preferredSize : null,
  };
}

/** Only the non-personal fields of an order (whitelist: anything else is dropped). */
function orderRecord(o: OrderRecord): OrderRecord {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    number: o.number,
    items: lines(o.items),
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
  return s;
}

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      ...initialCart(),

      setSize: (id, size) => {
        set((s) => ({ selectedSizes: { ...s.selectedSizes, [id]: size }, preferredSize: size }));
        track("select_size", { id, size });
      },

      setColor: (id, color) => set((s) => ({ selectedColors: { ...s.selectedColors, [id]: color } })),

      addToCart: (id, size, color, qty = 1, options = {}) => {
        const shirt = getShirtById(id);
        if (!shirt) return false;
        const tee = color ?? get().selectedColors[id] ?? shirt.baseColor;
        const { items, capped } = addItem(get().cart, { id, size, color: tee, qty });
        set((s) => ({
          cart: items,
          selectedSizes: { ...s.selectedSizes, [id]: size },
          selectedColors: { ...s.selectedColors, [id]: tee },
          preferredSize: size,
        }));
        if (capped) toast(`Max ${MAX_QTY} per item`);
        else {
          if (!options.quiet) toast(`Added · ${size}`);
          useUiStore.getState().noteAdded({ id, size, color: tee });
          track("add_to_cart", { id, size, color: tee, qty, price: shirt.price });
        }
        return !capped;
      },

      addPair: (id, size, options = {}) => {
        const shirt = getShirtById(id);
        if (!shirt) return false;
        // Only what's missing: with one colour already in the bag, this
        // completes the pair; with both, there's nothing to add.
        const status = pairStatus(get().cart, id, size);
        if (status.capped) {
          toast(`Max ${MAX_QTY} per item — the pair wasn't added`);
          return false;
        }
        if (status.missing.length === 0) return false;
        let items = get().cart;
        for (const color of status.missing) items = addItem(items, { id, size, color, qty: 1 }).items;
        set((s) => ({ cart: items, selectedSizes: { ...s.selectedSizes, [id]: size }, preferredSize: size }));
        const completes = status.have.length > 0;
        if (!options.quiet) toast(completes ? `Completed the pair · ${size}` : `Added the pair · ${size}`);
        useUiStore.getState().noteAdded({ id, size, color: status.missing.length === 1 ? status.missing[0] : shirt.baseColor, pair: true });
        track("add_to_cart", { id, size, color: completes ? status.missing[0] : "pair", qty: status.missing.length, price: completes ? PAIR_PRICE - shirt.price : PAIR_PRICE });
        return true;
      },

      setCartQty: (line, qty) => set((s) => ({ cart: setItemQty(s.cart, line, qty) })),

      changeCartItem: (line, to) => {
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
          items: cart,
          subtotal: totals.subtotal,
          ...(totals.discount ? { discount: totals.discount } : {}),
          shipping: totals.shipping,
          total: totals.total,
          placedAt: now,
        };
        const { from, to } = arrivalRange(new Date(now));
        const order: Order = { ...record, customer, arrives: { from: from.getTime(), to: to.getTime() } };
        // Persist the record only: no name, email or address on the device.
        set({ lastOrder: record, cart: [] });
        track("purchase", { order: order.number, value: order.total, items: totals.count, currency: "USD" });
        return order;
      },
    }),
    {
      name: CART_KEY,
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateCart,
      skipHydration: true,
      partialize: (s): CartState => cartOf(s),
      merge: (persisted, current) => ({ ...current, ...sanitizeCart(persisted) }),
    },
  ),
);

export const useCartCount = () => useCartStore((s) => s.cart.reduce((sum, i) => sum + i.qty, 0));
