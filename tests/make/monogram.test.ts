import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/monogram";
import { GLYPHS } from "@/lib/custom/draw/monogram";
import { MONO_STYLES, PRODUCT, check, initialsProblem } from "@/lib/custom/specs/monogram";
import { decodeMake, encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: unknown) => validate({ t: "monogram", v: 1, p });
const ex: CustomSpec = { t: "monogram", v: 1, p: PRODUCT.example };
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

describe("Your Monogram: the spec", () => {
  it("accepts the example, keeps its keys in order, drops unknown keys", () => {
    expect(spec(PRODUCT.example)).toEqual(ex);
    expect(JSON.stringify(check({ y: 1990, s: "lace", x: "AB", z: 1 }, {}))).toBe('{"x":"AB","s":"lace","y":1990}');
  });
  it("rejects wrong types, ranges, spellings and limits", () => {
    for (const p of [{}, { x: "A", s: "lace" }, { x: "ABCD", s: "lace" }, { x: "ab", s: "lace" }, { x: "A B", s: "lace" }, { x: "ÉB", s: "lace" }, { x: "AB" }, { x: "AB", s: "round" }, { x: "AB", s: "lace", y: 1899 }, { x: "AB", s: "lace", y: 2101 }, { x: "AB", s: "lace", y: "1990" }, { x: "AB", s: "lace", y: 1990.5 }, { x: ["A", "B"], s: "lace" }])
      expect(spec(p), JSON.stringify(p)).toBeNull();
  });
  it("says what's wrong with the initials in one line", () => {
    expect(initialsProblem("n.d.")).toBeNull();
    expect(initialsProblem("É")).toBe('Letters A to Z only. Try "E".');
    expect(initialsProblem("ABCD")).toBe("Two or three letters.");
  });
  it("fits a link", () => {
    const big = spec({ x: "WMW", s: "stack", y: 2100 })!;
    const link = encodeMake(big);
    expect(decodeMake(link)).toEqual(big);
    expect(link.length).toBeLessThanOrEqual(79);
  });
  it("draws every capital", () => {
    for (const c of AZ) expect(GLYPHS[c], c).toBeDefined();
  });
});

describe("Your Monogram: the template", () => {
  it("is deterministic", () => {
    expect(render(ex, "black")).toBe(render(ex, "black"));
  });
  it("writes only what the canvas preview draws, one ink and the ground", () => {
    for (const s of MONO_STYLES) {
      const svg = render(spec({ x: "QRS", s, y: 1984 })!, "white");
      expect(svg).not.toMatch(/clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/);
      expect(new Set(svg.match(/#[0-9A-Fa-f]{6}/g))).toEqual(new Set(["#FFFFFF", "#000000"]));
    }
  });
  it("the example passes the gate on both tees", () => {
    for (const color of ["black", "white"] as const) expect(gate(render(ex, color), color)).toBeNull();
  });
  it("every letter in every place and arrangement, with and without a year: all pass the gate", () => {
    const rnd = mulberry32(0x3090);
    const pick = () => AZ[Math.floor(rnd() * 26)];
    const xs = ["II", "IJ", "WW", "WMW", "OQ", "QQQ", "III", "LT", "MM", "SS", "AV", "XX"];
    // Each letter first, middle and last at least once.
    for (let k = 0; k < 26; k++) xs.push(AZ[k] + pick(), pick() + AZ[k] + pick(), pick() + AZ[k]);
    for (let k = 0; k < 20; k++) xs.push(pick() + pick() + (rnd() < 0.5 ? pick() : ""));
    const failures: string[] = [];
    let n = 0;
    for (const x of xs)
      for (const s of MONO_STYLES) {
        const r = rnd();
        const sp = spec({ x, s, ...(r < 0.5 ? { y: 1900 + Math.floor(rnd() * 201) } : {}) });
        expect(sp, x).not.toBeNull();
        const colors: ("black" | "white")[] = n++ % 4 ? ["black"] : ["black", "white"];
        for (const color of colors) {
          const bad = gate(render(sp!, color), color);
          if (bad) failures.push(`${JSON.stringify(sp!.p)} ${color}: ${bad}`);
        }
      }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 900_000);
});
