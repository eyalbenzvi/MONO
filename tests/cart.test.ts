import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_QTY,
  SHIPPING_FEE,
  addItem,
  cartTotals,
  changeItem,
  setItemQty,
} from "@/lib/cart";
import { SHIRTS } from "@/lib/catalog";
import { otherColor, skuFor, type CartItem } from "@/types/shirt";

const [a, b] = SHIRTS;

describe("cart", () => {
  it("merges the same shirt+size+colour and keeps other combinations separate", () => {
    let items: CartItem[] = [];
    items = addItem(items, { id: a.id, size: "M", color: "black", qty: 1 }).items;
    items = addItem(items, { id: a.id, size: "M", color: "black", qty: 2 }).items;
    items = addItem(items, { id: a.id, size: "L", color: "black", qty: 1 }).items;
    items = addItem(items, { id: a.id, size: "M", color: "white", qty: 1 }).items;
    expect(items).toEqual([
      { id: a.id, size: "M", color: "black", qty: 3 },
      { id: a.id, size: "L", color: "black", qty: 1 },
      { id: a.id, size: "M", color: "white", qty: 1 },
    ]);
  });

  it("caps quantity and removes at zero", () => {
    const added = addItem([], { id: a.id, size: "S", color: "white", qty: 50 });
    expect(added.capped).toBe(true);
    let items = added.items;
    expect(items[0].qty).toBe(MAX_QTY);
    items = setItemQty(items, { id: a.id, size: "S", color: "white" }, 0);
    expect(items).toEqual([]);
  });

  it("switching colour edits the line in place", () => {
    const items: CartItem[] = [
      { id: a.id, size: "M", color: "black", qty: 2 },
      { id: b.id, size: "L", color: "white", qty: 1 },
    ];
    expect(changeItem(items, items[0], { color: "white" }).items).toEqual([
      { id: a.id, size: "M", color: "white", qty: 2 },
      { id: b.id, size: "L", color: "white", qty: 1 },
    ]);
  });

  it("changing size or colour merges into an existing matching line", () => {
    const items: CartItem[] = [
      { id: a.id, size: "M", color: "black", qty: 2 },
      { id: a.id, size: "M", color: "white", qty: 1 },
      { id: a.id, size: "L", color: "white", qty: 4 },
    ];
    expect(changeItem(items, items[0], { color: "white" }).items).toEqual([
      { id: a.id, size: "M", color: "white", qty: 3 },
      { id: a.id, size: "L", color: "white", qty: 4 },
    ]);
    expect(changeItem(items, items[1], { size: "L" }).items).toEqual([
      { id: a.id, size: "M", color: "black", qty: 2 },
      { id: a.id, size: "L", color: "white", qty: 5 },
    ]);
  });

  it("reports hitting the per-line limit instead of losing units silently", () => {
    const eight = addItem([], { id: a.id, size: "M", color: "black", qty: 8 });
    expect(eight.capped).toBe(false);
    const more = addItem(eight.items, { id: a.id, size: "M", color: "black", qty: 3 });
    expect(more.capped).toBe(true);
    expect(more.items[0].qty).toBe(MAX_QTY);
    // merging two lines past the limit is refused and nothing changes
    const items: CartItem[] = [
      { id: a.id, size: "M", color: "black", qty: 6 },
      { id: a.id, size: "L", color: "black", qty: 5 },
    ];
    const merged = changeItem(items, items[0], { size: "L" });
    expect(merged.capped).toBe(true);
    expect(merged.items).toEqual(items);
  });

  it("both colourways cost the same", () => {
    const black = cartTotals([{ id: a.id, size: "M", color: "black", qty: 1 }]);
    const white = cartTotals([{ id: a.id, size: "M", color: "white", qty: 1 }]);
    expect(black.subtotal).toBe(white.subtotal);
  });

  it("totals with shipping below the threshold and free shipping above it", () => {
    const one = cartTotals([{ id: a.id, size: "M", color: a.baseColor, qty: 1 }]);
    expect(one.subtotal).toBe(a.price);
    expect(one.shipping).toBe(a.price >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
    expect(one.total).toBe(one.subtotal + one.shipping);

    const many = cartTotals([
      { id: a.id, size: "M", color: "black", qty: 2 },
      { id: b.id, size: "L", color: "white", qty: 1 },
    ]);
    expect(many.count).toBe(3);
    expect(many.subtotal).toBe(a.price * 2 + b.price);
    expect(many.shipping).toBe(0);
    expect(cartTotals([]).total).toBe(0);
  });

  it("ignores unknown ids", () => {
    expect(cartTotals([{ id: "nope", size: "M", color: "black", qty: 1 }]).count).toBe(0);
  });
});

describe("colourways", () => {
  it("skuFor swaps only the colour letter", () => {
    expect(skuFor("MN-GEO-B-0001", "white")).toBe("MN-GEO-W-0001");
    expect(skuFor("MN-GEO-W-0001", "black")).toBe("MN-GEO-B-0001");
    expect(skuFor("MN-GEO-B-0001", "black")).toBe("MN-GEO-B-0001");
    for (const s of SHIRTS.slice(0, 50)) expect(skuFor(s.sku, otherColor(s.baseColor))).not.toBe(s.sku);
  });
});
