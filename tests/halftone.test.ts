import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import full from "@/data/shirts.json";
import halftone from "@/data/curation/halftone.json";
import { needsInvert } from "@/lib/catalog";
import { type CatalogEntry } from "@/types/shirt";

const FULL = full as unknown as CatalogEntry[];
const PUBLIC = path.resolve(__dirname, "..", "public");
const WEBP = FULL.filter((s) => s.backPrintUrl.endsWith(".webp"));
const MANIFEST = halftone as Record<string, { mode: string; tee?: string }>;

describe("Part 2: one ink — every raster print is a true two-tone halftone", () => {
  it("no print has a midtone: alpha is 0 or 255, and the ink is pure black or pure white", async () => {
    const bad: string[] = [];
    for (const s of WEBP) {
      const { data, info } = await sharp(path.join(PUBLIC, s.backPrintUrl)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let mid = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        const a = data[i * 4 + 3];
        if (a !== 0 && a !== 255) mid++;
        else if (a === 255 && data[i * 4] !== 0 && data[i * 4] !== 255) mid++;
      }
      if (mid) bad.push(`${s.id}: ${mid}`);
    }
    expect(bad).toEqual([]);
  }, 600_000);

  it("every raster print went through the screen; a photograph sits on the tee its ink was baked for, never inverted", () => {
    for (const s of WEBP) {
      const m = MANIFEST[s.n];
      expect(m, s.id).toBeDefined();
      if (s.medium === "photo") {
        expect(m.tee, s.id).toBe(s.baseColor);
        expect(s.colors, s.id).toEqual([s.baseColor]);
        expect(needsInvert(s, s.baseColor), s.id).toBe(false);
        expect(s.description, s.id).toMatch(/one-ink halftone/);
      }
    }
    expect(FULL.filter((s) => /greyscale/i.test(`${s.summary} ${s.description}`)).map((s) => s.id)).toEqual([]);
  });

  it("line work keeps solid strokes: only a dark mass is capped to a mesh (a pixel-fine mesh in every line showed as blocks on phones)", async () => {
    // Of the ink pixels in dark areas (7 px window ≥ 70% ink), the share whose 5 px square is all ink.
    const solidShare = async (file: string) => {
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width: w, height: h } = info;
      const W = w + 1;
      const sat = new Uint32Array(W * (h + 1));
      for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) (row += data[(y * w + x) * 4 + 3] > 127 ? 1 : 0), (sat[(y + 1) * W + x + 1] = sat[y * W + x + 1] + row);
      }
      const sum = (x: number, y: number, r: number) => sat[(y + r + 1) * W + x + r + 1] - sat[(y - r) * W + x + r + 1] - sat[(y + r + 1) * W + x - r] + sat[(y - r) * W + x - r];
      let dark = 0;
      let solid = 0;
      for (let y = 3; y < h - 3; y += 2)
        for (let x = 3; x < w - 3; x += 2) {
          if (data[(y * w + x) * 4 + 3] <= 127 || sum(x, y, 3) < 0.7 * 49) continue;
          dark++;
          if (sum(x, y, 2) === 25) solid++;
        }
      return dark ? solid / dark : 0;
    };
    const line = WEBP.filter((s) => s.medium === "ink" && ["etched", "architecture"].includes(s.category)).slice(0, 10);
    expect(line.length).toBe(10);
    const shares = (await Promise.all(line.map((s) => solidShare(path.join(PUBLIC, s.backPrintUrl))))).sort((a, b) => a - b);
    expect(shares[5]).toBeGreaterThan(0.03);
  }, 120_000);
});
