import { describe, expect, it } from "vitest";
import { armWidths, broadArms, growCrystal } from "@/lib/custom/draw/snowflake";
import { GRID, RANGE, crystalBody, flakeFor, growFlake, render } from "@/lib/custom/templates/snowflake";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { PRODUCT, SNOWFLAKE_MAX, check } from "@/lib/custom/specs/snowflake";
import { wrap } from "@/lib/custom/svg";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: Record<string, unknown>) => validate({ t: "snowflake", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;

describe("Your Snowflake: the spec", () => {
  it("accepts the example and drops unknown keys", () => {
    expect(check(PRODUCT.example as unknown as Record<string, unknown>, {})).toEqual(PRODUCT.example);
    expect(spec({ n: "Noa", w: "x", z: 1 })!.p).toEqual({ n: "Noa" });
  });
  it("refuses anything but a tidy printable name of up to SNOWFLAKE_MAX characters", () => {
    for (const p of [{}, { n: "" }, { n: " Noa" }, { n: "Noa " }, { n: "No  a" }, { n: 5 }, { n: ["Noa"] }, { n: "x".repeat(SNOWFLAKE_MAX + 1) }, { n: "日本" }, { n: "a<b" }])
      expect(spec(p), JSON.stringify(p)).toBeNull();
    expect(spec({ n: "x".repeat(SNOWFLAKE_MAX) })).not.toBeNull();
  });
  it("the longest link fits", () => {
    const n = encodeMake(spec({ n: "Ã".repeat(SNOWFLAKE_MAX) })!).length;
    expect(n).toBeLessThan(300);
    console.log(`snowflake: longest ?make= ${n} characters`);
  });
});

describe("Your Snowflake: the template", () => {
  it("is deterministic, exactly six-fold, and draws only what the preview can", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    const a = render(s, "black");
    expect(a).toBe(render(s, "black"));
    expect(a).not.toMatch(FORBIDDEN);
    expect(a).not.toMatch(/ transform=|NaN/);
    // Every cell holds its orbit's value: the twelve images of a cell agree.
    const c = flakeFor("Maya").crystal;
    const side = 2 * GRID + 1;
    const at = (q: number, r: number) => c.s[(r + GRID) * side + (q + GRID)];
    for (const [q, r] of [[5, 3], [20, -7], [-11, 30]]) {
      const v = at(q, r);
      expect(at(-r, q + r)).toBe(v);
      expect(at(r, q)).toBe(v);
      expect(at(-q, -r)).toBe(v);
    }
  });
  it("other names, other flakes", () => {
    const seen = new Set(["Maya", "Noa", "Eyal", "maya", "Maya.", "A", "B"].map((n) => JSON.stringify(flakeFor(n).flake)));
    expect(seen.size).toBe(7);
  });
  it("the example passes the gate in both colours", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    for (const color of ["black", "white"] as const) expect(gate(render(s, color), color)).toBeNull();
  });
  it("refuses the leaf: narrow arms tapering to a point (the old Maya, and the leaves of the range) are not a snowflake", () => {
    // The first version's Maya: six long serrated leaves.
    expect(broadArms(growCrystal(1.17, 0.511, 4e-5, GRID))).toBe(false);
    expect(broadArms(growCrystal(1.3, 0.47, 1.1e-4, GRID))).toBe(false);
    // Thin leaves inside the range itself, refused there too.
    expect(broadArms(growFlake({ alpha: 1.17, beta: 0.87, gamma: 10 ** -3.9, plate: 9 }))).toBe(false);
    expect(broadArms(growFlake({ alpha: 0.59, beta: 0.83, gamma: 10 ** -3.1, plate: 8 }))).toBe(true);
  });
  it("the whole range, as names reach it: a hexagonal centre plate, arms broad to the tip, and the gate passed", () => {
    const rnd = mulberry32(0x5e0f);
    const lerp = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;
    const failures: string[] = [];
    let accepted = 0;
    // The range's corners and middle, and random points: every one that's accepted must print and read as a snowflake.
    const points: [number, number, number, number][] = [];
    for (const ta of [0, 0.5, 1]) for (const tb of [0, 0.5, 1]) for (const tg of [0, 1]) points.push([lerp(RANGE.alpha, ta), lerp(RANGE.beta, tb), lerp(RANGE.logGamma, tg), 6 + ((ta * 2 + tb * 2) % 5)]);
    for (let i = 0; i < 60; i++) points.push([lerp(RANGE.alpha, rnd()), lerp(RANGE.beta, rnd()), lerp(RANGE.logGamma, rnd()), 6 + Math.floor(rnd() * 5)]);
    points.forEach(([alpha, beta, lg, plate], i) => {
      const c = growFlake({ alpha, beta, gamma: 10 ** lg, plate });
      if (c.radius < GRID - 3) failures.push(`${alpha} ${beta} ${lg}: radius ${c.radius}`);
      if (!broadArms(c)) return;
      accepted++;
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const bad = gate(wrap(crystalBody(c, "Maya", "Reiter's model", plate), color), color);
        if (bad) failures.push(`${alpha} ${beta} ${lg} ${plate} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
    expect(accepted).toBeGreaterThan(points.length / 4);
    // Names: every flake chosen has a plate of six cells or more and arms broad to the tip.
    for (let i = 0; i < 150; i++) {
      const { flake, crystal } = flakeFor(`Name ${i}`);
      const [w7, w8] = armWidths(crystal);
      expect(flake.plate, `Name ${i}`).toBeGreaterThanOrEqual(6);
      expect(w7 >= 0.22 && w8 >= 0.18, `Name ${i}: ${w7} ${w8}`).toBe(true);
    }
  }, 600_000);
  it("names: one letter, the longest, accents, random: all pass the gate", () => {
    const rnd = mulberry32(0x5a0);
    const names = ["A", "x".repeat(SNOWFLAKE_MAX), "W".repeat(SNOWFLAKE_MAX), "Zoë", "Ångström", "O'Neill-Smith & Co.", "1"];
    const abc = "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < 60; i++) names.push(Array.from({ length: 1 + Math.floor(rnd() * SNOWFLAKE_MAX) }, () => abc[Math.floor(rnd() * 26)]).join("").replace(/^./, (c) => c.toUpperCase()));
    const failures: string[] = [];
    names.forEach((n, i) => {
      const s = spec({ n }) as CustomSpec;
      expect(s, n).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const bad = gate(render(s, color), color);
        if (bad) failures.push(`${n} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
