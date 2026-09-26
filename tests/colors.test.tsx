// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import full from "@/data/shirts.json";
import { TeeMockup } from "@/components/TeeMockup";
import { SHIRTS } from "@/lib/catalog";
import { productDescription } from "@/lib/seo";
import { productJsonLd } from "@/lib/structuredData";
import { otherColor, teeColor, type CatalogEntry } from "@/types/shirt";
import { offeredColors } from "../scripts/gen/colors";

const FULL = full as unknown as CatalogEntry[];
const single = SHIRTS.find((s) => s.colors.length === 1 && s.medium === "photo")!;
const both = SHIRTS.find((s) => s.colors.length === 2)!;

afterEach(cleanup);

describe("T3: designs that suit one tee colour are sold in that colour only", () => {
  it("every design lists its colours, the original first; photographs and tonal ink come in one", () => {
    for (const s of SHIRTS) {
      expect(s.colors[0], s.id).toBe(s.baseColor);
      expect(new Set(s.colors).size).toBe(s.colors.length);
    }
    // A photograph on the other tee loses most of its picture: never offered there.
    expect(SHIRTS.filter((s) => s.medium === "photo").every((s) => s.colors.length === 1)).toBe(true);
    // Brush paintings and botanical watercolours: never a white-on-black negative.
    const tonal = SHIRTS.filter((s) => /^archive-(ink-painting|ukiyo-e|botanical)$/.test(s.variant));
    expect(tonal.length).toBeGreaterThan(100);
    expect(tonal.every((s) => s.colors.length === 1 && s.baseColor === "white")).toBe(true);
    // Most line work and drawn prints still come in both.
    expect(SHIRTS.filter((s) => s.medium === "drawn" && s.colors.length === 2).length).toBeGreaterThan(SHIRTS.filter((s) => s.medium === "drawn").length * 0.8);
    expect(offeredColors("black", true)).toEqual(["black"]);
    expect(offeredColors("white", false)).toEqual(["white", "black"]);
  });

  it("teeColor falls back on the original for a colour the design isn't sold in", () => {
    expect(teeColor(single, otherColor(single.baseColor))).toBe(single.baseColor);
    expect(teeColor(both, otherColor(both.baseColor))).toBe(otherColor(both.baseColor));
    expect(teeColor(both, null)).toBe(both.baseColor);
  });

  it("the mockup never shows a one-colour design on the other tee", () => {
    const { container } = render(<TeeMockup shirt={single} color={otherColor(single.baseColor)} />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain(`garment-${single.baseColor}`);
  });

  it("search copy and structured data offer only the colours it's sold in", () => {
    const entry = FULL.find((s) => s.id === single.id)!;
    expect(productDescription(entry)).toMatch(/tee only ·/);
    const group = (productJsonLd(entry)["@graph"] as { "@type": string; hasVariant?: { color: string }[] }[]).find((g) => g["@type"] === "ProductGroup")!;
    expect(new Set(group.hasVariant!.map((v) => v.color))).toEqual(new Set([single.baseColor === "black" ? "Black" : "White"]));
    const two = FULL.find((s) => s.id === both.id)!;
    expect(productDescription(two)).toMatch(/also in/);
  });
});

describe("T3: the bag (cart store v4)", () => {
  beforeEach(() => localStorage.clear());

  it("migrates v3 → v4: a line in a colour no longer sold moves to the original, merged; picks in it are forgotten", async () => {
    const wrong = otherColor(single.baseColor);
    localStorage.setItem(
      "mono-cart",
      JSON.stringify({
        state: {
          cart: [
            { id: single.id, size: "M", color: wrong, qty: 2 },
            { id: single.id, size: "M", color: single.baseColor, qty: 1 },
            { id: both.id, size: "L", color: otherColor(both.baseColor), qty: 1 },
          ],
          selectedColors: { [single.id]: wrong, [both.id]: otherColor(both.baseColor) },
        },
        version: 3,
      }),
    );
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    await useCartStore.persist.rehydrate();
    const s = useCartStore.getState();
    expect(s.cart).toEqual([
      { id: single.id, size: "M", color: single.baseColor, qty: 3 },
      { id: both.id, size: "L", color: otherColor(both.baseColor), qty: 1 },
    ]);
    expect(s.selectedColors).toEqual({ [both.id]: otherColor(both.baseColor) });
    s.setSize(both.id, "S");
    expect(JSON.parse(localStorage.getItem("mono-cart")!).version).toBe(4);
  });

  it("adding a one-colour design in the other colour adds the original; the pair and a colour change can't be made", async () => {
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    const s = useCartStore.getState();
    s.setColor(single.id, otherColor(single.baseColor));
    expect(useCartStore.getState().selectedColors[single.id]).toBeUndefined();
    s.addToCart(single.id, "M", otherColor(single.baseColor), 1, { silent: true });
    expect(useCartStore.getState().cart).toEqual([{ id: single.id, size: "M", color: single.baseColor, qty: 1 }]);
    expect(s.addPair(single.id, "M", { silent: true })).toBe(false);
    s.changeCartItem({ id: single.id, size: "M", color: single.baseColor }, { color: otherColor(single.baseColor) });
    expect(useCartStore.getState().cart[0].color).toBe(single.baseColor);
    expect(s.addPair(both.id, "M", { silent: true })).toBe(true);
  });
});
