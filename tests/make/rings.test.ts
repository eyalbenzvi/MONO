import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/rings";
import { PRODUCT, check } from "@/lib/custom/specs/rings";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "rings", v: 1, p });
const ex = PRODUCT.example;
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;

describe("Your Tree Rings: the spec", () => {
  it("accepts the example, drops unknown keys, keeps a fixed key order", () => {
    expect(check(ex as never, {})).toEqual(ex);
    expect(ok({ ...ex, q: 1 })).toEqual({ t: "rings", v: 1, p: ex });
    expect(Object.keys(ok({ w: "Noa", s: [2000], m: "1".repeat(39), c: 2026, b: 1988 })!.p)).toEqual(["b", "c", "m", "s", "w"]);
  });
  it("rejects wrong types, ranges, unknown values, non-canonical forms and over-limit inputs", () => {
    const m = (n: number) => "1".repeat(n);
    for (const p of [
      { b: "1988", c: 2026, m: m(39) },
      { b: 1988.5, c: 2026, m: m(39) },
      { b: 1899, c: 1910, m: m(12) },
      { b: 2090, c: 2101, m: m(12) },
      { b: 2026, c: 2025, m: m(0) },
      { b: 1900, c: 2001, m: m(102) },
      { b: 1988, c: 2026, m: m(38) },
      { b: 1988, c: 2026, m: m(40) },
      { b: 1988, c: 2026, m: `${m(38)}3` },
      { b: 1988, c: 2026, m: `${m(38)}g` },
      { b: 1988, c: 2026, m: 111 },
      { b: 1988, c: 2026, m: m(39), s: [] },
      { b: 1988, c: 2026, m: m(39), s: 2009 },
      { b: 1988, c: 2026, m: m(39), s: [1987] },
      { b: 1988, c: 2026, m: m(39), s: [2027] },
      { b: 1988, c: 2026, m: m(39), s: [2010, 2009] },
      { b: 1988, c: 2026, m: m(39), s: [2009, 2009] },
      { b: 1988, c: 2026, m: m(39), s: [1990, 2000, 2010, 2020] },
      { b: 1988, c: 2026, m: m(39), s: ["2009"] },
      { b: 1988, c: 2026, m: m(39), w: "" },
      { b: 1988, c: 2026, m: m(39), w: "x".repeat(29) },
      { b: 1988, c: 2026 },
    ])
      expect(ok(p), JSON.stringify(p)).toBeNull();
    expect(ok({ b: 1900, c: 2000, m: m(101) })).not.toBeNull();
    expect(ok({ b: 2100, c: 2100, m: "2" })).not.toBeNull();
  });
});

describe("Your Tree Rings: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok(ex)!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(ex)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link (101 years, three scars, the words) fits", () => {
    const len = encodeMake(ok({ b: 1926, c: 2026, m: "2".repeat(101), s: [1950, 1980, 2020], w: "W".repeat(28) })!).length;
    console.log(`rings: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(300);
  });
  it("one ring to a hundred and one, any marks, scars anywhere: all pass the gate", () => {
    const rnd = mulberry32(0x41265);
    const marks = (n: number, pick: () => string) => Array.from({ length: n }, pick).join("");
    const raws: Record<string, unknown>[] = [];
    // The edges: one ring, two, a century of each mark, a century alternating, scars at the pith and the bark.
    for (const d of ["0", "1", "2"]) raws.push({ b: 2026, c: 2026, m: d }, { b: 1926, c: 2026, m: d.repeat(101) }, { b: 2024, c: 2025, m: d.repeat(2) });
    raws.push({ b: 1900, c: 2000, m: marks(101, () => "02"[raws.length % 2]), s: [1900, 1950, 2000], w: "W".repeat(28) });
    raws.push({ b: 1926, c: 2026, m: "0".repeat(50) + "2".repeat(51), s: [1926, 1927, 1928] });
    raws.push({ b: 2020, c: 2026, m: "0000000", s: [2020, 2023, 2026] });
    raws.push({ b: 2000, c: 2100, m: "2".repeat(101), s: [2098, 2099, 2100] });
    for (let i = 0; i < 110; i++) {
      const n = 1 + Math.floor(rnd() ** 0.7 * 101);
      const b = 1900 + Math.floor(rnd() * (201 - n));
      const bias = rnd();
      const m = marks(n, () => (rnd() < bias * 0.5 ? "0" : rnd() < 0.5 ? "1" : "2"));
      const k = Math.floor(rnd() * 4);
      const s = [...new Set(Array.from({ length: k }, () => b + Math.floor(rnd() * n)))].sort((x, y) => x - y);
      raws.push({ b, c: b + n - 1, m, ...(s.length ? { s } : {}), ...(rnd() < 0.3 ? { w: "Noa, so far" } : {}) });
    }
    const failures: string[] = [];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const bad = gate(render(spec, c), c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
