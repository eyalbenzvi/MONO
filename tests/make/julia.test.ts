import { describe, expect, it } from "vitest";
import { BAND, bandIndex, render } from "@/lib/custom/templates/julia";
import { attractingCycle, juliaDrawing } from "@/lib/custom/draw/julia";
import { PRODUCT, check } from "@/lib/custom/specs/julia";
import { decodeMake, encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: unknown) => validate({ t: "julia", v: 1, p });
const ex: CustomSpec = { t: "julia", v: 1, p: PRODUCT.example };
const iso = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);

describe("Your Fractal: the spec", () => {
  it("accepts the example, keeps its keys in order, drops unknown keys", () => {
    expect(spec(PRODUCT.example)).toEqual(ex);
    expect(JSON.stringify(check({ w: "Us", d: "2000-02-29", z: 1 }, {}))).toBe('{"d":"2000-02-29","w":"Us"}');
  });
  it("rejects wrong types, ranges and spellings", () => {
    for (const p of [{}, { d: 20190614 }, { d: "2019-6-14" }, { d: "2019-02-29" }, { d: "1899-12-31" }, { d: "2101-01-01" }, { d: "2019-06-14T00:00" }, { d: "2019-06-14", w: "" }, { d: "2019-06-14", w: "x".repeat(29) }, { d: "2019-06-14", w: "Us " }, { d: "2019-06-14", w: 1 }])
      expect(spec(p), JSON.stringify(p)).toBeNull();
  });
  it("fits a link", () => {
    const big = spec({ d: "2100-12-31", w: "The day we met, and after, x" })!;
    const link = encodeMake(big);
    expect(decodeMake(link)).toEqual(big);
    // 103 characters.
    expect(link.length).toBeLessThanOrEqual(103);
  });
});

describe("Your Fractal: the band", () => {
  it("every set in it is intricate (outline length squared over area at least 120; a disc is 12.6)", () => {
    for (let k = 0; k < BAND.length; k += 11) expect(juliaDrawing(BAND[k][0] / 1e4, BAND[k][1] / 1e4, { x: 30, y: 24, w: 240, h: 282 }).complexity).toBeGreaterThanOrEqual(120);
  });
  it("every c in it is on the edge of the Mandelbrot set: in a bulb (a cycle of period 2 to 8) or just outside", () => {
    expect(BAND.length).toBeGreaterThan(100);
    const escapes = (cx: number, cy: number) => {
      let [x, y] = [0, 0];
      for (let n = 0; n < 400; n++) {
        [x, y] = [x * x - y * y + cx, 2 * x * y + cy];
        if (x * x + y * y > 4) return n;
      }
      return Infinity;
    };
    for (const [re, im] of BAND) {
      const c = attractingCycle(re / 1e4, im / 1e4);
      const ok = c ? c.points.length >= 2 && c.points.length <= 8 : escapes(re / 1e4, im / 1e4) >= 25 && escapes(re / 1e4, im / 1e4) <= 300;
      expect(ok, `${re} ${im}`).toBe(true);
    }
  });
  it("neighbouring days draw different sets, and every entry has a day", () => {
    expect(bandIndex("2019-06-14")).not.toBe(bandIndex("2019-06-15"));
    const seen = new Set<number>();
    for (let d = 0; d < BAND.length; d++) seen.add(bandIndex(iso(10_957 + d)));
    expect(seen.size).toBe(BAND.length);
  });
});

describe("Your Fractal: the template", () => {
  it("is deterministic", () => {
    expect(render(ex, "black")).toBe(render(ex, "black"));
  });
  it("writes only what the canvas preview draws", () => {
    expect(render(spec({ d: "1900-01-01", w: "For Maya" })!, "white")).not.toMatch(/clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/);
  });
  it("the example passes the gate on both tees", () => {
    for (const color of ["black", "white"] as const) expect(gate(render(ex, color), color)).toBeNull();
  });
  it("every set in the band, reached by a date, with and without words: all pass the gate", () => {
    // One date per band entry (n consecutive days reach all n), words on some; the first and last days of the range.
    const rnd = mulberry32(0x1f1a);
    const dates = Array.from({ length: BAND.length }, (_, d) => iso(10_957 + d));
    dates.push("1900-01-01", "2100-12-31", "2000-02-29");
    const failures: string[] = [];
    dates.forEach((d, i) => {
      const r = rnd();
      const s = spec({ d, ...(r < 0.3 ? { w: "The day we met, and after, x" } : r < 0.5 ? { w: "Us" } : {}) });
      expect(s, d).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const bad = gate(render(s!, color), color);
        if (bad) failures.push(`${JSON.stringify(s!.p)} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 900_000);
  it("draws fast enough for a live preview", () => {
    // Node as a proxy for the browser: best of three runs for a spread of the band (standalone: median about 55 ms,
    // the slowest about 135 ms); the bound on the 90th percentile leaves room for a machine busy with other work.
    const times: number[] = [];
    for (let k = 0; k < BAND.length; k += 9) {
      const s = spec({ d: iso(10_957 + k) })!;
      let best = Infinity;
      for (let t = 0; t < 3; t++) {
        const t0 = performance.now();
        render(s, "black");
        best = Math.min(best, performance.now() - t0);
      }
      times.push(best);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.9)]).toBeLessThan(300);
  }, 60_000);
});
