// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import full from "@/data/shirts.json";
import halftone from "@/data/curation/halftone.json";
import { TeeMockup } from "@/components/TeeMockup";
import { SHIRTS } from "@/lib/catalog";
import { DETAIL_WIDTH, MOCKUP_WIDTHS, PRINT_WIDTHS, SIZES, detailPath, mockupPath, printPath } from "@/lib/images";
import { modelFor } from "@/lib/models";
import { pageZoomStep } from "@/hooks/usePageZoom";
import { otherColor, type CatalogEntry } from "@/types/shirt";
import { allJobs, flatPrint, svgIn } from "../scripts/images/bake";

const FULL = full as unknown as CatalogEntry[];
const ROOT = path.resolve(__dirname, "..");
afterEach(cleanup);

describe("pictures are baked at build time (scripts/images/bake.ts), one plain image each", () => {
  it("every design, in every colour it's sold in, has a model photo to be baked on", () => {
    const jobs = allJobs();
    expect(jobs.length).toBe(FULL.reduce((n, s) => n + s.colors.length, 0));
    for (const { shirt, color } of jobs) expect(modelFor(shirt, color), `${shirt.id} ${color}`).not.toBeNull();
  });

  it("the ink is laid down as it prints: black ink for a white tee, white ink for a black one, the tee colour around it", async () => {
    const ink = FULL.find((s) => s.medium === "ink" && s.colors.length === 2)!;
    const onBlack = await flatPrint(ink, "black");
    const onWhite = await flatPrint(ink, "white");
    expect([onBlack.width, onBlack.height]).toEqual([1500, 2000]);
    // Where one is ink the other is ink too, in the opposite colour: the two are exact negatives.
    let inked = 0;
    for (let i = 0; i < onBlack.data.length; i += 97) {
      expect(onBlack.data[i] + onWhite.data[i]).toBe(255);
      if (onBlack.data[i] === 255) inked++;
    }
    expect(inked).toBeGreaterThan(0);
    // The corners are bare tee.
    expect(onBlack.data[0]).toBe(0);
    expect(onWhite.data[0]).toBe(255);
  });

  it("a photograph is never a negative: on its own tee its ink is the opposite colour, as it was screened", async () => {
    const photo = FULL.find((s) => s.medium === "photo")!;
    expect(photo.colors).toEqual([photo.baseColor]);
    const g = await flatPrint(photo, photo.baseColor);
    expect(g.data[0]).toBe(photo.baseColor === "black" ? 0 : 255);
  });

  it("a drawn print's other colourway swaps its two inks", () => {
    const drawn = FULL.find((s) => s.medium === "drawn" && s.colors.length === 2)!;
    const own = svgIn(drawn, drawn.baseColor);
    const other = svgIn(drawn, otherColor(drawn.baseColor));
    expect(own).toBe(readFileSync(path.join(ROOT, "public", drawn.backPrintUrl), "utf8"));
    expect(other.replace(/#FFFFFF|#000000/g, (m) => (m === "#FFFFFF" ? "#000000" : "#FFFFFF"))).toBe(own);
  });

  it("the page asks for the baked files by name: design number, colour and width", () => {
    const s = SHIRTS.find((x) => x.medium === "ink")!;
    expect(mockupPath(s, "black", 720)).toBe(`/img/m/${s.n}-black-720.webp`);
    expect(printPath(s, "white", 1500)).toBe(`/img/p/${s.n}-white-1500.webp`);
    expect(detailPath(s, "white")).toBe(`/img/d/${s.n}-white.webp`);
    expect([...MOCKUP_WIDTHS]).toEqual([360, 720, 1080]);
    expect([...PRINT_WIDTHS]).toEqual([480, 1500]);
    expect(DETAIL_WIDTH).toBe(900);
    // Every size is one CSS length, so a zoom can multiply it.
    for (const v of Object.values(SIZES)) expect(v, v).not.toMatch(/\)\s|,\s*\(/);
  });
});

describe("TeeMockup: one picture; zoomed, a close-up covers the print's area", () => {
  it("zoomed in, the close-up sits exactly on the model photo's print box", () => {
    const s = SHIRTS.find((x) => x.colors.length === 2)!;
    const { container, rerender } = render(<TeeMockup shirt={s} color="white" sizes="300px" />);
    expect(container.querySelector("[data-detail]")).toBeNull();
    rerender(<TeeMockup shirt={s} color="white" sizes="300px" zoomed />);
    const d = container.querySelector<HTMLImageElement>("[data-detail]")!;
    expect(d.getAttribute("src")).toBe(`/img/d/${s.n}-white.webp?v=${s.pic}`);
    const [x, y, w, h] = modelFor(s, "white")!.box;
    expect(d.style.left).toBe(`${x * 100}%`);
    expect(d.style.top).toBe(`${y * 100}%`);
    expect(d.style.width).toBe(`${w * 100}%`);
    expect(d.style.height).toBe(`${h * 100}%`);
    // Hidden until it has loaded: the picture under it stays in view.
    expect(d.className).toMatch(/opacity-0/);
  });

  it("a pinch-zoomed page lays bigger files over its pictures, in a few steps (not every frame)", () => {
    expect([1, 1.2, 1.4, 1.8, 2.5, 4].map(pageZoomStep)).toEqual([1, 1, 1.5, 2, 2, 4]);
  });
});

describe("the originals are kept (assets/masters); the halftones are made from them", () => {
  it("every raster print in the catalogue has its original, and the record says which one it was screened from", () => {
    const man = halftone as Record<string, { src?: string; recipe?: number }>;
    const sha = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);
    for (const s of FULL.filter((x) => x.backPrintUrl.endsWith(".webp"))) {
      const master = path.join(ROOT, "assets", "masters", `print_${s.n}.webp`);
      expect(existsSync(master), s.id).toBe(true);
      expect(man[s.n]?.src, s.id).toBe(sha(master));
    }
    const script = readFileSync(path.join(ROOT, "scripts", "photos", "halftone.py"), "utf8");
    expect(script).toMatch(/src = os\.path\.join\(MASTERS/);
    expect(script).not.toMatch(/Image\.open\(path\)/);
    // (Reads every photo or print: slow under a full parallel run.)
  }, 60_000);
});
