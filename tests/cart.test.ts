import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_QTY,
  SHIPPING_FEE,
  addItem,
  cartTotals,
  changeItemSize,
  setItemQty,
} from "@/lib/cart";
import { MOCK_SHIRTS } from "@/lib/mockData";
import type { CartItem } from "@/types/shirt";

const [a, b] = MOCK_SHIRTS;

describe("cart", () => {
  it("merges the same shirt+size and keeps sizes separate", () => {
    let items: CartItem[] = [];
    items = addItem(items, { id: a.id, size: "M", qty: 1 });
    items = addItem(items, { id: a.id, size: "M", qty: 2 });
    items = addItem(items, { id: a.id, size: "L", qty: 1 });
    expect(items).toEqual([
      { id: a.id, size: "M", qty: 3 },
      { id: a.id, size: "L", qty: 1 },
    ]);
  });

  it("caps quantity and removes at zero", () => {
    let items = addItem([], { id: a.id, size: "S", qty: 50 });
    expect(items[0].qty).toBe(MAX_QTY);
    items = setItemQty(items, a.id, "S", 0);
    expect(items).toEqual([]);
  });

  it("changing size merges into an existing line", () => {
    const items: CartItem[] = [
      { id: a.id, size: "M", qty: 2 },
      { id: a.id, size: "L", qty: 1 },
    ];
    expect(changeItemSize(items, a.id, "M", "L")).toEqual([{ id: a.id, size: "L", qty: 3 }]);
  });

  it("totals with shipping below the threshold and free shipping above it", () => {
    const one = cartTotals([{ id: a.id, size: "M", qty: 1 }]);
    expect(one.subtotal).toBe(a.price);
    expect(one.shipping).toBe(a.price >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
    expect(one.total).toBe(one.subtotal + one.shipping);

    const many = cartTotals([
      { id: a.id, size: "M", qty: 2 },
      { id: b.id, size: "L", qty: 1 },
    ]);
    expect(many.count).toBe(3);
    expect(many.subtotal).toBe(a.price * 2 + b.price);
    expect(many.shipping).toBe(0);
    expect(cartTotals([]).total).toBe(0);
  });

  it("ignores unknown ids", () => {
    expect(cartTotals([{ id: "nope", size: "M", qty: 1 }]).count).toBe(0);
  });
});
