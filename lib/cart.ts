import { MAKE_PAIR_PRICE, MAKE_PRICE, PAIR_PRICE } from "@/lib/prices";
import { getShirtById } from "@/lib/catalog";
import { specHash, type CustomSpec } from "@/lib/custom/spec";
import { formatPrice } from "@/lib/format";
import { COLORS, SIZE_LABELS, type BaseColor, type CartItem, type ShirtProduct, type ShirtSize, type UploadRef } from "@/types/shirt";

/** Shipping is free from this many tees in the bag (a pair counts as two). */
export const FREE_SHIPPING_TEES = 2;
export const SHIPPING_FEE = 10;
export const MAX_QTY = 9;

export interface CartLine extends CartItem {
  shirt: ShirtProduct;
  lineTotal: number;
}

/** A tee's price: the design's, or the made-for-you price when it's personalised (MAKE_PRICE). Every price of a line comes from here. */
export const unitPrice = (line: { custom?: unknown; upload?: unknown }, shirt: Pick<ShirtProduct, "price">) => (line.custom || line.upload ? MAKE_PRICE : shirt.price);

/**
 * A personalised or uploaded print's key part ("" for the original): same
 * design, size, colour and spec (or upload hash) = one line.
 */
export const customKey = (custom?: CustomSpec, upload?: UploadRef) => (upload ? `u${upload.hash}` : custom ? specHash(custom) : "");
const keyOf = (l: { custom?: CustomSpec; upload?: UploadRef }) => customKey(l.custom, l.upload);
/** A bag line's key: design, size, colour and a personalised print's spec (React keys, and "Edit" from the bag naming its line). */
export const lineKey = (l: { id: string; size: string; color: string; custom?: CustomSpec; upload?: UploadRef }) => `${l.id}-${l.size}-${l.color}-${keyOf(l)}`;

export function cartLines(items: CartItem[]): CartLine[] {
  return items.flatMap((item) => {
    const shirt = getShirtById(item.id);
    return shirt ? [{ ...item, shirt, lineTotal: unitPrice(item, shirt) * item.qty }] : [];
  });
}

/**
 * "The pair": the same print in black and in white for PAIR_PRICE. Priced
 * as a bundle discount in the bag, so it applies however the two got there
 * (the one-tap button or two separate adds), in any sizes.
 */
export { PAIR_PRICE };
/** The pair of one print: PAIR_PRICE, or MAKE_PAIR_PRICE when it's personalised. */
export const pairPrice = (custom?: CustomSpec, upload?: UploadRef) => (custom || upload ? MAKE_PAIR_PRICE : PAIR_PRICE);

/** What the bag already holds of "the pair" for one design in one size. */
export interface PairStatus {
  /** Tee colours of this design + size already in the bag. */
  have: BaseColor[];
  /** The colours "Get it in both" would add. */
  missing: BaseColor[];
  /** A colour of this design + size is at MAX_QTY: the pair can't be added. */
  capped: boolean;
}

/** The pair is one print in both colours: the same design and, personalised, the same spec. */
export function pairStatus(items: CartItem[], id: string, size: ShirtSize, custom?: CustomSpec, upload?: UploadRef): PairStatus {
  const key = customKey(custom, upload);
  const line = (c: BaseColor) => items.find((i) => i.id === id && i.size === size && i.color === c && keyOf(i) === key);
  const have = COLORS.filter((c) => line(c));
  return { have, missing: COLORS.filter((c) => !line(c)), capped: COLORS.some((c) => (line(c)?.qty ?? 0) >= MAX_QTY) };
}

/**
 * The one buy-button pattern, everywhere (product page, Buy sheet, Make,
 * bag): "[verb] · [size] · [price]", the price always in it, the size once
 * chosen. The pair: "Add the pair · M · $90"; one colour already in the bag,
 * "Complete the pair · +$40"; both there, "In your bag · Checkout".
 */
export function ctaLabel({
  verb = "Add to bag",
  size,
  price,
  both = false,
  pair = PAIR_PRICE,
  status,
}: {
  verb?: string;
  size?: ShirtSize;
  /** One tee's price. */
  price: number;
  both?: boolean;
  /** The pair's price. */
  pair?: number;
  /** What of the pair (this size) is already in the bag. */
  status?: PairStatus | null;
}): string {
  if (both && status?.missing.length === 0) return "In your bag · Checkout";
  if (both && status && status.have.length > 0) return `Complete the pair · +${formatPrice(pair - price * status.have.length)}`;
  const words = both && verb === "Add to bag" ? "Add the pair" : verb;
  return [words, size && SIZE_LABELS[size], formatPrice(both ? pair : price)].filter(Boolean).join(" · ");
}

/**
 * Complete pairs in the bag: per print (a design, and a personalised one's
 * spec), the smaller of its black and white quantities.
 */
export function countPairs(lines: CartLine[]): { id: string; key?: string; pairs: number; saving: number }[] {
  const byPrint = new Map<string, { id: string; key: string; black: number; white: number; price: number; pair: number }>();
  for (const l of lines) {
    const key = keyOf(l);
    const k = `${l.id}|${key}`;
    const e = byPrint.get(k) ?? { id: l.id, key, black: 0, white: 0, price: unitPrice(l, l.shirt), pair: pairPrice(l.custom, l.upload) };
    e[l.color] += l.qty;
    byPrint.set(k, e);
  }
  const out: { id: string; key?: string; pairs: number; saving: number }[] = [];
  for (const e of byPrint.values()) {
    const pairs = Math.min(e.black, e.white);
    const saving = Math.max(0, 2 * e.price - e.pair) * pairs;
    // `key` names a personalised print's pair (the original's has none).
    if (pairs > 0 && saving > 0) out.push({ id: e.id, ...(e.key ? { key: e.key } : {}), pairs, saving });
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
  const shipping = goods <= 0 || count >= FREE_SHIPPING_TEES ? 0 : SHIPPING_FEE;
  return { lines, count, subtotal, pairs, discount, shipping, total: goods + shipping, toFreeShipping: Math.max(0, FREE_SHIPPING_TEES - count) };
}

/** What names a bag line: the design, size and colour, and a personalised print's spec. */
export type LineKey = Pick<CartItem, "id" | "size" | "color" | "custom" | "upload">;
export const sameLine = (a: LineKey, b: LineKey) => a.id === b.id && a.size === b.size && a.color === b.color && keyOf(a) === keyOf(b);
const same = sameLine;

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

/**
 * An uploaded print's lines after an edit ("Edit" from the bag, "Save
 * changes"): the new print in every line the old one was in, each keeping
 * its size and quantity; a single line takes the size chosen. The tees chosen
 * decide the colours. With one tee chosen, a line in the other colour moves
 * to it (or goes, when its partner in that size is already there: the pair
 * becomes the one tee asked for). With both chosen, each size gets the colour
 * it's missing. Lines that end up the same are merged (up to MAX_QTY). Lines
 * gone meanwhile (removed from the bag in between): the print is added anew.
 */
export function editUpload(items: CartItem[], id: string, oldUpload: string, upload: UploadRef, tees: BaseColor[], size: ShirtSize): CartItem[] {
  const mine = items.filter((i) => i.id === id && i.upload?.id === oldUpload);
  const others = items.filter((i) => !mine.includes(i));
  const want = tees.length ? tees : ["white" as BaseColor];
  let lines: CartItem[] = mine.length ? mine.map((l) => ({ ...l, upload, size: mine.length === 1 ? size : l.size })) : [{ id, size, color: want[0], qty: 1, upload }];
  if (want.length === 1) {
    const [only] = want;
    lines = lines.filter((l) => l.color === only || !lines.some((o) => o.color === only && o.size === l.size)).map((l) => ({ ...l, color: only }));
  } else for (const s of [...new Set(lines.map((l) => l.size))]) for (const c of want) if (!lines.some((l) => l.size === s && l.color === c)) lines.push({ id, size: s, color: c, qty: 1, upload });
  const merged: CartItem[] = [];
  for (const l of lines) {
    const same = merged.find((m) => m.size === l.size && m.color === l.color);
    if (same) same.qty = Math.min(MAX_QTY, same.qty + l.qty);
    else merged.push({ ...l });
  }
  // In the bag where the first of them was (the rest after it).
  const at = mine.length ? items.indexOf(mine[0]) - items.slice(0, items.indexOf(mine[0])).filter((i) => mine.includes(i)).length : others.length;
  return [...others.slice(0, at), ...merged, ...others.slice(at)];
}
