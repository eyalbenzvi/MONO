import { getShirtById } from "@/lib/mockData";
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

/** Add `qty` of a shirt/size, merging with an existing line and capping at MAX_QTY. */
export function addItem(items: CartItem[], item: CartItem): CartItem[] {
  const existing = items.find((i) => i.id === item.id && i.size === item.size);
  if (!existing) return [...items, { ...item, qty: Math.min(item.qty, MAX_QTY) }];
  return items.map((i) =>
    i === existing ? { ...i, qty: Math.min(i.qty + item.qty, MAX_QTY) } : i,
  );
}

export function setItemQty(items: CartItem[], id: string, size: CartItem["size"], qty: number): CartItem[] {
  if (qty <= 0) return items.filter((i) => !(i.id === id && i.size === size));
  return items.map((i) => (i.id === id && i.size === size ? { ...i, qty: Math.min(qty, MAX_QTY) } : i));
}

/** Change a line's size, merging into an existing line of the new size. */
export function changeItemSize(
  items: CartItem[],
  id: string,
  from: CartItem["size"],
  to: CartItem["size"],
): CartItem[] {
  if (from === to) return items;
  const line = items.find((i) => i.id === id && i.size === from);
  if (!line) return items;
  return addItem(items.filter((i) => i !== line), { id, size: to, qty: line.qty });
}
