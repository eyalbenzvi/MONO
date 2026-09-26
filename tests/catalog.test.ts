import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHIRTS, assetUrl, getShirtById, productHref } from "@/lib/catalog";
import full from "@/data/shirts.json";
import { CATEGORY_VIBES, FEATURE_KEYS, SHIRT_CATEGORIES, type CatalogEntry } from "@/types/shirt";

const FULL = full as CatalogEntry[];
/** Description text outside quoted captions (captions are the print's own words). */
const narrative = (d: string) => d.replace(/“[^”]*”/g, "“”").replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");

const PUBLIC = path.resolve(__dirname, "..", "public");

describe("generated catalog (data/shirts.json)", () => {
  it("has 2,800 shirts with unique ids, skus and titles", () => {
    expect(SHIRTS).toHaveLength(2800);
    expect(new Set(SHIRTS.map((s) => s.id)).size).toBe(2800);
    expect(new Set(SHIRTS.map((s) => s.sku)).size).toBe(2800);
    expect(new Set(SHIRTS.map((s) => s.title)).size).toBe(2800);
  });

  it("is 70% black / 30% white tees in each set", () => {
    for (const set of [SHIRTS.slice(0, 1000), SHIRTS.slice(1000, 2000), SHIRTS.slice(2000)]) {
      expect(set.filter((s) => s.baseColor === "black")).toHaveLength(set.length * 0.7);
      expect(set.filter((s) => s.baseColor === "white")).toHaveLength(set.length * 0.3);
    }
  });

  it("has fourteen categories, 200 designs each (each set adds its own)", () => {
    expect(SHIRT_CATEGORIES).toHaveLength(14);
    const cats = (list: typeof SHIRTS) => [...new Set(list.map((s) => s.category))].sort();
    expect(cats(SHIRTS.slice(1000, 2000))).toEqual(["emblems", "objects", "pixel", "scenes", "slogans"]);
    expect(cats(SHIRTS.slice(2000))).toEqual(["ascii", "caricatures", "famousart", "iconic"]);
  });

  it("covers all generative categories evenly", () => {
    for (const c of SHIRT_CATEGORIES) expect(SHIRTS.filter((s) => s.category === c)).toHaveLength(200);
  });

  it("one flat price ($48) and features within [0, 1]", () => {
    for (const s of SHIRTS) {
      expect(s.price).toBe(48);
      for (const k of FEATURE_KEYS) {
        expect(s.features[k]).toBeGreaterThanOrEqual(0);
        expect(s.features[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("feature vectors reflect the algorithm that drew each print", () => {
    const mean = (cat: string, key: (typeof FEATURE_KEYS)[number]) => {
      const list = SHIRTS.filter((s) => s.category === cat);
      return list.reduce((sum, s) => sum + s.features[key], 0) / list.length;
    };
    expect(mean("architectural", "architectural")).toBeGreaterThan(0.75);
    expect(mean("geometric", "geometric")).toBeGreaterThan(0.75);
    expect(mean("typography", "typography")).toBeGreaterThan(0.85);
    expect(mean("halftone", "halftone_raster")).toBeGreaterThan(0.8);
    expect(mean("waves", "line_art")).toBeGreaterThan(0.8);
    expect(mean("scenes", "pictorial")).toBeGreaterThan(0.8);
    expect(mean("scenes", "nature")).toBeGreaterThan(0.75);
    expect(mean("slogans", "wit")).toBeGreaterThan(0.75);
    expect(mean("pixel", "retro")).toBeGreaterThan(0.85);
    expect(mean("emblems", "retro")).toBeGreaterThan(0.65);
    expect(mean("objects", "pictorial")).toBeGreaterThan(0.65);
    expect(mean("ascii", "retro")).toBeGreaterThan(0.75);
    expect(mean("caricatures", "figurative")).toBeGreaterThan(0.85);
    expect(mean("caricatures", "wit")).toBeGreaterThan(0.7);
    expect(mean("famousart", "classic")).toBeGreaterThan(0.85);
    expect(mean("iconic", "pictorial")).toBeGreaterThan(0.75);
    // figurative / classic belong to the third set only
    expect(mean("objects", "figurative")).toBe(0);
    expect(mean("slogans", "classic")).toBe(0);
    // the new dimensions stay low on the original abstract families
    expect(mean("geometric", "wit")).toBeLessThan(0.1);
    expect(mean("architectural", "nature")).toBeLessThan(0.1);
    // and not the others
    expect(mean("waves", "typography")).toBeLessThan(0.1);
    expect(mean("typography", "halftone_raster")).toBeLessThan(0.3);
  });

  it("every print exists on disk as a valid 3:4 SVG", () => {
    for (const s of SHIRTS) {
      const file = path.join(PUBLIC, s.backPrintUrl);
      expect(existsSync(file), s.backPrintUrl).toBe(true);
      expect(statSync(file).size).toBeLessThan(80 * 1024);
      const svg = readFileSync(file, "utf8");
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"')).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });

  // The reverse colourway is rendered with a CSS invert, which is only exact
  // if every print uses nothing but pure black and pure white.
  it("prints are strictly two-colour, so the reverse colourway is an exact inversion", () => {
    for (const s of SHIRTS) {
      const svg = readFileSync(path.join(PUBLIC, s.backPrintUrl), "utf8");
      const colors = new Set(svg.match(/#[0-9A-Fa-f]{6}\b/g));
      for (const c of colors) expect(["#000000", "#FFFFFF"]).toContain(c.toUpperCase());
    }
  });

  it("looks up by id and prefixes asset urls", () => {
    expect(getShirtById(SHIRTS[42].id)).toBe(SHIRTS[42]);
    expect(getShirtById("nope")).toBeUndefined();
    expect(assetUrl("/prints/print_1.svg")).toMatch(/\/prints\/print_1\.svg$/);
  });

  it("the lean app index decodes to exactly the generator's catalog", () => {
    expect(SHIRTS).toHaveLength(FULL.length);
    FULL.forEach((f, i) => {
      const { description: _d, similar: _s, ...lean } = f;
      expect(SHIRTS[i]).toEqual(lean);
    });
  });

  it("product links point at the pre-rendered page by default", () => {
    expect(productHref("mono-0001")).toBe("/shop/mono-0001/");
    expect(productHref("mono-0001", "#variations")).toBe("/shop/mono-0001/#variations");
  });
});

describe("catalog copy (R13)", () => {
  it("titles carry no catalog number (that's `no`, 1–200 per category)", () => {
    for (const s of SHIRTS) {
      expect(s.title).not.toMatch(/No\.|#|\d{2,}/);
      expect(s.no).toBeGreaterThanOrEqual(1);
      expect(s.no).toBeLessThanOrEqual(200);
    }
    for (const c of SHIRT_CATEGORIES) {
      const nos = SHIRTS.filter((s) => s.category === c).map((s) => s.no);
      expect(new Set(nos).size).toBe(200);
    }
  });

  it("titles never repeat a word (\"Postcard Postcard\")", () => {
    for (const s of SHIRTS) {
      const words = s.title.split(" ");
      expect(new Set(words).size, s.title).toBe(words.length);
    }
  });

  it("no description repeats more than 3 times", () => {
    const counts = new Map<string, number>();
    for (const s of FULL) counts.set(s.description, (counts.get(s.description) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
    expect(counts.size).toBeGreaterThan(2000);
  });

  it("descriptions have no technical counts, and use a/an correctly", () => {
    const units = "dots?|lines?|families|family|mass(es)?|shapes?|bars?|circles?|rings?|stripes?|waves?|squares?|rays?|points?|characters?|blocks?|cells?|bays?|layers?|strokes?|stars?|peaks?";
    const count = new RegExp(`\\b\\d+\\s+(hand-set\\s+)?(${units})\\b`, "i");
    for (const s of FULL) {
      const text = narrative(s.description);
      expect(text, s.id).not.toMatch(count);
      expect(text, s.id).not.toMatch(/\b[Aa] [aeioAEIO][a-z]/);
      // Lowercase only: "an LED grid" is right.
      expect(text, s.id).not.toMatch(/\b[Aa]n [bcdfgjklmnpqrstvwxz][a-z]/);
      expect(text, s.id).not.toMatch(/\ba (coffee|tea)(?! cup| mug| pot)\b/i);
      // Sentences never run on: every one ends before the next begins.
      expect(s.description, s.id).toMatch(/[.!?…”)]$/);
    }
  });

  it("every category has a short vibe line", () => {
    for (const c of SHIRT_CATEGORIES) {
      expect(CATEGORY_VIBES[c].length).toBeGreaterThan(10);
      expect(CATEGORY_VIBES[c].length).toBeLessThan(90);
    }
  });
});

describe("detail shards (public/data)", () => {
  const shards = new Map<number, Record<string, { d: string; s: string[] }>>();
  const shard = (k: number) => {
    if (!shards.has(k)) shards.set(k, JSON.parse(readFileSync(path.join(PUBLIC, "data", `details-${k}.json`), "utf8")));
    return shards.get(k)!;
  };

  it("hold every design's description and similar list", () => {
    for (const f of FULL) {
      const entry = shard(Math.floor((f.n - 1) / 100))[f.id];
      expect(entry, f.id).toEqual({ d: f.description, s: f.similar });
    }
  });

  it("similar prints are other families, one per algorithm", () => {
    for (const f of FULL) {
      expect(f.similar.length).toBeGreaterThanOrEqual(4);
      const others = f.similar.map((id) => getShirtById(id)!);
      for (const o of others) expect(o.family).not.toBe(f.family);
      const variants = others.map((o) => o.variant);
      expect(new Set([f.variant, ...variants]).size).toBe(variants.length + 1);
    }
  });
});
