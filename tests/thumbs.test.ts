import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SHIRTS, thumbUrl } from "@/lib/catalog";
import { mockupFiles } from "@/lib/preload";

const PUBLIC = path.resolve(__dirname, "..", "public");

describe("V3: grid thumbnails, so a category switch shows whole tees", () => {
  it("every raster print has a 240 × 320 thumbnail with its transparency; SVG prints stay vector", async () => {
    const rasters = SHIRTS.filter((s) => s.backPrintUrl.endsWith(".webp"));
    expect(rasters.length).toBeGreaterThan(1000);
    for (const s of rasters) expect(existsSync(path.join(PUBLIC, thumbUrl(s))), s.id).toBe(true);
    for (const s of rasters.filter((_, i) => i % 200 === 0)) {
      const m = await sharp(path.join(PUBLIC, thumbUrl(s))).metadata();
      expect([m.width, m.height, m.hasAlpha], s.id).toEqual([240, 320, true]);
    }
    const svg = SHIRTS.find((s) => s.backPrintUrl.endsWith(".svg"))!;
    expect(thumbUrl(svg)).toBe(svg.backPrintUrl);
    expect(thumbUrl(rasters[0])).toMatch(/^\/prints\/t\/print_\d+\.webp$/);
  });

  it("a card's files to warm are its thumbnail and its model photo", () => {
    const s = SHIRTS.find((x) => x.backPrintUrl.endsWith(".webp"))!;
    const files = mockupFiles(s);
    expect(files[0]).toContain("/prints/t/");
    expect(files[1]).toMatch(/\/models\/.+-(white|black)\.webp$/);
  });
});

describe("W1: the thumbnail is a bridge — the full print only when it would look soft", () => {
  it("needsFull: a phone grid at normal zoom keeps the thumbnail; a pinch-zoom or a very dense screen asks for the full file", async () => {
    const { needsFull } = await import("@/lib/sharpness");
    expect(needsFull(44, 3, 1, 240)).toBe(false); // phone, 2 columns
    expect(needsFull(85, 2, 1, 240)).toBe(false); // desktop, 4 columns
    expect(needsFull(44, 3, 3, 240)).toBe(true); // phone, pinched ×3
    expect(needsFull(85, 4, 1, 240)).toBe(true); // a 4× screen
  });
});
