import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/orbits";
import { ORBIT_MAX, PRODUCT, check, dateOf, eldest, packDays, unpackDays } from "@/lib/custom/specs/orbits";
import { decodeMake, encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: unknown) => validate({ t: "orbits", v: 1, p });
const ex: CustomSpec = { t: "orbits", v: 1, p: PRODUCT.example };
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

describe("Your Family Orbits: the spec", () => {
  it("accepts the example, whose dates are the ones in its comment", () => {
    expect(spec(PRODUCT.example)).toEqual(ex);
    expect(unpackDays(PRODUCT.example.b)!.map(dateOf)).toEqual([[1948, 3, 14], [1951, 11, 2], [1976, 6, 21], [1979, 1, 30], [2008, 9, 5], [2012, 4, 17]]);
  });
  it("keeps its keys in order and drops unknown ones", () => {
    const b = packDays(["1950-01-01", "1940-01-01"]);
    expect(JSON.stringify(check({ w: "Us", s: 0, z: 1, b, n: ["Ann", "Bo"] }, {}))).toBe(`{"n":["Ann","Bo"],"b":"${b}","s":0,"w":"Us"}`);
    expect(spec({ ...PRODUCT.example, z: 1 })).toEqual(ex);
  });
  it("rejects wrong types, ranges, spellings and limits", () => {
    const n = ["Ann", "Bo"];
    const b = packDays(["1950-01-01", "1940-01-01"]);
    for (const p of [
      {},
      { n, b: ["1950-01-01", "1940-01-01"] },
      { n: ["Ann"], b: packDays(["1950-01-01"]) },
      { n: Array.from({ length: 10 }, (_, i) => `P${i}`), b: packDays(Array.from({ length: 10 }, () => "1950-01-01")) },
      { n, b: packDays(["1950-01-01"]) },
      { n, b: packDays(["1950-01-01", "1940-01-01", "1930-01-01"]) },
      { n, b: packInts([-1, 5]) },
      { n, b: packInts([0, 73_415]) },
      { n, b: b + "=" },
      { n, b: "!!" },
      { n: ["Ann", ""], b },
      { n: ["Ann", " Bo"], b },
      { n: ["Ann", "Bo  Bo"], b },
      { n: ["Ann", "Bartholomewss"], b },
      { n: ["Ann", "Бо"], b },
      { n: ["Ann", 5], b },
      { n, b, s: 1 },
      { n, b, s: 2 },
      { n, b, s: -1 },
      { n, b, s: "0" },
      { n, b, w: "" },
      { n, b, w: "x".repeat(29) },
    ])
      expect(spec(p), JSON.stringify(p)).toBeNull();
    // The sun written only when it isn't the eldest.
    expect(spec({ n, b, s: 0 })).not.toBeNull();
    expect(eldest(unpackDays(b)!)).toBe(1);
  });
  it("fits the largest spec in a link", () => {
    const big = spec({ n: Array.from({ length: ORBIT_MAX }, (_, i) => `Bartholomew${i}`), b: packDays(Array.from({ length: ORBIT_MAX }, (_, i) => iso(2100, 12, 31 - i))), s: 0, w: "The Levins and the Cohens, x" })!;
    expect(big).not.toBeNull();
    const link = encodeMake(big);
    expect(decodeMake(link)).toEqual(big);
    // Nine 12-character names, nine dates, a chosen sun, a 28-character title: 335 characters (the ceiling is 1,200).
    expect(link.length).toBeLessThanOrEqual(335);
  });
});

describe("Your Family Orbits: the template", () => {
  it("is deterministic", () => {
    expect(render(ex, "black")).toBe(render(ex, "black"));
  });
  it("writes only what the canvas preview draws", () => {
    expect(render(ex, "white")).not.toMatch(/clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/);
    // Transforms only on groups.
    expect(render(ex, "white")).not.toMatch(/<(text|path|circle|line|rect)[^>]*transform/);
  });
  it("the example passes the gate on both tees", () => {
    for (const color of ["black", "white"] as const) expect(gate(render(ex, color), color)).toBeNull();
  });
  it("two to nine people, one-letter to twelve-letter names, any birthdays: all pass the gate", () => {
    const rnd = mulberry32(0x0b175);
    const NAMES = "Noa Eli Ana Ben Maya David Miriam Ruth Ella Jonathan Sarah Yosef Tamar Adam Leah Avigail Itamar Shira Omer Daniel Rebecca Zoë José Siobhán Ødegaard O'Neil Anne-Marie".split(" ");
    const day = () => iso(1900 + Math.floor(rnd() * 201), 1 + Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28));
    const cases: { n: string[]; d: string[]; s?: number; w?: string }[] = [
      { n: ["A", "B"], d: ["1900-01-01", "2100-12-31"] },
      { n: ["Bartholomews", "Christophers"], d: ["2000-02-29", "2000-02-29"], w: "The Levins and the Cohens, x" },
      { n: Array.from({ length: 9 }, () => "Bartholomews"), d: Array.from({ length: 9 }, () => "1950-06-01") },
      { n: Array.from({ length: 9 }, () => "Wwwwwwwwwwww"), d: Array.from({ length: 9 }, (_, i) => iso(1930 + i * 10, 1 + i, 1 + i)), s: 4 },
      { n: Array.from({ length: 9 }, (_, i) => "ABCDEFGHI"[i]), d: Array.from({ length: 9 }, (_, i) => iso(1990, 12, 31 - i)) },
      { n: ["Ann", "Bo", "Cy"], d: ["1990-03-21", "1991-09-23", "1992-12-21"] },
    ];
    for (let i = 0; i < 150; i++) {
      const count = 2 + Math.floor(rnd() * 8);
      const n = Array.from({ length: count }, () => (rnd() < 0.15 ? "Wwwwwwwwwwww".slice(0, 1 + Math.floor(rnd() * 12)) : NAMES[Math.floor(rnd() * NAMES.length)]));
      const d = Array.from({ length: count }, day);
      const s = rnd() < 0.25 ? Math.floor(rnd() * count) : undefined;
      cases.push({ n, d, ...(s !== undefined && s !== eldest(d.map((x) => Date.parse(x))) ? { s } : {}), ...(rnd() < 0.3 ? { w: "The Levins" } : {}) });
    }
    const failures: string[] = [];
    cases.forEach((c, i) => {
      const s = spec({ n: c.n, b: packDays(c.d), ...(c.s !== undefined ? { s: c.s } : {}), ...(c.w ? { w: c.w } : {}) });
      expect(s, JSON.stringify(c)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const bad = gate(render(s!, color), color);
        if (bad) failures.push(`${JSON.stringify(c)} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
