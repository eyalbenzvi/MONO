import { describe, expect, it } from "vitest";
import { assessPrint } from "@/lib/custom/quality";
import { MM_PER_PX, OUT_H, OUT_W, convert } from "@/lib/upload/convert";
import { BAR, checkRaster, detailOf, dhash, measure, nearestCatalogue, tier, type Measures } from "@/lib/upload/measure";
import { REASONS } from "@/lib/upload/reasons";
import { dHash } from "../../scripts/tools/searchIndex";
import { logo, photo, rings, scan } from "./fixtures";

const [W, H] = [OUT_W, OUT_H];

/** Parallel stripes of a width (px) and period at an angle, in a 1200 px band (angled, so they fall on the grid every which way). */
function stripes(widthPx: number, angle: number, period = 60) {
  const m = new Uint8Array(W * H);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - 750) * c + (y + 0.5 - 1000) * s;
      const v = -(x + 0.5 - 750) * s + (y + 0.5 - 1000) * c;
      if (Math.abs(v) < 600 && Math.abs(u) < 600 && ((u % period) + period) % period < widthPx) m[y * W + x] = 1;
    }
  return m;
}

describe("uploads: line width and gap, on the final raster (1 px ≈ 0.187 mm)", () => {
  for (const mm of [0.3, 0.5, 0.8]) {
    const px = mm / MM_PER_PX;
    it(`${mm} mm lines measure ${mm} mm ± 0.1 (circles and angled lines)`, () => {
      for (const ink of [rings(px), stripes(px, 0.3), stripes(px, Math.PI / 4), stripes(px, 1.1)]) {
        const m = measure(ink, W, H, "white");
        expect(m.minStrokeMm, `${mm}`).not.toBeNull();
        expect(Math.abs(m.minStrokeMm! - mm), `${mm}: ${m.minStrokeMm}`).toBeLessThanOrEqual(0.1);
      }
    }, 30_000);
  }

  it("tiered by the tee: 0.3 mm refused on both, 0.5 mm prints on white, 0.8 mm prints on both", () => {
    const at = (mm: number, tee: "black" | "white") => {
      const m = measure(rings(mm / MM_PER_PX), W, H, tee);
      // Only the line width is in question here.
      return tier({ ...m, quality: 80, coverage: 0.1, detail: 0.5, solid: null, minGapMm: 2 }, tee);
    };
    expect(at(0.3, "white")).toMatchObject({ tier: "refuse", reason: "Lines under 0.4 mm. Try bolder lines." });
    expect(at(0.3, "black")).toMatchObject({ tier: "refuse", reason: "Lines under 0.5 mm. Try bolder lines." });
    expect(at(0.5, "white").tier).toBe("print");
    expect(at(0.8, "white").tier).toBe("catalogue");
    expect(at(0.8, "black").tier).toBe("catalogue");
  }, 30_000);

  it("the reversed gap: the narrowest ground between the ink", () => {
    for (const gapMm of [0.5, 0.9]) {
      const gap = gapMm / MM_PER_PX;
      // 1.5 mm lines with the gap between them.
      const ink = stripes(1.5 / MM_PER_PX, 0.3, 1.5 / MM_PER_PX + gap);
      const m = measure(ink, W, H, "white");
      expect(Math.abs(m.minGapMm! - gapMm), `${gapMm}: ${m.minGapMm}`).toBeLessThanOrEqual(0.1);
      expect(Math.abs(m.minStrokeMm! - 1.5)).toBeLessThanOrEqual(0.1);
    }
  }, 30_000);

  it("a dot screen isn't judged by its dots (their size is the screen's)", () => {
    const c = convert({ pixels: photo() }, { size: "full" });
    const m = measure(c.ink, W, H, "white", { screened: true });
    expect(m).toMatchObject({ screened: true, minStrokeMm: null, minGapMm: null });
  });

  it("quality, coverage and detail are the catalogue's own numbers (assessPrint on the 300 × 400 check raster)", () => {
    for (const ink of [convert({ pixels: scan() }, { size: "full" }).ink, convert({ pixels: logo() }, { size: "small" }).ink, rings(4)]) {
      const r = checkRaster(ink, W, H);
      const a = assessPrint(r);
      const m = measure(ink, W, H, "white");
      expect(m.quality).toBe(a.quality);
      expect(m.coverage).toBeCloseTo(a.ink, 4);
      // The detail term rebuilds assessPrint's score exactly.
      const coverScore = a.ink < 0.04 ? a.ink / 0.04 : a.ink <= 0.32 ? 1 : Math.max(0.2, 1 - (a.ink - 0.32) / 0.4);
      const q = Math.round(100 * (0.35 * coverScore + 0.25 * Math.min(1, Math.sqrt(a.extent) / 0.72) + 0.4 * Math.min(1, detailOf(r) / 0.35)));
      expect(q).toBe(a.quality);
      expect(m.detail).toBe(detailOf(r));
    }
  }, 30_000);
});

describe("uploads: the quality bar, every boundary of the table (brief 6.4)", () => {
  // Passes every catalogue bar comfortably.
  const good: Measures = { quality: 80, coverage: 0.15, detail: 0.5, flags: [], solid: null, minStrokeMm: 1, minGapMm: 1.2, strokes: { p5: 1, p50: 1.2, p95: 2 }, screened: false, size: "full" };
  const t = (patch: Partial<Measures>, tee: "black" | "white" = "white", dup?: number) => tier({ ...good, ...patch }, tee, dup);

  it("the good one is catalogue, and not near anything", () => {
    expect(t({})).toEqual({ tier: "catalogue", near: false });
  });

  it("solidBlock: any refusal refuses", () => {
    expect(t({ solid: "slab" })).toMatchObject({ tier: "refuse", reason: REASONS.solid });
    expect(t({ solid: "block", screened: true })).toMatchObject({ tier: "refuse", reason: "Too much ink in one place. Try Lines." });
  });

  it("quality: refused under 53, prints from 53, catalogue from 68", () => {
    expect(t({ quality: 52 }).tier).toBe("refuse");
    expect(t({ quality: 53 }).tier).toBe("print");
    expect(t({ quality: 67 }).tier).toBe("print");
    expect(t({ quality: 68 }).tier).toBe("catalogue");
  });

  it("coverage: refused under 1% or over 45%; catalogue 4–32%", () => {
    expect(t({ coverage: 0.0099 })).toMatchObject({ tier: "refuse", reason: "Too faint to print. Try a stronger picture." });
    expect(t({ coverage: 0.01 }).tier).toBe("print");
    expect(t({ coverage: 0.0399 }).tier).toBe("print");
    expect(t({ coverage: 0.04 }).tier).toBe("catalogue");
    expect(t({ coverage: 0.32 }).tier).toBe("catalogue");
    expect(t({ coverage: 0.3201 }).tier).toBe("print");
    expect(t({ coverage: 0.45 }).tier).toBe("print");
    expect(t({ coverage: 0.4501 })).toMatchObject({ tier: "refuse", reason: REASONS.dense });
    expect(t({ coverage: 0.4501, screened: true })).toMatchObject({ tier: "refuse", reason: REASONS.denseDots });
  });

  it("detail: refused under 0.06, catalogue from 0.35", () => {
    expect(t({ detail: 0.0599 })).toMatchObject({ tier: "refuse", reason: REASONS.plain });
    expect(t({ detail: 0.06 }).tier).toBe("print");
    expect(t({ detail: 0.3499 }).tier).toBe("print");
    expect(t({ detail: 0.35 }).tier).toBe("catalogue");
  });

  it("line width, black ink on a white tee: refused under 0.4 mm, catalogue from 0.6", () => {
    expect(t({ minStrokeMm: 0.399 })).toMatchObject({ tier: "refuse", reason: "Lines under 0.4 mm. Try bolder lines." });
    expect(t({ minStrokeMm: 0.4 }).tier).toBe("print");
    expect(t({ minStrokeMm: 0.599 }).tier).toBe("print");
    expect(t({ minStrokeMm: 0.6 }).tier).toBe("catalogue");
  });

  it("line width, white ink on a black tee: refused under 0.5 mm, catalogue from 0.7; at Small the advice is Full size", () => {
    expect(t({ minStrokeMm: 0.499, size: "small" }, "black")).toMatchObject({ tier: "refuse", reason: "Lines under 0.5 mm. Try Full size." });
    expect(t({ minStrokeMm: 0.5 }, "black").tier).toBe("print");
    expect(t({ minStrokeMm: 0.699 }, "black").tier).toBe("print");
    expect(t({ minStrokeMm: 0.7 }, "black").tier).toBe("catalogue");
  });

  it("reversed gap: refused under 0.6 mm, catalogue from 0.8", () => {
    expect(t({ minGapMm: 0.599 })).toMatchObject({ tier: "refuse", reason: "Gaps under 0.6 mm. Try a simpler picture." });
    expect(t({ minGapMm: 0.6 }).tier).toBe("print");
    expect(t({ minGapMm: 0.799 }).tier).toBe("print");
    expect(t({ minGapMm: 0.8 }).tier).toBe("catalogue");
  });

  it("a dot screen skips line width and gap", () => {
    expect(t({ minStrokeMm: 0.1, minGapMm: 0.1, screened: true }).tier).toBe("catalogue");
  });

  it("a near-duplicate of a catalogue design (Hamming ≤ 6) is refused", () => {
    expect(t({}, "white", 6)).toMatchObject({ tier: "refuse", reason: "This one is already in the catalogue." });
    expect(t({}, "white", 7).tier).toBe("catalogue");
  });

  it("near: within 10% of a threshold it passed", () => {
    expect(t({ quality: 58 }).near).toBe(true);
    expect(t({ quality: 59 }).near).toBe(false);
    expect(t({ coverage: 0.0109 }).near).toBe(true);
    expect(t({ coverage: 0.41 }).near).toBe(true);
    expect(t({ detail: 0.065 }).near).toBe(true);
    expect(t({ minStrokeMm: 0.43 }).near).toBe(true);
    expect(t({ minStrokeMm: 0.54 }, "black").near).toBe(true);
    expect(t({ minStrokeMm: 0.56 }, "black").near).toBe(false);
    expect(t({ minGapMm: 0.65 }).near).toBe(true);
    expect(BAR.stroke.white[0]).toBe(0.4);
  });
});

describe("uploads: near-duplicates by the catalogue's dHash", () => {
  it("hashes as scripts/tools/searchIndex does (the hashes lib/search's index carries)", () => {
    for (const ink of [rings(6), convert({ pixels: scan() }, { size: "full" }).ink]) expect(dhash(ink, W, H)).toBe(dHash({ w: W, h: H, ink: Float32Array.from(ink) }));
  });

  it("the nearest catalogue design, from the index's two 32-bit halves per design", () => {
    const h = "f180c5d95155c961";
    const hashes = new Uint32Array([0x0301193f, 0x276e4600, 0xf180c5d9, 0x5155c960]);
    expect(nearestCatalogue(h, hashes)).toBe(1);
    expect(nearestCatalogue(h, new Uint32Array(0))).toBe(64);
    expect(nearestCatalogue(h, new Uint32Array([0xf180c5d9, 0x5155c961]))).toBe(0);
  });
});
