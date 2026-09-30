import { describe, expect, it } from "vitest";
import { render, weekCell } from "@/lib/custom/templates/weeks";
import { PRODUCT, check } from "@/lib/custom/specs/weeks";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "weeks", v: 1, p });
const ex = PRODUCT.example;
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;

describe("Your Life in Weeks: the spec", () => {
  it("accepts the example and drops unknown keys", () => {
    expect(check(ex as never, {})).toEqual(ex);
    expect(ok({ ...ex, zz: 1 })).toEqual({ t: "weeks", v: 1, p: ex });
    expect(Object.keys(ok({ w: "Noa", m: ex.m, n: 90, a: ex.a, b: ex.b })!.p)).toEqual(["b", "a", "n", "m", "w"]);
  });
  it("rejects wrong types, ranges, unknown values and non-canonical forms", () => {
    const bad: unknown[] = [
      { ...ex, b: 19900314 },
      { ...ex, b: "1990-3-14" },
      { ...ex, b: "1899-12-31" },
      { ...ex, b: "1990-02-30" },
      { ...ex, a: "1990-03-13" },
      { ...ex, a: "2080-03-14" },
      { ...ex, n: 85 },
      { ...ex, n: "90" },
      { ...ex, m: [] },
      { ...ex, m: "Married" },
      { ...ex, m: [["2014-06-21"]] },
      { ...ex, m: [["2014-06-21", "Married", 1]] },
      { ...ex, m: [["2014-06-21", ""]] },
      { ...ex, m: [["2014-06-21", "Married  "]] },
      { ...ex, m: [["2014-06-21", "Thirteen char"]] },
      { ...ex, m: [["2014-06-21", "Married☃"]] },
      { ...ex, m: [["1980-01-01", "Before"]] },
      { ...ex, m: [["2080-03-14", "After"]] },
      { ...ex, m: [["2014-06-21", "B"], ["2010-01-01", "A"]] },
      { ...ex, m: [["2014-06-21", "A"], ["2014-06-21", "B"]] },
      { ...ex, m: Array.from({ length: 6 }, (_, i) => [`200${i}-01-01`, "X"]) },
      { ...ex, w: "" },
      { ...ex, w: " Noa" },
      { ...ex, w: "x".repeat(29) },
      { b: ex.b, n: 90 },
    ];
    for (const p of bad) expect(ok(p), JSON.stringify(p)).toBeNull();
  });
  it("counts a year of life from birthday to birthday, 29 February included", () => {
    expect(weekCell("1990-03-14", "1990-03-14")).toEqual([0, 0]);
    expect(weekCell("1990-03-14", "1990-03-20")).toEqual([0, 0]);
    expect(weekCell("1990-03-14", "1990-03-21")).toEqual([0, 1]);
    expect(weekCell("1990-03-14", "1991-03-13")).toEqual([0, 51]);
    expect(weekCell("1990-03-14", "1991-03-14")).toEqual([1, 0]);
    expect(weekCell("2000-02-29", "2001-02-28")).toEqual([0, 51]);
    expect(weekCell("2000-02-29", "2001-03-01")).toEqual([1, 0]);
    expect(weekCell("1936-01-01", "2025-12-31")).toEqual([89, 51]);
  });
});

describe("Your Life in Weeks: the template", () => {
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
  it("the longest link fits", () => {
    const longest = { b: "1990-12-31", a: "2079-12-30", n: 90, m: Array.from({ length: 5 }, (_, i) => [`20${10 + i}-12-31`, "WWWWWWWWWWWW"]), w: "W".repeat(28) };
    const len = encodeMake(ok(longest)!).length;
    console.log(`weeks: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(400);
  });
  it("newborn to ninety, milestones anywhere, words or none: all pass the gate", () => {
    const rnd = mulberry32(0x3ee45);
    const day = (t: number) => new Date(t).toISOString().slice(0, 10);
    const DAY = 86_400_000;
    const raws: Record<string, unknown>[] = [
      // A newborn (all rings, the faintest print) in each of the four layouts: 80 or 90 rows, with or without the label margin.
      { b: "2026-09-29", a: "2026-09-29", n: 80 },
      { b: "2026-09-29", a: "2026-09-29", n: 90 },
      { b: "2026-09-29", a: "2026-09-29", n: 80, m: [["2100-12-31", "A"]] },
      { b: "2026-09-29", a: "2026-09-29", n: 90, m: [["2026-09-29", "Born"]] },
      { b: "1900-01-01", a: "1989-12-31", n: 90 },
      { b: "2100-12-31", a: "2100-12-31", n: 90, w: "W".repeat(28) },
      { b: "1946-06-15", a: "2026-06-14", n: 80, m: [["2026-06-01", "WWWWWWWWWWWW"], ["2026-06-05", "MMMMMMMMMMMM"], ["2026-06-10", "Last"], ["2026-06-12", "Very last"], ["2026-06-14", "Today"]] },
      { b: "2000-02-29", a: "2000-02-29", n: 90, m: [["2000-02-29", "Born"], ["2000-03-07", "A"], ["2000-03-14", "B"], ["2000-03-21", "C"], ["2000-03-28", "D"]] },
      { b: "1990-03-14", a: "2030-03-14", n: 90, m: [["2000-01-01", "I"]], w: "N" },
    ];
    const LABELS = ["Married", "Maya", "Tel Aviv", "University", "WWWWWWWWWWWW", "A", "First job", "Paris"];
    for (let i = 0; i < 120; i++) {
      const n = rnd() < 0.5 ? 80 : 90;
      const b0 = Date.UTC(1900, 0, 1) + Math.floor(rnd() * 200 * 365) * DAY;
      const b = day(b0);
      const [by, bm, bd] = b.split("-").map(Number);
      const end = Math.min(Date.UTC(by + n, bm - 1, bd) - DAY, Date.UTC(2100, 11, 31));
      if (end < b0) continue;
      const at = () => b0 + Math.floor(rnd() * ((end - b0) / DAY + 1)) * DAY;
      const k = Math.floor(rnd() * 6);
      const m = [...new Set(Array.from({ length: k }, () => day(at())))].sort().map((d) => [d, LABELS[Math.floor(rnd() * LABELS.length)]]);
      raws.push({ b, a: day(at()), n, ...(m.length ? { m } : {}), ...(rnd() < 0.3 ? { w: "Noa, so far" } : {}) });
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
