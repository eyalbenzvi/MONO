import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, SHIRT_CATEGORIES } from "@/types/shirt";
import { OUT_H, OUT_W, convert, inkFor, type Converted } from "@/lib/upload/convert";
import { mulberry32 } from "@/lib/custom/rng";
import { category, features, measured, regularity, geometry, textLike, MEASURED } from "@/lib/upload/features";
import { checkRaster, measure, type Measures } from "@/lib/upload/measure";
import { convertInWorker } from "@/lib/upload/run";
import { REASONS } from "@/lib/upload/reasons";
import { chooseTee } from "@/lib/upload/teeRule";
import { cleanTitle } from "@/lib/upload/title";
import { currentPriors } from "../../scripts/tools/uploadPriors";
import { fromGrey, logo, photo, rings, scan } from "./fixtures";

const M = (patch: Partial<Measures>): Measures => ({ quality: 70, coverage: 0.15, detail: 0.4, flags: [], solid: null, minStrokeMm: 1, minGapMm: 1, strokes: null, screened: false, size: "full", ...patch });
const conv = (patch: Partial<Converted>): Converted => ({ cls: "line", mode: "line", size: "full", w: OUT_W, h: OUT_H, ink: new Uint8Array(0), tone: null, midtones: 0, darkOnLight: true, ...patch });
const TONE = { lum: new Float32Array(0), alpha: new Float32Array(0) };

describe("uploads: the tee rule (brief 6.3)", () => {
  it("line work keeps its polarity: dark on light is white, and black is offered when it prints there", () => {
    expect(chooseTee(conv({}), () => M({}))).toEqual({ tee: "white", other: true });
    expect(chooseTee(conv({ cls: "vector", mode: "vector" }), () => M({})).tee).toBe("white");
    expect(chooseTee(conv({ darkOnLight: false }), () => M({}))).toEqual({ tee: "black", other: true });
  });

  it("line work: the other tee is disabled when it can't print there (a black tee wants 0.5 mm lines)", () => {
    const scoreOn = (tee: "black" | "white") => M({ minStrokeMm: tee === "black" ? 0.45 : 0.45 });
    expect(chooseTee(conv({}), scoreOn)).toMatchObject({ tee: "white", other: false });
  });

  it("a photograph goes on the tee that scores higher, never inverted", () => {
    const c = conv({ cls: "photo", mode: "dots", tone: TONE });
    expect(chooseTee(c, (t) => M({ quality: t === "black" ? 75 : 60 }))).toEqual({ tee: "black", other: false });
    expect(chooseTee(c, (t) => M({ quality: t === "black" ? 60 : 75 }))).toEqual({ tee: "white", other: false });
  });

  it("a photograph's other tee: offered at ≥ 53, no flags, within 12 points", () => {
    const c = conv({ cls: "photo", mode: "dots", tone: TONE });
    const on = (black: number, white: number, flags: Measures["flags"] = []) => chooseTee(c, (t) => M({ quality: t === "black" ? black : white, flags: t === "white" ? flags : [] }));
    expect(on(70, 58).other).toBe(true);
    expect(on(70, 57).other).toBe(false);
    expect(on(64, 53).other).toBe(true);
    expect(on(64, 52).other).toBe(false);
    expect(on(70, 60, ["vignette"]).other).toBe(false);
    // A tie goes to the picture's own side.
    expect(chooseTee(conv({ cls: "photo", mode: "dots", tone: TONE, darkOnLight: true }), () => M({})).tee).toBe("white");
    expect(chooseTee(conv({ cls: "photo", mode: "dots", tone: TONE, darkOnLight: false }), () => M({})).tee).toBe("black");
  });

  it("on a real photograph, both screens are scored and the rule holds", () => {
    const c = convert({ pixels: photo() }, { size: "full" });
    const scores: Record<string, number> = {};
    const r = chooseTee(c, (tee) => {
      const m = measure(inkFor(c, tee), OUT_W, OUT_H, tee, { screened: true });
      scores[tee] = m.quality;
      return m;
    });
    expect(scores[r.tee]).toBeGreaterThanOrEqual(scores[r.tee === "black" ? "white" : "black"]);
  }, 30_000);
});

describe("uploads: titles (brief 6.6)", () => {
  const cases: [string, string, "photo" | "line"][] = [
    ["IMG_2034.JPG", "Your Photograph", "photo"],
    ["DSC00123.jpg", "Your Photograph", "photo"],
    ["DSCN0042.JPG", "Your Drawing", "line"],
    ["PXL_20230101_123456789.PORTRAIT.jpg", "Your Photograph", "photo"],
    ["Screenshot 2024-05-01 at 10.22.33 AM.png", "Your Drawing", "line"],
    ["WhatsApp Image 2023-03-04 at 12.00.01.jpeg", "Your Photograph", "photo"],
    ["IMG-20230101-WA0001.jpg", "Your Photograph", "photo"],
    ["IMG_1234 grandmas garden.jpg", "Grandmas Garden", "photo"],
    ["my_cat-drawing.png", "My Cat Drawing", "line"],
    ["grandmas_garden_2019.webp", "Grandmas Garden", "photo"],
    ["Photo Booth.jpg", "Photo Booth", "photo"],
    ["logoFinalV2 copy.svg", "Logo Final", "line"],
    ["MUM AND DAD.jpg", "Mum And Dad", "photo"],
    ["a.png", "Your Drawing", "line"],
    ["the_quick_brown_fox_jumps_over_the_lazy_dog_again.png", "The Quick Brown Fox Jumps Over The Lazy", "photo"],
  ];
  for (const [file, title, cls] of cases) it(`${file} → ${title}`, () => expect(cleanTitle(file, cls)).toBe(title));

  it("always 3–40 characters", () => {
    for (const [file, , cls] of cases) {
      const t = cleanTitle(file, cls);
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.length).toBeLessThanOrEqual(40);
    }
  });

  it("words are their own title", () => {
    expect(cleanTitle("MIND  THE GAP", "words")).toBe("MIND THE GAP");
  });
});

describe("uploads: features and category (brief 6.6)", () => {
  const cases = () => {
    const out: [string, Converted][] = [
      ["scan", convert({ pixels: scan() }, { size: "full" })],
      ["logo", convert({ pixels: logo() }, { size: "full" })],
      ["photo", convert({ pixels: photo() }, { size: "full" })],
      ["lines", convert({ pixels: photo() }, { size: "full", mode: "lines" })],
      ["words", convert({ pixels: logo(), words: ["A"] }, { size: "small" })],
    ];
    return out;
  };

  it("every axis in [0, 1], 17 of them; photographic 0.95 for a photograph, else 0; typography 1 for words", () => {
    for (const [name, c] of cases()) {
      const m = measure(c.ink, OUT_W, OUT_H, "white", { screened: c.mode === "dots" });
      const f = features(c, m);
      expect(Object.keys(f), name).toEqual([...FEATURE_KEYS]);
      for (const k of FEATURE_KEYS) {
        expect(f[k], `${name} ${k}`).toBeGreaterThanOrEqual(0);
        expect(f[k], `${name} ${k}`).toBeLessThanOrEqual(1);
      }
      expect(f.photographic, name).toBe(c.cls === "photo" ? 0.95 : 0);
      if (c.cls === "words") expect(f.typography).toBe(1);
      if (c.mode === "dots") expect(f.halftone_raster).toBe(1);
    }
  }, 60_000);

  it("the other axes are the category's catalogue mean", () => {
    const priors = currentPriors();
    for (const [name, c] of cases()) {
      const m = measure(c.ink, OUT_W, OUT_H, "white", { screened: c.mode === "dots" });
      const f = features(c, m, { priors });
      const cat = category(c, f, m);
      for (const k of FEATURE_KEYS) if (!MEASURED.includes(k)) expect(f[k], `${name} ${k}`).toBe(priors.categories[cat][k]);
    }
  }, 60_000);

  it("the category rule: photo, then type, geometric, engravings, pattern", () => {
    const photoC = conv({ cls: "photo" });
    expect(category(photoC, { typography: 1, geometric: 1 }, { detail: 1 })).toBe("photographs");
    expect(category(conv({}), { typography: 0.5, geometric: 1 }, { detail: 1 })).toBe("type");
    expect(category(conv({}), { typography: 0.49, geometric: 0.6 }, { detail: 1 })).toBe("systems");
    expect(category(conv({}), { typography: 0.49, geometric: 0.59 }, { detail: 0.5 })).toBe("etched");
    expect(category(conv({}), { typography: 0.49, geometric: 0.59 }, { detail: 0.49 })).toBe("pattern");
  });

  it("the measures move the right way: a regular grid repeats, rings are symmetric, a row of letters reads as text", () => {
    const grid = new Uint8Array(OUT_W * OUT_H);
    for (let y = 100; y < 1900; y++) for (let x = 100; x < 1400; x++) if (x % 80 < 8 || y % 80 < 8) grid[y * OUT_W + x] = 1;
    const rnd = mulberry32(9);
    const noise = new Uint8Array(OUT_W * OUT_H).map(() => (rnd() < 0.15 ? 1 : 0));
    expect(regularity(checkRaster(grid, OUT_W, OUT_H))).toBeGreaterThan(0.5);
    expect(regularity(checkRaster(noise, OUT_W, OUT_H))).toBeLessThan(0.3);
    expect(geometry(checkRaster(grid, OUT_W, OUT_H)).straight).toBeGreaterThan(0.7);
    expect(geometry(checkRaster(rings(6), OUT_W, OUT_H)).symmetry).toBeGreaterThan(0.8);
    // Five "letters" (O-like boxes, 8 mm tall) in a row.
    const text = new Uint8Array(OUT_W * OUT_H);
    for (let i = 0; i < 5; i++)
      for (let y = 800; y < 843; y++)
        for (let x = 200 + i * 60; x < 232 + i * 60; x++) if (y < 808 || y >= 835 || x < 208 + i * 60 || x >= 224 + i * 60) text[y * OUT_W + x] = 1;
    expect(textLike(text)).toBeGreaterThan(0.9);
    expect(textLike(grid)).toBeLessThan(0.1);
    const m = measured(conv({ ink: grid, mode: "line" }), M({ coverage: 0.2, strokes: { p5: 1.5, p50: 1.5, p95: 1.6 } }));
    expect(m.line_art).toBeGreaterThan(0.5);
  });

  it("data/upload/priors.json is up to date with the catalogue (npx tsx --tsconfig tsconfig.scripts.json scripts/tools/uploadPriors.ts)", () => {
    const file = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "data", "upload", "priors.json"), "utf8"));
    expect(file).toEqual(currentPriors());
    expect(Object.keys(file.categories).sort()).toEqual([...SHIRT_CATEGORIES].sort());
    expect(file.coverage.p5).toBeLessThan(file.coverage.p95);
  });
});

describe("uploads: the main-thread fallback", () => {
  it("with no Worker, convertInWorker runs the same conversion here, and refuses a file too small", async () => {
    expect(typeof Worker).toBe("undefined");
    const r = await convertInWorker({ pixels: scan(1600, 1200), size: "full" });
    expect(r.ok && r.converted.cls).toBe("line");
    const small = await convertInWorker({ pixels: fromGrey(new Float32Array(900 * 900).fill(1), 900, 900), size: "full" });
    expect(small).toEqual({ ok: false, reason: REASONS.smallForFull });
    expect(await convertInWorker({ words: ["  "], size: "full" })).toEqual({ ok: false, reason: REASONS.noWords });
  });
});
