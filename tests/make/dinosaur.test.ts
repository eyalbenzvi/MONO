import { describe, expect, it } from "vitest";
import { FORBIDDEN, productSuite, specOf } from "./productSuite";
import { gate } from "./fuzz";
import { drawSpec } from "./render";
import { DIET_MAX, DINO_NAME_MAX, ENDINGS, HEIGHT_MAX, HEIGHT_MIN, PLATES, SPECIES, genusOf, isGenus, scientificName, stemOf } from "@/lib/custom/specs/dinosaur";
import { DINOSAURS, dinosaur } from "@/lib/custom/draw/dinosaurs";
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
  it("draw a skeleton for every plate the spec offers", () => {
    expect([...DINOSAURS].sort()).toEqual([...PLATES].sort());
  });
  it("each skeleton is drawn the same every time, in markup the preview draws, standing in its box", () => {
    for (const k of PLATES) {
      const a = dinosaur(k, 30, 58, 240, 168);
      expect(a.svg, k).not.toMatch(FORBIDDEN);
      expect(a.svg, k).not.toMatch(/transform=/);
      expect(a.svg.length, k).toBeGreaterThan(5000);
      expect(a.h, k).toBeGreaterThan(30);
      expect(a.h, k).toBeLessThanOrEqual(168);
      // Every point inside the box.
      for (const [, x, y] of a.svg.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
        expect(Number(x), k).toBeGreaterThanOrEqual(29);
        expect(Number(x), k).toBeLessThanOrEqual(271);
        expect(Number(y), k).toBeGreaterThanOrEqual(57);
        expect(Number(y), k).toBeLessThanOrEqual(227);
      }
    }
    // Remembered, and drawn again from scratch the same (a box it hasn't seen before).
    expect(dinosaur("triceratops", 30, 58, 240, 168)).toBe(dinosaur("triceratops", 30, 58, 240, 168));
    expect(dinosaur("triceratops", 31, 58, 240, 168).svg).toBe(dinosaur("triceratops", 30, 58, 240, 168).svg.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => `${Math.round((Number(x) + 1) * 10) / 10} ${y}`));
  });
  it("each skeleton's plate alone passes the gate in both colours", async () => {
    for (const k of PLATES)
      for (const color of ["black", "white"] as const) {
        expect(gate(await drawSpec(specOf("dinosaur", { n: "Al", k })!, color), color), `${k} ${color}`).toBeNull();
      }
  });
});
