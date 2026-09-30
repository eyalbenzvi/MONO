import { describe, expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { DIET_MAX, DINO_NAME_MAX, ENDINGS, HEIGHT_MAX, HEIGHT_MIN, PLATES, SPECIES, genusOf, isGenus, scientificName, stemOf } from "@/lib/custom/specs/dinosaur";
import art from "../../data/art/dinosaurs.json";
import { ART } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xd1e0);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const fuzz: Record<string, unknown>[] = [
  ...PLATES.map((k) => ({ n: "Al", k })),
  ...PLATES.map((k) => ({ n: W(DINO_NAME_MAX), k, e: "ceratops", s: "gloriosus", y: 2100, h: HEIGHT_MAX, d: W(DIET_MAX) })),
  ...PLATES.map((k) => ({ n: "Noa", k, h: HEIGHT_MIN })),
];
for (let i = 0; i < 24; i++)
  fuzz.push({ n: pick(["Maya", "Tom", "Zoë", "Jean-Luc", "Ben", "Ada"]), k: pick(PLATES), ...(rnd() < 0.5 ? { e: pick(ENDINGS) } : {}), ...(rnd() < 0.5 ? { s: pick(Object.keys(SPECIES)) } : {}), ...(rnd() < 0.6 ? { y: 1990 + Math.floor(rnd() * 36) } : {}), ...(rnd() < 0.6 ? { h: HEIGHT_MIN + Math.floor(rnd() * (HEIGHT_MAX - HEIGHT_MIN)) } : {}), ...(rnd() < 0.5 ? { d: pick(["pasta", "toast", "nothing green"]) } : {}) });

productSuite({
  slug: "dinosaur",
  refuse: [
    {}, { n: "Al" }, { k: "triceratops" }, { n: "A", k: "triceratops" }, { n: "Al", k: "dodo" }, { n: "Al", k: "triceratops", e: "ops" }, { n: "Al", k: "triceratops", s: "toString" },
    { n: "Al", k: "triceratops", h: HEIGHT_MIN - 1 }, { n: "Al", k: "triceratops", h: 100.5 }, { n: "Al", k: "triceratops", y: 1800 }, { n: W(DINO_NAME_MAX + 1), k: "triceratops" }, { n: "Al", k: "triceratops", d: W(DIET_MAX + 1) }, { n: "12", k: "triceratops" },
  ],
  longest: { n: "Ã".repeat(DINO_NAME_MAX), k: "tyrannosaurus", e: "ceratops", s: "gloriosus", y: 2026, h: 220, d: "Ã".repeat(DIET_MAX) },
  fuzz,
});

describe("dinosaur names", () => {
  it("are built from the first name, joined as names are", () => {
    expect(stemOf("Zoë Levi")).toBe("Zoe");
    expect(genusOf("Tom", "saurus")).toBe("Tomosaurus");
    expect(genusOf("Tom", "don")).toBe("Tomodon");
    expect(genusOf("Tom", "raptor")).toBe("Tomraptor");
    expect(genusOf("Maya", "ceratops")).toBe("Mayaceratops");
    expect(scientificName({ n: "Maya", k: "triceratops", s: "horridus" })).toBe("Mayaceratops horridus");
  });
  it("are never an existing genus exactly (Noasaurus is taken)", () => {
    expect(isGenus("Noasaurus")).toBe(true);
    expect(genusOf("Noa", "saurus")).toBe("Noaosaurus");
    for (const n of ["Noa", "Tyranno", "Stego", "Bronto", "Allo", "Diplo", "Iguano", "Pterano", "Masia", "Maia"]) for (const e of ENDINGS) expect(isGenus(genusOf(n, e)), `${n} ${e}`).toBe(false);
  });
});

describe("dinosaur plates", () => {
  it("every plate is traced, public domain, sourced, and drawn whole in the print", () => {
    expect(art.map((a) => a.id).sort()).toEqual([...PLATES].sort());
    for (const a of art as { id: string; license: string; source: { record: string; author: string; year: number } }[]) {
      expect(["PD", "US-Gov", "CC0", "PDM"]).toContain(a.license);
      expect(a.source.record).toMatch(/^https:\/\/archive\.org\/details\//);
      expect(a.source.year).toBeLessThan(1929);
      expect(ART[`dinosaurs/${a.id}`]?.rings.length).toBeGreaterThan(50);
    }
  });
});
