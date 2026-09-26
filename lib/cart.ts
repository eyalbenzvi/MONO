import { getShirtById } from "@/lib/catalog";
import type { CartItem, ShirtProduct } from "@/types/shirt";

export const FREE_SHIPPING_THRESHOLD = 80;
export const SHIPPING_FEE = 6;
export const MAX_QTY = 9;

export interface CartLine extends CartItem {
  shirt: ShirtProduct;
  lineTotal: number;
}

export function cartLines(items: CartItem[]): CartLine[] {
  return items.flatMap((item) => {
    const shirt = getShirtById(item.id);
    return shirt ? [{ ...item, shirt, lineTotal: shirt.price * item.qty }] : [];
  });
}

/**
 * "The pair": the same print in black and in white for PAIR_PRICE. Priced
 * as a bundle discount in the bag, so it applies however the two got there
 * (the one-tap button or two separate adds), in any sizes.
 */
export const PAIR_PRICE = 90;

/** Complete pairs in the bag: per design, the smaller of its black and white quantities. */
export function countPairs(lines: CartLine[]): { id: string; pairs: number; saving: number }[] {
  const byId = new Map<string, { black: number; white: number; price: number }>();
  for (const l of lines) {
    const e = byId.get(l.id) ?? { black: 0, white: 0, price: l.shirt.price };
    e[l.color] += l.qty;
    byId.set(l.id, e);
  }
  const out: { id: string; pairs: number; saving: number }[] = [];
  for (const [id, e] of byId) {
    const pairs = Math.min(e.black, e.white);
    const saving = Math.max(0, 2 * e.price - PAIR_PRICE) * pairs;
    if (pairs > 0 && saving > 0) out.push({ id, pairs, saving });
  }
  return out;
}

export function cartTotals(items: CartItem[]) {
  const lines = cartLines(items);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const pairs = countPairs(lines);
  const discount = pairs.reduce((sum, p) => sum + p.saving, 0);
  const goods = subtotal - discount;
  const shipping = goods <= 0 || goods >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { lines, count, subtotal, pairs, discount, shipping, total: goods + shipping, toFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - goods) };
}

type LineKey = Pick<CartItem, "id" | "size" | "color">;
const same = (a: LineKey, b: LineKey) => a.id === b.id && a.size === b.size && a.color === b.color;

/** Result of a bag edit; `capped` = the MAX_QTY limit stopped (part of) it. */
export interface CartResult {
  items: CartItem[];
  capped: boolean;
}

/** Add `qty` of a shirt/size/colour, merging with an existing line and capping at MAX_QTY. */
export function addItem(items: CartItem[], item: CartItem): CartResult {
  const existing = items.find((i) => same(i, item));
  const have = existing?.qty ?? 0;
  const qty = Math.min(have + item.qty, MAX_QTY);
  const capped = have + item.qty > MAX_QTY;
  if (!existing) return { items: [...items, { ...item, qty }], capped };
  return { items: items.map((i) => (i === existing ? { ...i, qty } : i)), capped };
}

export function setItemQty(items: CartItem[], key: LineKey, qty: number): CartItem[] {
  if (qty <= 0) return items.filter((i) => !same(i, key));
  return items.map((i) => (same(i, key) ? { ...i, qty: Math.min(qty, MAX_QTY) } : i));
}

/**
 * Change a line's size and/or colour, merging into an existing line that
 * already has the new combination.
 */
export function changeItem(items: CartItem[], key: LineKey, to: Partial<Pick<CartItem, "size" | "color">>): CartResult {
  const line = items.find((i) => same(i, key));
  if (!line) return { items, capped: false };
  const next = { ...line, ...to };
  if (same(next, line)) return { items, capped: false };
  const target = items.find((i) => same(i, next));
  if (target) {
    // Merging would go over the limit: refuse rather than silently drop units.
    if (target.qty + line.qty > MAX_QTY) return { items, capped: true };
    // Merge into the line that already has this size/colour.
    return {
      items: items.filter((i) => i !== line).map((i) => (i === target ? { ...i, qty: i.qty + line.qty } : i)),
      capped: false,
    };
  }
  // Otherwise edit in place so the line keeps its position in the bag.
  return { items: items.map((i) => (i === line ? next : i)), capped: false };
}
