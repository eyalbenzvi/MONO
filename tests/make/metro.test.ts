import { describe, expect, it } from "vitest";
import { layout, metroPlan, render } from "@/lib/custom/templates/metro";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { LINE_MAX, PRODUCT, STATION_MAX, check, metroProblem, type Params } from "@/lib/custom/specs/metro";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: Record<string, unknown>) => validate({ t: "metro", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const ok = { l: ["A", "B"], s: ["W", "X", "Y", "Z"], k: [3, 1, 2, 3] };

/** Seeded random maps: 2–4 lines, 2–16 stations, every line stopping twice at least. */
function randomMap(rnd: () => number, o: { lines?: number; stations?: number; long?: boolean } = {}): Params {
  const n = o.lines ?? 2 + Math.floor(rnd() * 3);
  const N = o.stations ?? 4 + Math.floor(rnd() * 13);
  const word = (max: number) => {
    const len = o.long ? max : 1 + Math.floor(rnd() * max);
    return Array.from({ length: len }, (_, i) => (i === 0 ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "abcdefghijklmnopqrstuvwxyzW")[Math.floor(rnd() * (i ? 27 : 26))]).join("");
  };
  for (;;) {
    const share = rnd();
    const k = Array.from({ length: N }, () => {
      if (rnd() < share) return 1 + Math.floor(rnd() * ((1 << n) - 1));
      return 1 << Math.floor(rnd() * n);
    });
    if (!metroProblem(n, k)) return { l: Array.from({ length: n }, () => word(LINE_MAX)), s: Array.from({ length: N }, () => word(STATION_MAX)), k };
  }
}

describe("Your Metro Map: the spec", () => {
  it("accepts the example, in its key order, and drops unknown keys", () => {
    expect(check(PRODUCT.example as unknown as Record<string, unknown>, {})).toEqual(PRODUCT.example);
    expect(JSON.stringify(spec({ w: "Hi", k: [3, 1, 2, 3], s: ["W", "X", "Y", "Z"], l: ["A", "B"], z: 1 })!.p)).toBe('{"l":["A","B"],"s":["W","X","Y","Z"],"k":[3,1,2,3],"w":"Hi"}');
  });
  it("refuses bad lines, stations, stops and words", () => {
    for (const p of [
      {},
      { ...ok, l: ["A"] },
      { ...ok, l: ["A", "B", "C", "D", "E"], k: [31, 31, 31, 31] },
      { ...ok, l: ["A", ""] },
      { ...ok, l: ["A", " B"] },
      { ...ok, l: ["A", "x".repeat(LINE_MAX + 1)] },
      { ...ok, l: "AB" },
      { ...ok, s: ["X", "Y", "Z"], k: [3, 3, 3] },
      { ...ok, s: ["X", "Y", "Z"] },
      { ...ok, s: ["W", "X", "Y", "x".repeat(STATION_MAX + 1)] },
      { ...ok, s: ["W", "X", "Y", "日本"] },
      { ...ok, s: Array.from({ length: 17 }, (_, i) => `S${i}`), k: Array(17).fill(3) },
      { ...ok, k: [3, 1, 2, 0] },
      { ...ok, k: [3, 1, 2, 4] },
      { ...ok, k: [3, 1, 1, 1] },
      { ...ok, k: [1, 1, 2, 2] },
      { ...ok, l: ["A", "B", "C"], k: [3, 3, 4, 4] },
      { ...ok, k: [3, 1, 2, 1.5] },
      { ...ok, k: ["3", 1, 2, 3] },
      { ...ok, w: "" },
      { ...ok, w: "x".repeat(29) },
    ])
      expect(spec(p), JSON.stringify(p)).toBeNull();
  });
  it("the longest link fits", () => {
    const p = { l: Array(4).fill("W".repeat(LINE_MAX)), s: Array(16).fill("W".repeat(STATION_MAX)), k: Array(16).fill(15), w: "W".repeat(28) };
    const n = encodeMake(spec(p)!).length;
    expect(n).toBeLessThan(700);
    console.log(`metro: longest ?make= ${n} characters`);
  });
});

describe("Your Metro Map: the template", () => {
  it("is deterministic, octilinear, and draws only what the preview can", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    const a = render(s, "black");
    expect(a).toBe(render(s, "black"));
    expect(a).not.toMatch(FORBIDDEN);
    expect(a).not.toMatch(/<(?!g\b)[a-z]+ [^>]*transform=/);
    const rnd = mulberry32(0x0c7a);
    for (let t = 0; t < 200; t++) {
      for (const r of layout(randomMap(rnd)).routes)
        r.slice(1).forEach(([x, y], i) => {
          const [dx, dy] = [x - r[i][0], y - r[i][1]];
          // 0°, 45° or 90° only, and always downwards (or level).
          expect(Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 1e-6).toBe(true);
          expect(dy).toBeGreaterThanOrEqual(-1e-9);
        });
    }
  });
  it("never sets a name on another name or on another station", () => {
    const rnd = mulberry32(0x1abe1);
    type B = { x0: number; y0: number; x1: number; y1: number };
    const ov = (a: B, b: B) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (let t = 0; t < 300; t++) {
      const { placed, marks } = metroPlan(randomMap(rnd, { long: t % 3 === 0 }));
      placed.forEach((a, i) => {
        placed.forEach((b, j) => j > i && expect(ov(a.box, b.box)).toBe(false));
        marks.forEach((m, j) => j !== i && expect(ov(a.box, m)).toBe(false));
      });
    }
  });
  it("interchanges are one pill across the whole trunk, lined up, and rows keep their room", () => {
    const rnd = mulberry32(0x9111);
    for (let t = 0; t < 300; t++) {
      const { stations, rows, sc } = metroPlan(randomMap(rnd, { long: t % 3 === 0 }));
      const pills = stations.filter((s) => s.trunk);
      for (const s of pills) expect([s.x, s.half]).toEqual([pills[0].x, pills[0].half]);
      // Rows at least 16 apart as printed (the map is never drawn smaller than 0.85, and 16 rows fill the height).
      rows.slice(1).forEach((y, i) => expect((y - rows[i]) * Math.min(sc, 1)).toBeGreaterThanOrEqual(15.5));
    }
  });
  it("the example passes the gate in both colours", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    for (const color of ["black", "white"] as const) expect(gate(render(s, color), color)).toBeNull();
  });
  it("every shape of map: all on the trunk, all on branches, the fewest and most stations, the longest names: all pass the gate", () => {
    const rnd = mulberry32(0x3e7a0);
    const maps: Params[] = [
      { l: ["A", "B"], s: ["W", "X", "Y", "Z"], k: [3, 3, 3, 3] },
      { l: ["A", "B"], s: ["W", "X", "Y", "Z"], k: [1, 3, 3, 2] },
      { l: ["A", "B", "C", "D"], s: ["P", "Q", "R", "S"], k: [15, 15, 15, 15] },
      { l: ["A", "B", "C", "D"], s: "ABCDEFGHI".split(""), k: [1, 2, 4, 8, 15, 1, 2, 4, 8] },
      { l: Array(4).fill("W".repeat(LINE_MAX)), s: Array(16).fill("W".repeat(STATION_MAX)), k: Array(16).fill(15) },
      { l: Array(4).fill("W".repeat(LINE_MAX)), s: Array(16).fill("W".repeat(STATION_MAX)), k: [1, 2, 4, 8, 1, 2, 4, 8, 1, 2, 4, 8, 1, 2, 4, 15] },
      { l: Array(4).fill("W".repeat(LINE_MAX)), s: Array(16).fill("W".repeat(STATION_MAX)), k: [15, 1, 2, 4, 8, 15, 1, 2, 4, 8, 15, 1, 2, 4, 8, 15], w: "W".repeat(28) },
      { l: ["A", "B"], s: Array(16).fill("W".repeat(STATION_MAX)), k: [3, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 3] },
      randomMap(rnd, { lines: 4, stations: 16, long: true }),
      randomMap(rnd, { lines: 3, stations: 16, long: true }),
      randomMap(rnd, { lines: 2, stations: 4 }),
      randomMap(rnd, { lines: 4, stations: 4 }),
    ];
    for (let i = 0; i < 80; i++) maps.push(i % 5 === 0 ? randomMap(rnd, { long: true }) : randomMap(rnd));
    const failures: string[] = [];
    maps.forEach((p, i) => {
      const s = spec(p as unknown as Record<string, unknown>) as CustomSpec;
      expect(s, JSON.stringify(p)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const svg = render(s, color);
        const bad = gate(svg, color) ?? (/NaN|Infinity/.test(svg) ? "NaN" : null);
        if (bad) failures.push(`${JSON.stringify(p)} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
