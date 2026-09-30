// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import full from "@/data/shirts.json";
import { TeeMockup } from "@/components/TeeMockup";
import { MOCKUP_WIDTHS } from "@/lib/images";
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
  it("every design lists its colours, the original first; photographs come in one, brush work and plates in both", () => {
    for (const s of SHIRTS) {
      expect(s.colors[0], s.id).toBe(s.baseColor);
      expect(new Set(s.colors).size).toBe(s.colors.length);
    }
    // A photograph on the other tee loses most of its picture: never offered there.
    expect(SHIRTS.filter((s) => s.medium === "photo").every((s) => s.colors.length === 1)).toBe(true);
    // Brush work and plates are one-ink halftones now (Part 2): white ink on black works, and some start there (Part 3).
    const tonal = SHIRTS.filter((s) => /^archive-(ink-painting|ukiyo-e|botanical|natural-history)$/.test(s.variant));
    expect(tonal.length).toBeGreaterThan(100);
    expect(tonal.filter((s) => s.colors.length === 2).length).toBeGreaterThan(tonal.length * 0.8);
    expect(tonal.filter((s) => s.baseColor === "black").length).toBeGreaterThan(tonal.length * 0.25);
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
    const { container } = render(<TeeMockup shirt={single} color={otherColor(single.baseColor)} sizes="300px" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toContain(`/img/m/${single.n}-${single.baseColor}-`);
    expect(img.getAttribute("srcset")).not.toContain(`-${otherColor(single.baseColor)}-`);
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
    expect(JSON.parse(localStorage.getItem("mono-cart")!).version).toBe(6);
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

describe("T2: the tee worn — model photos", () => {
  it("every photo exists, in both tee colours; a photo's twins share one print box, sized to the man", async () => {
    const { MODEL_PHOTOS, modelFor } = await import("@/lib/models");
    const { existsSync } = await import("node:fs");
    expect(MODEL_PHOTOS.length).toBeGreaterThanOrEqual(2);
    for (const m of MODEL_PHOTOS) expect(existsSync(`public/models/${m.id}.webp`), m.id).toBe(true);
    expect(new Set(MODEL_PHOTOS.map((m) => m.color))).toEqual(new Set(["white", "black"]));
    // Each pose comes in both colours with the same box; a broader man has a bigger one (analyze.py print_box),
    // always a centred 3:4 print on the upper back.
    const byPose = new Map<string, string[]>();
    for (const m of MODEL_PHOTOS) byPose.set(m.id.replace(/-(black|white)$/, ""), [...(byPose.get(m.id.replace(/-(black|white)$/, "")) ?? []), m.box.join()]);
    for (const [pose, boxes] of byPose) {
      expect(boxes, pose).toHaveLength(2);
      expect(new Set(boxes).size, pose).toBe(1);
    }
    for (const { id, box } of MODEL_PHOTOS) {
      const [x, y, w, h] = box;
      expect(Math.abs(x + w / 2 - 0.5), id).toBeLessThan(0.005);
      expect((w * 512) / (h * 704), id).toBeCloseTo(0.75, 2);
      expect(w, id).toBeGreaterThan(0.24);
      expect(w, id).toBeLessThan(0.32);
      expect(y, id).toBeGreaterThan(0.3);
      expect(y + h, id).toBeLessThan(0.75);
    }
    // A design always gets a photo of the tee colour asked for, the same one each time.
    expect(modelFor(both, "black")!.color).toBe("black");
    expect(modelFor(both, "white")).toEqual(modelFor(both, "white"));
  });

  it("no photo has streaked edges (rows or columns repeating their neighbour, from framing past the picture)", async () => {
    const { MODEL_PHOTOS } = await import("@/lib/models");
    const sharp = (await import("sharp")).default;
    for (const m of MODEL_PHOTOS) {
      const { data, info } = await sharp(`public/models/${m.id}.webp`).greyscale().raw().toBuffer({ resolveWithObject: true });
      const { width: w, height: h } = info;
      const px = (x: number, y: number) => data[y * w + x];
      const flat = (a: (i: number) => number, b: (i: number) => number, n: number) => {
        let d = 0;
        for (let i = 0; i < n; i++) d += Math.abs(a(i) - b(i));
        // A streak repeats its neighbour almost exactly (a defocused edge still changes).
        return d / n < 0.3;
      };
      // How many lines from each edge repeat their neighbour.
      const run = (line: (k: number) => (i: number) => number, n: number) => {
        let k = 0;
        while (k < 40 && flat(line(k), line(k + 1), n)) k++;
        return k;
      };
      const runs = [
        run((k) => (i) => px(k, i), h),
        run((k) => (i) => px(w - 1 - k, i), h),
        run((k) => (i) => px(i, k), w),
        run((k) => (i) => px(i, h - 1 - k), w),
      ];
      expect(Math.max(...runs), m.id).toBeLessThan(6);
    }
    // (Reads every photo or print: slow under a full parallel run.)
  }, 60_000);

  it("each black twin's tee is whole: no white specks or streaks left in it (holes in its mask)", async () => {
    const { MODEL_PHOTOS } = await import("@/lib/models");
    const sharp = (await import("sharp")).default;
    const grey = async (id: string) => (await sharp(`public/models/${id}.webp`).greyscale().raw().toBuffer({ resolveWithObject: true }));
    for (const m of MODEL_PHOTOS.filter((p) => p.color === "white")) {
      const white = await grey(m.id);
      const black = await grey(m.id.replace(/-white$/, "-black"));
      const { width: w, height: h } = white.info;
      // The tee: what the black twin darkened. A hole is untouched ground the outside can't reach.
      const tee = new Uint8Array(w * h).map((_, i) => (white.data[i] - black.data[i] > 64 ? 1 : 0));
      const outside = new Uint8Array(w * h);
      const stack: number[] = [];
      for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
      while (stack.length) {
        const i = stack.pop()!;
        if (outside[i] || tee[i]) continue;
        outside[i] = 1;
        const x = i % w;
        if (x > 0) stack.push(i - 1);
        if (x < w - 1) stack.push(i + 1);
        if (i >= w) stack.push(i - w);
        if (i < w * (h - 1)) stack.push(i + w);
      }
      let holes = 0;
      for (let i = 0; i < w * h; i++) if (!tee[i] && !outside[i]) holes++;
      expect(holes, m.id).toBeLessThan(6);
    }
  });

  it("the mockup is one picture of the print on that colour's photo (baked at build time, never blended on the page)", () => {
    const { container } = render(<TeeMockup shirt={both} color="black" sizes="300px" />);
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("srcset")).toBe(MOCKUP_WIDTHS.map((w) => `/img/m/${both.n}-black-${w}.webp ${w}w`).join(", "));
    expect(container.innerHTML).not.toMatch(/mix-blend|invert|\/models\/|\/prints\//);
  });
});
