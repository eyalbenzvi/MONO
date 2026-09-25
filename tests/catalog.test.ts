import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHIRTS, assetUrl, getShirtById } from "@/lib/catalog";
import { FEATURE_KEYS, SHIRT_CATEGORIES } from "@/types/shirt";

const PUBLIC = path.resolve(__dirname, "..", "public");

describe("generated catalog (data/shirts.json)", () => {
  it("has 2,000 shirts with unique ids, skus and titles", () => {
    expect(SHIRTS).toHaveLength(2000);
    expect(new Set(SHIRTS.map((s) => s.id)).size).toBe(2000);
    expect(new Set(SHIRTS.map((s) => s.sku)).size).toBe(2000);
    expect(new Set(SHIRTS.map((s) => s.title)).size).toBe(2000);
  });

  it("is 70% black / 30% white tees in each set of 1,000", () => {
    for (const set of [SHIRTS.slice(0, 1000), SHIRTS.slice(1000)]) {
      expect(set.filter((s) => s.baseColor === "black")).toHaveLength(700);
      expect(set.filter((s) => s.baseColor === "white")).toHaveLength(300);
    }
  });

  it("has ten categories, 200 designs each (the second 1,000 adds five new ones)", () => {
    expect(SHIRT_CATEGORIES).toHaveLength(10);
    const newCats = new Set(SHIRTS.slice(1000).map((s) => s.category));
    expect([...newCats].sort()).toEqual(["emblems", "objects", "pixel", "scenes", "slogans"]);
  });

  it("covers all generative categories evenly", () => {
    for (const c of SHIRT_CATEGORIES) expect(SHIRTS.filter((s) => s.category === c)).toHaveLength(200);
  });

  it("prices within $39–$59 and features within [0, 1]", () => {
    for (const s of SHIRTS) {
      expect(s.price).toBeGreaterThanOrEqual(39);
      expect(s.price).toBeLessThanOrEqual(59);
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
});
