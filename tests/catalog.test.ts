import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHIRTS, assetUrl, getShirtById, productHref, shardFile, shardOf } from "@/lib/catalog";
import { isWeak } from "../scripts/gen/quality";
import retired from "@/data/curation/retired.json";
import { PRICE, TOTAL } from "../scripts/gen/constants";
import full from "@/data/shirts.json";
import { CATEGORY_LABELS, CATEGORY_VIBES, FEATURE_KEYS, SHIRT_CATEGORIES, SKU_CODES, isPhoto, type CatalogEntry } from "@/types/shirt";
import { displayCategory } from "../scripts/gen/categories";
import { W1 } from "./fixtures";

const FULL = full as unknown as CatalogEntry[];
/** Description text outside quoted captions (captions are the print's own words). */
const narrative = (d: string) => d.replace(/“[^”]*”/g, "“”").replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");

const PUBLIC = path.resolve(__dirname, "..", "public");

describe("generated catalog (data/shirts.json)", () => {
  it("TOTAL were generated and most of them retired (T7, content overhaul); ids increasing, never reused; unique skus and titles", () => {
    const n = SHIRTS.length;
    const firstSets = SHIRTS.filter((s) => s.n <= TOTAL).length;
    expect(firstSets).toBeLessThan(TOTAL * 0.6);
    // The curated retirements (data/curation/retired.json) are all gone.
    for (const id of Object.keys(retired)) expect(SHIRTS.some((s) => s.id === id), id).toBe(false);
    SHIRTS.forEach((s, i) => {
      expect(s.id).toBe(`mono-${String(s.n).padStart(4, "0")}`);
      if (i > 0) expect(s.n).toBeGreaterThan(SHIRTS[i - 1].n);
    });
    expect(new Set(SHIRTS.map((s) => s.sku)).size).toBe(n);
    expect(new Set(SHIRTS.map((s) => s.title)).size).toBe(n);
  });

  it("T7: none of the retired kinds is left (caricatures, pun icons, joke receipts / signs / quotes, 8-bit jokes, meme icons, novelty badges)", () => {
    const gone = /^(caricature-|objecticon|oddoneout|diagram|receipt|warning|quote|sprite|gamescreen|terminal$|ascii$|ascii-banner|ascii-art|badge|label|ticket|iconic-(anchor|astronaut|atom|dna|dove|earthrise|footprint|launch|palms|plane|ufo))/;
    expect(SHIRTS.filter((s) => gone.test(s.variant))).toEqual([]);
    // One photograph per subject (the fourth set's photographs).
    const full = FULL.filter((s) => s.variant.startsWith("photo-"));
    expect(new Set(full.map((s) => `${s.category}|${s.subject}`)).size).toBe(full.length);
  });

  it("is 70% black / 30% white tees in each drawn set; photographs take the tee that carries more of the picture", () => {
    // Generated 70/30 in each drawn set; after retiring designs, still close to it.
    for (const set of [SHIRTS.filter((s) => s.n <= 1000), SHIRTS.filter((s) => s.n > 1000 && s.n <= 2000), SHIRTS.filter((s) => s.n > 2000 && s.n <= 2800)]) {
      // A set the content overhaul cut to a handful says nothing about the split.
      if (set.length < 30) continue;
      const black = set.filter((s) => s.baseColor === "black").length / set.length;
      expect(black).toBeGreaterThan(0.5);
      expect(black).toBeLessThan(0.8);
    }
    const photos = SHIRTS.filter((s) => s.n > 2800 && s.n <= TOTAL);
    expect(photos.every(isPhoto)).toBe(true);
    expect(new Set(photos.map((s) => s.baseColor))).toEqual(new Set(["black", "white"]));
    // The fifth set (drawn) is 70/30 too, near enough after its faint prints were left out.
    const fifth = SHIRTS.filter((s) => s.n > TOTAL && s.variant.match(/^(sky|harmonograph|lissajous|lorenz|rossler|phyllotaxis|lsystem|guilloche|rosette|khatam)/));
    const black = fifth.filter((s) => s.baseColor === "black").length / fifth.length;
    expect(black).toBeGreaterThan(0.6);
    expect(black).toBeLessThan(0.8);
  });

  it("Part 4: the brand book's ten categories, in its order, each with depth and none swamping the shop", () => {
    expect([...SHIRT_CATEGORIES]).toEqual(["photographs", "specimens", "sky", "architecture", "etched", "brush", "pattern", "systems", "type", "terminal"]);
    expect(SHIRT_CATEGORIES.map((c) => CATEGORY_LABELS[c])).toEqual(["Photographs", "Plates & Specimens", "Maps & Sky", "Architecture", "Etched & Cut", "Brush & Woodblock", "Pattern", "Systems & Op Art", "Type", "Terminal"]);
    expect(SHIRT_CATEGORIES.map((c) => SKU_CODES[c])).toEqual(["PHO", "SPC", "MAP", "ARC", "ETC", "BRU", "PAT", "SYS", "TYP", "TRM"]);
    for (const c of SHIRT_CATEGORIES) {
      const count = SHIRTS.filter((s) => s.category === c).length;
      expect(count, c).toBeGreaterThanOrEqual(20);
      expect(count, c).toBeLessThan(SHIRTS.length * 0.3);
      expect(CATEGORY_LABELS[c].length).toBeGreaterThan(2);
      expect(SKU_CODES[c]).toMatch(/^[A-Z]{3}$/);
      expect(SHIRTS.filter((s) => s.category === c).every((s) => s.sku.startsWith(`MN-${SKU_CODES[c]}-`))).toBe(true);
    }
    expect(new Set(Object.values(SKU_CODES)).size).toBe(SHIRT_CATEGORIES.length);
  });

  it("T8: designs are filed by what they show, whichever generator made them", () => {
    expect(displayCategory("iconic", "iconic-landmark")).toBe("architecture");
    expect(displayCategory("geometric", "tiling")).toBe("pattern");
    expect(displayCategory("geometric", "concentric")).toBe("systems");
    expect(displayCategory("scenes", "mountains")).toBe("sky");
    expect(displayCategory("sky", "sky-figure")).toBe("sky");
    expect(displayCategory("flight", "")).toBe("photographs");
    expect(displayCategory("ascii", "ascii-shade")).toBe("terminal");
    expect(displayCategory("archive", "archive-botanical")).toBe("specimens");
    expect(displayCategory("archive", "archive-natural-history")).toBe("specimens");
    expect(displayCategory("archive", "archive-ink-painting")).toBe("brush");
    expect(displayCategory("archive", "archive-ukiyo-e")).toBe("brush");
    expect(displayCategory("archive", "archive-patent")).toBe("photographs");
    expect(displayCategory("archive", "archive-stencil")).toBe("pattern");
    // An etching is Etched & Cut, unless it shows a building or a city.
    expect(displayCategory("archive", "archive-etching", "Evening on the River")).toBe("etched");
    expect(displayCategory("archive", "archive-etching", "The Arch of Marcus Aurelius")).toBe("architecture");
    // In the data: every drawn template sits in one category (archive groups split off their buildings).
    const byVariant = new Map<string, Set<string>>();
    for (const s of SHIRTS.filter((x) => !x.variant.startsWith("archive-"))) byVariant.set(s.variant, (byVariant.get(s.variant) ?? new Set()).add(s.category));
    for (const [v, cats] of byVariant) expect(cats.size, v).toBe(1);
  });

  it("one flat price (PRICE) and features within [0, 1]", () => {
    for (const s of SHIRTS) {
      expect(s.price).toBe(PRICE);
      for (const k of FEATURE_KEYS) {
        expect(s.features[k]).toBeGreaterThanOrEqual(0);
        expect(s.features[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("feature vectors reflect the algorithm that drew each print", () => {
    const mean = (variants: RegExp, key: (typeof FEATURE_KEYS)[number]) => {
      const list = SHIRTS.filter((s) => variants.test(s.variant));
      expect(list.length, String(variants)).toBeGreaterThan(0);
      return list.reduce((sum, s) => sum + s.features[key], 0) / list.length;
    };
    expect(mean(/^(facade|perspective|skyline|slabs)$/, "architectural")).toBeGreaterThan(0.75);
    expect(mean(/^(concentric|tiling|monoform)$/, "geometric")).toBeGreaterThan(0.75);
    expect(mean(/^type-data$/, "typography")).toBeGreaterThan(0.85);
    expect(mean(/^(radial|gradient|matrix|stipple)$/, "halftone_raster")).toBeGreaterThan(0.8);
    expect(mean(/^(interference|contours)$/, "line_art")).toBeGreaterThan(0.8);
    expect(mean(/^(celestial|seascape)$/, "nature")).toBeGreaterThan(0.65);
    expect(mean(/^(ascii-scene|ascii-shade|terminal-data)$/, "retro")).toBeGreaterThan(0.8);
    expect(mean(/^(arch|brick-bond|truss|orders|modulor)$/, "architectural")).toBeGreaterThan(0.85);
    // the fifth and sixth sets
    expect(mean(/^(harmonograph|lissajous|lorenz|rossler)$/, "line_art")).toBeGreaterThan(0.8);
    expect(mean(/^(phyllotaxis|lsystem-)/, "nature")).toBeGreaterThan(0.65);
    expect(mean(/^(guilloche|rosette|khatam)$/, "geometric")).toBeGreaterThan(0.75);
    expect(mean(/^sky-/, "nature")).toBeGreaterThan(0.5);
    expect(mean(/^archive-botanical$/, "nature")).toBeGreaterThan(0.9);
    expect(mean(/^archive-(etching|woodcut|gallery-print)$/, "classic")).toBeGreaterThan(0.55);
    // the new dimensions stay low on the original abstract families
    expect(mean(/^(concentric|tiling|monoform)$/, "wit")).toBeLessThan(0.1);
    expect(mean(/^(facade|perspective|skyline|slabs)$/, "nature")).toBeLessThan(0.1);
    expect(mean(/^(interference|contours)$/, "typography")).toBeLessThan(0.1);
    // only photographs are photographic
    expect(mean(/^archive-(ink-painting|etching|botanical|ornament)$/, "photographic")).toBe(0);
  });

  it("every drawn print exists on disk as a valid 3:4 SVG (photographs: tests/photos)", () => {
    for (const s of SHIRTS.filter((x) => x.medium === "drawn")) {
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
  it("drawn prints are strictly two-colour, so the reverse colourway is an exact inversion", () => {
    for (const s of SHIRTS.filter((x) => x.medium === "drawn")) {
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
      const { description: _d, similar: _s, subject: _t, printCm: _p, photo: _c, summary: _u, style: _y, quality: _q, flags: _f, dropDate, ...lean } = f;
      expect(SHIRTS[i]).toEqual({ ...lean, dropDate: Date.parse(`${dropDate}T00:00:00Z`), weak: isWeak(f) });
    });
  });

  it("product links point at the pre-rendered page by default", () => {
    expect(productHref(W1)).toBe(`/shop/${W1}/`);
    expect(productHref(W1, "#variations")).toBe(`/shop/${W1}/#variations`);
  });
});

describe("catalog copy (R13)", () => {
  it("titles carry no catalog number (that's `no`, 1–N per category)", () => {
    for (const s of SHIRTS) {
      // No catalogue number, and no numeral added to tell repeats apart (Part 5); a date or a figure in what it names stays
      // ("Moon Phases of 1969", "Pi to 500 Places"; an archive work's own "Plate IX").
      expect(s.title, s.id).not.toMatch(/No\.|#/);
      if (s.medium === "drawn") expect(s.title, s.id).not.toMatch(/\s(II|III|IV|V|VI|VII|VIII|IX|X)$/);
      expect(s.no).toBeGreaterThanOrEqual(1);
    }
    for (const c of SHIRT_CATEGORIES) {
      const nos = SHIRTS.filter((s) => s.category === c).map((s) => s.no);
      expect(nos).toEqual(nos.map((_, i) => i + 1)); // renumbered 1…N after retiring
    }
  });

  it("titles never repeat a word (\"Postcard Postcard\")", () => {
    // Generated names (an archive work keeps its record's title: "Molds for Casting Blocks for Printing").
    for (const s of SHIRTS.filter((x) => !x.variant.startsWith("archive-"))) {
      const words = s.title.split(" ");
      expect(new Set(words).size, s.title).toBe(words.length);
    }
  });

  it("no description repeats more than 3 times", () => {
    const counts = new Map<string, number>();
    for (const s of FULL) counts.set(s.description, (counts.get(s.description) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
    expect(counts.size).toBeGreaterThan(FULL.length * 0.75);
  });

  it("descriptions have no technical counts, and use a/an correctly", () => {
    const units = "dots?|lines?|families|family|mass(es)?|shapes?|bars?|circles?|rings?|stripes?|waves?|squares?|rays?|points?|characters?|blocks?|cells?|bays?|layers?|strokes?|stars?|peaks?";
    const count = new RegExp(`\\b\\d+\\s+(hand-set\\s+)?(${units})\\b`, "i");
    for (const s of FULL) {
      // A photograph's subject is a proper name ("A-7-A In-line 4 Engine"): only the prose around it counts.
      const text = narrative(s.photo ? s.description.replace(s.subject, "") : s.description);
      expect(text, s.id).not.toMatch(count);
      // ("a one-ink halftone": one is said with a w.)
      expect(text, s.id).not.toMatch(/\b[Aa] (?!one\b|one-)[aeioAEIO][a-z]/);
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
  // File names and size come from the index head (R21), not from constants here.
  const shards = new Map<number, Record<string, { d: string; s: string[] }>>();
  const shard = (k: number) => {
    if (!shards.has(k)) shards.set(k, JSON.parse(readFileSync(path.join(PUBLIC, shardFile(k)), "utf8")));
    return shards.get(k)!;
  };

  it("hold every design's description, similar list, subject and print size (and a photograph's credit)", () => {
    for (const f of FULL) {
      const entry = shard(shardOf(f))[f.id];
      expect(entry, f.id).toEqual({ d: f.description, s: f.similar, t: f.subject, p: [f.printCm.width, f.printCm.height], ...(f.photo ? { c: f.photo.credit, u: f.photo.url } : {}) });
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
