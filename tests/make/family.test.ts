import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/family";
import { FAMILY_NAME_MAX, PRODUCT, check, familyYears, packYears, parseYears, yearsProblem, type Years } from "@/lib/custom/specs/family";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { wordsProblem } from "@/lib/custom/lexicon";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "family", v: 1, p });
const ex = PRODUCT.example;
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const years = (ys: Years[]) => packInts(packYears(ys));
const seven = ["Noa", "David", "Ruth", "", "", "", ""];

describe("Your Family Tree: the spec", () => {
  it("accepts the example and drops unknown keys, in a fixed key order", () => {
    expect(check(ex as never, {})).toEqual(ex);
    expect(ok({ ...ex, zz: 1 })).toEqual({ t: "family", v: 1, p: ex });
    expect(Object.keys(ok({ w: "The Levins", y: ex.y, n: ex.n })!.p)).toEqual(["n", "y", "w"]);
    expect(ok({ n: seven })).toEqual({ t: "family", v: 1, p: { n: seven } });
  });
  it("reads years back as they were packed", () => {
    const ys: Years[] = [[1991, null], [null, 2001], [1960, 2020], [null, null], [null, null], [null, null], [1600, 1720]];
    const p = { n: ["A", "B", "C", "", "", "", "G"], y: years(ys) };
    expect(ok(p)).not.toBeNull();
    expect(familyYears(p)).toEqual(ys);
    expect(parseYears("1932–2010")).toEqual([1932, 2010]);
    expect(parseYears(" 1932 - ")).toEqual([1932, null]);
    expect(parseYears("-2010")).toEqual([null, 2010]);
    expect(parseYears("")).toEqual([null, null]);
    expect(parseYears("32")).toBeNull();
    expect(parseYears("–")).toBeNull();
    expect(yearsProblem([1990, 1980])).not.toBeNull();
    expect(yearsProblem([1800, 1921])).not.toBeNull();
    expect(yearsProblem([1599, null])).not.toBeNull();
  });
  it("rejects wrong types, ranges, unknown values, non-canonical forms and over-limit inputs", () => {
    const blank7: Years[] = Array(7).fill([null, null]);
    const bad: unknown[] = [
      {},
      { n: "Noa" },
      { n: ["Noa"] },
      { n: [...seven, ""] },
      { n: Array(16).fill("A") },
      { n: ["", "David", "Ruth", "", "", "", ""] },
      { n: ["Noa", 1, "", "", "", "", ""] },
      { n: ["Noa", null, "", "", "", "", ""] },
      { n: ["Noa", " David", "", "", "", "", ""] },
      { n: ["Noa", "David  Levin", "", "", "", "", ""] },
      { n: ["Noa", "W".repeat(FAMILY_NAME_MAX + 1), "", "", "", "", ""] },
      { n: ["Noa", "Dav☃d", "", "", "", "", ""] },
      { n: ["Noa", "<b>", "", "", "", "", ""] },
      { n: seven, y: years(blank7) },
      { n: seven, y: years([[1991, null], ...blank7.slice(1)]) + "A" },
      { n: seven, y: years([[1991, null], ...blank7.slice(2)]) },
      { n: seven, y: years([[1991, null], ...blank7.slice(1), [null, null]]) },
      { n: seven, y: years([...blank7.slice(0, 3), [1930, null], ...blank7.slice(4)]) },
      { n: seven, y: years([[1991, 1980], ...blank7.slice(1)]) },
      { n: seven, y: years([[1800, 1950], ...blank7.slice(1)]) },
      { n: seven, y: years([[2101, null], ...blank7.slice(1)]) },
      { n: seven, y: packInts([-5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
      { n: seven, y: 12 },
      { n: seven, y: "" },
      { n: seven, y: "not packed!" },
      { n: seven, w: "" },
      { n: seven, w: " Levins" },
      { n: seven, w: "x".repeat(29) },
    ];
    for (const p of bad) expect(ok(p), JSON.stringify(p)).toBeNull();
  });
  it("refuses a brand through the lexicon (the editor's check)", () => {
    expect(wordsProblem("N1KE")).not.toBeNull();
    expect(wordsProblem("Miriam Katz")).toBeNull();
  });
});

describe("Your Family Tree: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok(ex)!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
    // Groups only rotate; every text states its font.
    for (const m of svg.matchAll(/transform="([^"]*)"/g)) expect(m[1]).toMatch(/^rotate\([-\d.]+ [-\d.]+ [-\d.]+\)$/);
    expect(svg).not.toMatch(/<(?!\/?(svg|rect|circle|line|path|text|g)\b)[a-z]/);
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(ex)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link fits", () => {
    const longest = { n: Array(15).fill("W".repeat(FAMILY_NAME_MAX)), y: years(Array(15).fill([1980, 2100])), w: "W".repeat(28) };
    const len = encodeMake(ok(longest)!).length;
    console.log(`family: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(1000);
  });
  it("three or four generations, any names, blanks and years: all pass the gate", () => {
    const rnd = mulberry32(0xfa3117);
    const NAMES = ["Noa", "A", "Jo", "Ida Blum", "Miriam Katz", "Samuel Levin", "WWWWWWWWWWWWWW", "MMMMMMM MMMMMM", "Li", "Aurélie Dubois", "Zoë", "O'Neill", "Jean-Luc Roy", "Fatima Haddad", "iiiiiiiiiiiiii"];
    const pick = () => NAMES[Math.floor(rnd() * NAMES.length)];
    const W14 = "WWWWWWW WWWWWW";
    const raws: Record<string, unknown>[] = [
      { n: Array(15).fill(W14), y: years(Array(15).fill([1900, 2020])), w: "W".repeat(28) },
      { n: Array(15).fill("W".repeat(14)), y: years(Array(15).fill([1900, 2020])) },
      { n: Array(7).fill("M".repeat(14)), y: years(Array(7).fill([1900, 2020])), w: "W" },
      { n: Array(15).fill("A") },
      { n: Array(7).fill("A"), y: years(Array(7).fill([null, 1600])) },
      { n: ["N", ...Array(14).fill("")] },
      { n: ["Noa", ...Array(6).fill("")] },
      { n: [W14, ...Array(14).fill("")], y: years([[1900, 2020], ...Array(14).fill([null, null])]) },
      { n: ["Noa", ...Array(6).fill(""), ...Array(8).fill(W14)], y: years([[2000, null], ...Array(6).fill([null, null]), ...Array(8).fill([1850, 1930])]) },
    ];
    for (let i = 0; i < 160; i++) {
      const len = rnd() < 0.5 ? 7 : 15;
      const blank = rnd() * 0.6;
      const n = Array.from({ length: len }, (_, k) => (k === 0 || rnd() > blank ? pick() : ""));
      const withYears = rnd() < 0.6;
      const ys: Years[] = n.map((nm) => {
        if (!nm || !withYears || rnd() < 0.2) return [null, null];
        const b = 1600 + Math.floor(rnd() * 480);
        const kind = rnd();
        return kind < 0.5 ? [b, Math.min(2100, b + Math.floor(rnd() * 100))] : kind < 0.8 ? [b, null] : [null, b];
      });
      const y = ys.some(([b, d]) => b !== null || d !== null) ? { y: years(ys) } : {};
      raws.push({ n, ...y, ...(rnd() < 0.3 ? { w: "The Levins" } : {}) });
    }
    const failures: string[] = [];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const svg = render(spec, c);
        expect(svg).not.toMatch(FORBIDDEN);
        const bad = gate(svg, c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
