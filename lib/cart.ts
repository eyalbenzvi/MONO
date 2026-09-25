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

export function cartTotals(items: CartItem[]) {
  const lines = cartLines(items);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { lines, count, subtotal, shipping, total: subtotal + shipping };
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
