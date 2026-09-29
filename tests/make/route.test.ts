import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/route";
import { routeFromDrawing, routeFromTrack, type TrackPoint } from "@/lib/custom/draw/route";
import { ELEV_N, PRODUCT, ROUTE_GRID, ROUTE_MAX_BYTES, check, packElevation, packRoute, routePoints } from "@/lib/custom/specs/route";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const ex = PRODUCT.example;
const spec = (p: object) => validate({ t: "route", v: 1, p });

/** A made-up track: a walk with turns, optionally back to the start, heights along it. */
function track(seed: number, km: number, loop: boolean, heights = true): TrackPoint[] {
  const r = mulberry32(seed);
  const pts: TrackPoint[] = [];
  let [x, y, h] = [0, 0, r() * 6.28];
  const n = Math.round(km * 50);
  for (let i = 0; i < n; i++) {
    if (r() < 0.03) h += ((r() < 0.5 ? 1 : -1) * Math.PI) / 2;
    h += (r() - 0.5) * 0.1;
    if (loop && i > n * 0.55) {
      const d = Math.atan2(-y, -x) - h;
      h += Math.atan2(Math.sin(d), Math.cos(d)) * 0.05;
    }
    x += Math.cos(h) * 20;
    y += Math.sin(h) * 20;
    pts.push({ lat: 40 + (r() - 0.5) * 0 + y / 111_320, lon: 10 + x / (111_320 * 0.766), ...(heights ? { ele: 200 + 150 * Math.sin((i / n) * 5) } : {}) });
  }
  return pts;
}
/** The largest route the spec takes: a scribble whose steps take one byte each, up to the byte limit. */
function scribble(seed: number, bytes = ROUTE_MAX_BYTES): string {
  const r = mulberry32(seed);
  for (let n = Math.floor(bytes / 2); n > 2; n--) {
    const pts: [number, number][] = [[0, 0], [ROUTE_GRID, 0]];
    while (pts.length < n) {
      const [x, y] = pts[pts.length - 1];
      const nx = Math.max(0, Math.min(ROUTE_GRID, x + Math.round((r() - 0.5) * 120))), ny = Math.max(0, Math.min(ROUTE_GRID, y + Math.round((r() - 0.5) * 120)));
      if (nx !== x || ny !== y) pts.push([nx, ny]);
    }
    const s = packRoute(pts);
    if (routePoints(s)) return s;
  }
  throw new Error("no scribble");
}

/** Points fitted to the grid the canonical way (their own origin, the longer side spanning it), packed. */
function norm(pts: [number, number][]): string {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
  const g: [number, number][] = [];
  for (const [x, y] of pts) {
    const q: [number, number] = [Math.round(((x - x0) / span) * ROUTE_GRID), Math.round(((y - y0) / span) * ROUTE_GRID)];
    if (!g.length || g[g.length - 1][0] !== q[0] || g[g.length - 1][1] !== q[1]) g.push(q);
  }
  return packRoute(g);
}

describe("Your Route: the spec", () => {
  it("accepts the example, and keeps only known keys in order", () => {
    expect(check(ex as unknown as Record<string, unknown>, {})).toEqual(ex);
    const v = validate({ t: "route", v: 1, p: { w: ex.w, d: ex.d, zz: 1, e: ex.e, k: ex.k, m: ex.m, r: ex.r } });
    expect(JSON.stringify(v)).toBe(JSON.stringify({ t: "route", v: 1, p: ex }));
    expect(spec({ r: ex.r })).not.toBeNull();
  });
  it("refuses wrong types, ranges and non-canonical routes", () => {
    const bad: object[] = [
      {},
      { r: 5 },
      { r: "" },
      { r: "!!" },
      { r: packRoute([[0, 0]]) },
      // Not at its own origin, not spanning the grid, off the grid, a repeated point.
      { r: packRoute([[1, 0], [ROUTE_GRID, 5]]) },
      { r: packRoute([[0, 0], [100, 50]]) },
      { r: packRoute([[0, 0], [ROUTE_GRID + 1, 0]]) },
      { r: packRoute([[0, 0], [0, 0], [ROUTE_GRID, 0]]) },
      // An over-long varint for the same numbers.
      { r: packInts([0, 0, ROUTE_GRID, 0]) + "A" },
      { r: scribble(1, ROUTE_MAX_BYTES + 60) + scribble(2) },
      { ...ex, m: 0 },
      { ...ex, m: 4001 },
      { ...ex, m: 1.5 },
      { ...ex, k: 0 },
      { ...ex, k: 1.25 },
      { ...ex, k: 10000 },
      { ...ex, k: "14" },
      { ...ex, e: packElevation(0, 10, Array(ELEV_N - 1).fill(1)) },
      { ...ex, e: packElevation(10, 10, Array(ELEV_N).fill(1)) },
      { ...ex, e: packElevation(0, 10, Array(ELEV_N).fill(64)) },
      { r: ex.r, e: ex.e },
      { ...ex, d: "2024-02-30" },
      { ...ex, d: "21/04/2024" },
      { ...ex, w: "" },
      { ...ex, w: " Sunday" },
      { ...ex, w: "x".repeat(29) },
      { ...ex, w: "日曜日" },
    ];
    for (const p of bad) expect(spec(p), JSON.stringify(p)).toBeNull();
  });
  it("hides the first and last 200 m of a file, and keeps nothing of where it was", () => {
    const t = track(3, 6, false);
    const all = routeFromTrack(t, false), hidden = routeFromTrack(t, true);
    expect(typeof all).toBe("object");
    expect(typeof hidden).toBe("object");
    if (typeof all === "string" || typeof hidden === "string") return;
    expect(all.k).toBe(hidden.k);
    expect(all.r).not.toBe(hidden.r);
    // The same walk anywhere else on earth is the same spec.
    const moved = routeFromTrack(t.map((p) => ({ ...p, lat: p.lat - 60, lon: p.lon + 100 })), true);
    expect(typeof moved === "object" && moved.r.length).toBeGreaterThan(0);
    expect(routeFromTrack(track(3, 0.4, false), true)).toMatch(/Too short/);
    expect(routeFromTrack([], true)).toMatch(/no track/);
    expect(routeFromDrawing([[10, 10], [10.1, 10]])).toBeNull();
  });
});

describe("Your Route: the print", () => {
  it("is deterministic and uses only what the preview draws", () => {
    const s = { t: "route", v: 1, p: ex } as CustomSpec;
    const a = render(s, "black");
    expect(a).toBe(render(s, "black"));
    expect(a).not.toMatch(FORBIDDEN);
  });
  it("the example passes in both colours", () => {
    const s = { t: "route", v: 1, p: ex } as CustomSpec;
    expect(gate(render(s, "black"), "black")).toBeNull();
    expect(gate(render(s, "white"), "white")).toBeNull();
  });
  it("the longest link fits", () => {
    const s = spec({ r: scribble(7), m: 4000, k: 9999.9, e: packElevation(-500, 9000, Array.from({ length: ELEV_N }, (_, i) => (i % 2 ? 63 : 0))), d: "2024-12-31", w: "W".repeat(28) })!;
    expect(s).not.toBeNull();
    const n = encodeMake(s).length;
    console.log(`Your Route: longest ?make= ${n} characters (example ${encodeMake({ t: "route", v: 1, p: ex } as CustomSpec).length})`);
    expect(n).toBeLessThan(1200);
  });
  it("fuzz: straight lines to scribbles, files and drawings, every field or none: all pass the gate", () => {
    const rnd = mulberry32(0x40e7e);
    const G = ROUTE_GRID;
    const lines: string[] = [
      packRoute([[0, 0], [G, 0]]),
      packRoute([[0, 0], [0, G]]),
      packRoute([[0, 0], [G, G]]),
      packRoute([[0, G], [G, 0]]),
      packRoute([[0, 0], [G, 3], [0, 6]]),
      packRoute(Array.from({ length: 60 }, (_, i) => [Math.round((i / 59) * G), i % 2 ? 40 : 0] as [number, number])),
      norm(Array.from({ length: 150 }, (_, i) => {
        const t = (i / 149) * Math.PI * 8, rad = (i / 149) * 0.5;
        return [0.5 + rad * Math.cos(t), 0.5 + rad * Math.sin(t)] as [number, number];
      })),
      scribble(11),
      scribble(12, 200),
      scribble(13, 60),
    ];
    const canon = lines.map((r) => {
      expect(routePoints(r), r).not.toBeNull();
      return r;
    });
    for (let i = 0; i < 40; i++) {
      const got = routeFromTrack(track(100 + i, 1 + rnd() * 120, rnd() < 0.5, rnd() < 0.7), rnd() < 0.8);
      if (typeof got === "object") canon.push(JSON.stringify(got));
    }
    for (let i = 0; i < 16; i++) {
      const pts: [number, number][] = [];
      let [x, y] = [500, 500];
      for (let k = 0; k < 40 + i * 30; k++) pts.push([(x += (rnd() - 0.5) * 80), (y += (rnd() - 0.5) * 80)]);
      const r = routeFromDrawing(pts);
      if (r) canon.push(r);
    }
    const failures: string[] = [];
    let n = 0;
    canon.forEach((r, i) => {
      const parts = r.startsWith("{") ? JSON.parse(r) : { r };
      const extras = [{}, { k: 0.1, w: "A" }, { k: 9999.9, d: "2024-12-31", w: "M".repeat(28) }][i % 3];
      const s = spec({ ...parts, ...extras });
      expect(s, JSON.stringify(parts)).not.toBeNull();
      for (const color of i % 4 === 0 ? (["black", "white"] as const) : ([i % 2 ? "white" : "black"] as const)) {
        n++;
        const bad = gate(render(s!, color), color);
        if (bad) failures.push(`${JSON.stringify(s!.p).slice(0, 160)} ${color}: ${bad}`);
      }
    });
    expect(n).toBeGreaterThan(40);
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
