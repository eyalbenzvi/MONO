import { describe, expect, it } from "vitest";
import { islandGround, render } from "@/lib/custom/templates/island";
import { ISLAND_NAME_MAX, ISLAND_PLACES, ISLAND_PLACE_MAX, ISLAND_REDRAWS, PRODUCT, check } from "@/lib/custom/specs/island";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { wordsProblem } from "@/lib/custom/lexicon";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const ex = PRODUCT.example;
const spec = (p: object) => validate({ t: "island", v: 1, p });

describe("Your Island: the spec", () => {
  it("accepts the example, and keeps only known keys in order", () => {
    expect(check(ex as unknown as Record<string, unknown>, {})).toEqual(ex);
    expect(JSON.stringify(spec({ s: 3, x: ["Noa"], q: 1, n: "Isle" }))).toBe(JSON.stringify({ t: "island", v: 1, p: { n: "Isle", x: ["Noa"], s: 3 } }));
    expect(spec({ n: "A" })).not.toBeNull();
  });
  it("refuses wrong types, ranges and untidy names", () => {
    const bad: object[] = [
      {},
      { n: 5 },
      { n: "" },
      { n: " Isle" },
      { n: "Isle  of Levi" },
      { n: "x".repeat(ISLAND_NAME_MAX + 1) },
      { n: "島" },
      { n: "Isle", x: [] },
      { n: "Isle", x: "Noa" },
      { n: "Isle", x: ["Noa", ""] },
      { n: "Isle", x: ["x".repeat(ISLAND_PLACE_MAX + 1)] },
      { n: "Isle", x: Array(ISLAND_PLACES + 1).fill("Noa") },
      { n: "Isle", x: [3] },
      { n: "Isle", s: 0 },
      { n: "Isle", s: ISLAND_REDRAWS + 1 },
      { n: "Isle", s: 1.5 },
    ];
    for (const p of bad) expect(spec(p), JSON.stringify(p)).toBeNull();
  });
  it("the editor's words go through the lexicon", () => {
    expect(wordsProblem("N1KE Island")).not.toBeNull();
    expect(wordsProblem(ex.n)).toBeNull();
  });
});

describe("Your Island: the print", () => {
  it("is deterministic, resamples into the band, and uses only what the preview draws", () => {
    const s = { t: "island", v: 1, p: ex } as CustomSpec;
    const a = render(s, "black");
    expect(a).toBe(render(s, "black"));
    expect(a).not.toMatch(FORBIDDEN);
    // Every name lands an island in the band, whatever its first seed made.
    for (let i = 0; i < 40; i++) {
      const g = islandGround(`Island ${i}`);
      expect(g.area, `Island ${i}`).toBeGreaterThanOrEqual(0.27);
      expect(g.area, `Island ${i}`).toBeLessThanOrEqual(0.45);
      expect(g.compact, `Island ${i}`).toBeGreaterThanOrEqual(0.16);
    }
    // Another island from the same name is another island.
    expect(render({ t: "island", v: 1, p: { ...ex, s: 1 } } as CustomSpec, "black")).not.toBe(a);
  });
  it("the example passes in both colours", () => {
    const s = { t: "island", v: 1, p: ex } as CustomSpec;
    expect(gate(render(s, "black"), "black")).toBeNull();
    expect(gate(render(s, "white"), "white")).toBeNull();
  });
  it("the longest link fits", () => {
    const s = spec({ n: "W".repeat(ISLAND_NAME_MAX), x: Array(ISLAND_PLACES).fill("W".repeat(ISLAND_PLACE_MAX)), s: ISLAND_REDRAWS })!;
    const n = encodeMake(s).length;
    console.log(`Your Island: longest ?make= ${n} characters (example ${encodeMake({ t: "island", v: 1, p: ex } as CustomSpec).length})`);
    expect(n).toBeLessThan(300);
  });
  it("fuzz: one letter to the longest names, no places to six, redraws: all pass the gate", () => {
    const rnd = mulberry32(0x151a4d);
    const L = "abcdefghijklmnopqrstuvwxyzéøł";
    const word = (n: number) => (L[Math.floor(rnd() * 26)].toUpperCase() + Array.from({ length: n - 1 }, () => L[Math.floor(rnd() * L.length)]).join("")).slice(0, n);
    const samples: object[] = [
      { n: "A" },
      { n: "W".repeat(ISLAND_NAME_MAX), x: Array(ISLAND_PLACES).fill("W".repeat(ISLAND_PLACE_MAX)) },
      { n: "M".repeat(ISLAND_NAME_MAX), x: Array(ISLAND_PLACES).fill("M"), s: ISLAND_REDRAWS },
      { n: "Q", x: ["I"], s: 1 },
      { n: "Isle of Levi", x: ["Bartholomew-Jo", "Evangeline Ros", "Maximilianus", "Christabelle", "Wilhelmina", "Konstantinos"] },
    ];
    for (let i = 0; i < 115; i++) {
      const k = Math.floor(rnd() * (ISLAND_PLACES + 1));
      samples.push({ n: word(1 + Math.floor(rnd() * ISLAND_NAME_MAX)), ...(k ? { x: Array.from({ length: k }, () => word(1 + Math.floor(rnd() * ISLAND_PLACE_MAX))) } : {}), ...(rnd() < 0.4 ? { s: 1 + Math.floor(rnd() * ISLAND_REDRAWS) } : {}) });
    }
    const failures: string[] = [];
    let n = 0;
    samples.forEach((p, i) => {
      const s = spec(p);
      expect(s, JSON.stringify(p)).not.toBeNull();
      for (const color of i % 4 === 0 ? (["black", "white"] as const) : ([i % 2 ? "white" : "black"] as const)) {
        n++;
        const bad = gate(render(s!, color), color);
        if (bad) failures.push(`${JSON.stringify(p)} ${color}: ${bad}`);
      }
    });
    expect(n).toBeGreaterThan(55);
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
