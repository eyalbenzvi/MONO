import { describe, expect, it } from "vitest";
import { PRICE } from "../scripts/gen/constants";
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_QTY,
  PAIR_PRICE,
  SHIPPING_FEE,
  addItem,
  cartTotals,
  changeItem,
  editUpload,
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

  it("the pair (same print, black + white) costs $90 as a bundle discount (F5)", () => {
    expect(PAIR_PRICE).toBe(90);
    const pair = cartTotals([
      { id: a.id, size: "M", color: "black", qty: 1 },
      { id: a.id, size: "L", color: "white", qty: 1 },
    ]);
    expect(pair.subtotal).toBe(2 * PRICE);
    expect(pair.discount).toBe(2 * PRICE - PAIR_PRICE);
    expect(pair.pairs).toEqual([{ id: a.id, pairs: 1, saving: 2 * PRICE - PAIR_PRICE }]);
    expect(pair.shipping).toBe(0);
    expect(pair.total).toBe(90);
    // two black + one white of the same print = one pair; other prints don't pair up
    const mixed = cartTotals([
      { id: a.id, size: "M", color: "black", qty: 2 },
      { id: a.id, size: "M", color: "white", qty: 1 },
      { id: b.id, size: "M", color: "white", qty: 1 },
    ]);
    expect(mixed.discount).toBe(2 * PRICE - PAIR_PRICE);
    expect(mixed.total).toBe(PRICE * 4 - (2 * PRICE - PAIR_PRICE));
    // two full pairs
    expect(cartTotals([{ id: a.id, size: "S", color: "black", qty: 2 }, { id: a.id, size: "XL", color: "white", qty: 2 }]).discount).toBe(2 * (2 * PRICE - PAIR_PRICE));
    // one colour only: no discount
    expect(cartTotals([{ id: a.id, size: "M", color: "black", qty: 3 }]).discount).toBe(0);
  });

  it("free shipping progress counts the discounted goods", () => {
    const one = cartTotals([{ id: a.id, size: "M", color: "black", qty: 1 }]);
    expect(one.toFreeShipping).toBe(FREE_SHIPPING_THRESHOLD - PRICE);
    expect(cartTotals([]).toFreeShipping).toBe(FREE_SHIPPING_THRESHOLD);
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

describe("the price list: tee, pair, made-for-you tee and its pair", () => {
  it("a tee $50 and its pair $90; a made-for-you tee $75 and its pair $130, counted per print in the bag", async () => {
    const { unitPrice, pairPrice, cartTotals } = await import("@/lib/cart");
    const { MADE } = await import("@/lib/custom/products");
    const spec = { t: "night" as const, v: 1 as const, p: { d: "2021-11-19" } };
    expect(PRICE).toBe(50);
    expect(PAIR_PRICE).toBe(90);
    expect(unitPrice({}, { price: PRICE })).toBe(50);
    expect(unitPrice({ custom: spec }, { price: PRICE })).toBe(75);
    expect(pairPrice()).toBe(90);
    expect(pairPrice(spec)).toBe(130);
    const id = MADE.find((m) => m.template === "night")!.id;
    const both = cartTotals([
      { id, size: "M", color: "black", qty: 1, custom: spec },
      { id, size: "L", color: "white", qty: 1, custom: spec },
    ]);
    expect(both.subtotal).toBe(150);
    expect(both.discount).toBe(20);
    expect(both.total).toBe(130);
  });
});

describe("editUpload: an uploaded print's lines after Edit → Save changes", () => {
  const Y = "make-yours";
  const old = { id: "old", mode: "dots", size: "full", hash: "aaaa" } as const;
  const neu = { id: "new", mode: "lines", size: "full", hash: "bbbb" } as const;
  const other = { id: "mono-1", size: "M", color: "black", qty: 1 } as const;
  const line = (color: "black" | "white", size: "M" | "L", qty = 1) => ({ id: Y, size, color, qty, upload: old });
  const show = (items: ReturnType<typeof editUpload>) => items.map((i) => `${i.id === Y ? (i.upload?.id ?? "?") : i.id} ${i.color} ${i.size} ×${i.qty}`);
  it("one tee → both: the other colour joins it, in the size chosen", () => {
    expect(show(editUpload([other, line("white", "M")], Y, "old", neu, ["white", "black"], "L"))).toEqual(["mono-1 black M ×1", "new white L ×1", "new black L ×1"]);
  });
  it("the pair → one tee: the other colour goes (its partner is there); quantities kept", () => {
    expect(show(editUpload([line("black", "L", 2), line("white", "L"), other], Y, "old", neu, ["black"], "L"))).toEqual(["new black L ×2", "mono-1 black M ×1"]);
  });
  it("one tee → the other tee: the line moves, size and quantity kept", () => {
    expect(show(editUpload([line("white", "M", 3)], Y, "old", neu, ["black"], "M"))).toEqual(["new black M ×3"]);
  });
  it("several lines keep their sizes; lines that end up the same merge (up to the cap)", () => {
    expect(show(editUpload([line("white", "M", 3), line("white", "L")], Y, "old", neu, ["white"], "S" as never))).toEqual(["new white M ×3", "new white L ×1"]);
    // Black L has no white partner: it moves (and joins nothing); black M's partner is there: it goes.
    expect(show(editUpload([line("white", "M", 6), line("black", "L", 1), line("black", "M", 5)], Y, "old", neu, ["white"], "M"))).toEqual(["new white M ×6", "new white L ×1"]);
    expect(show(editUpload([line("white", "M", 6), line("white", "L", 5)], Y, "old", neu, ["white", "black"], "M"))).toEqual(["new white M ×6", "new white L ×5", "new black M ×1", "new black L ×1"]);
    expect(show(editUpload([line("black", "M", 6), line("black", "M", 5)], Y, "old", neu, ["black"], "M"))).toEqual([`new black M ×${MAX_QTY}`]);
  });
  it("lines removed meanwhile: the print is added anew, never lost", () => {
    expect(show(editUpload([other], Y, "old", neu, ["white", "black"], "M"))).toEqual(["mono-1 black M ×1", "new white M ×1", "new black M ×1"]);
  });
});
