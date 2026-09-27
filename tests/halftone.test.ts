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
});
