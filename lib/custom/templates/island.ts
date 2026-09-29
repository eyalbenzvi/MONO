/**
 * Your Island: an island grown from its name, drawn as a surveyor's chart in
 * the hand of the catalogue's Topographic Contours. The ground is fractal
 * noise (fBm, seeded from the name) sinking towards the edges; a seed whose
 * island comes out too small, too big, too ragged or in pieces is drawn
 * again from the seed and a salt, until one lands in the band (the same
 * name always makes the same island). The coast and the contours are level
 * lines of the ground (marching squares); the sea is hatched along the coast
 * and breaks into dashes as it goes out; a compass rose sits in the widest
 * sea. The places (up to six names) go to the island's peaks, capes and
 * bays, spread out (each as far as it can be from the ones before), each
 * name on a patch of ground cleared of lines.
 */
import { INK, caption, circle, f1, line, text } from "../kit";
import { fbm, isolines, pad } from "../draw/islandMarch";
import type { Point } from "../draw/paths";
import type { CustomSpec } from "../spec";
import type { Params } from "../specs/island";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** The chart: a grid of GW × GH cells of C units from (X0, Y0). */
const GW = 128, GH = 140, C = 2;
const X0 = 22, Y0 = 20, X1 = X0 + (GW - 1) * C, Y1 = Y0 + (GH - 1) * C;
/** Land between these shares of the chart, and at least this compact (4πA/P², P counted in cell edges). */
const AREA: [number, number] = [0.27, 0.45];
const COMPACT = 0.16;
const TRIES = 60;
const LEVELS = 7;

/** FNV-1a of the name: the island's seed. */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return h;
}

interface Ground {
  h: Float32Array;
  area: number;
  compact: number;
}

/** The ground for a seed: heights, land where above 0, only its main island and islets of 12 cells or more kept. */
function ground(seed: number): Ground {
  const n = fbm(seed, 4), warp = fbm((seed ^ 0x5bd1e995) >>> 0, 3);
  const h = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const [u, v] = [i / GW - 0.5, (j / GH - 0.5) * (GH / GW)];
      const [wx, wy] = [warp(i * 0.03, j * 0.03) - 0.5, warp(i * 0.03 + 7.1, j * 0.03 + 3.3) - 0.5];
      const r = Math.hypot(u / 0.44, v / 0.47);
      h[j * GW + i] = n(i * 0.024 + wx * 1.4, j * 0.024 + wy * 1.4) - 0.2 - 0.5 * r * r;
    }
  // Components of land (4-neighbour): the biggest is the island.
  const comp = new Int32Array(GW * GH).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < GW * GH; s++) {
    if (h[s] <= 0 || comp[s] >= 0) continue;
    const stack = [s];
    comp[s] = sizes.length;
    let k = 0;
    while (stack.length) {
      const p = stack.pop()!;
      k++;
      const x = p % GW;
      for (const q of [x > 0 ? p - 1 : -1, x < GW - 1 ? p + 1 : -1, p - GW, p + GW]) if (q >= 0 && q < GW * GH && h[q] > 0 && comp[q] < 0) (comp[q] = sizes.length), stack.push(q);
    }
    sizes.push(k);
  }
  const main = sizes.indexOf(Math.max(0, ...sizes));
  let [area, edges, border, other] = [0, 0, false, 0];
  for (let p = 0; p < GW * GH; p++) {
    if (comp[p] < 0) continue;
    if (comp[p] !== main) {
      if (sizes[comp[p]] < 12) h[p] = -0.002;
      else other++;
      continue;
    }
    area++;
    const x = p % GW, y = (p - x) / GW;
    if (x < 3 || y < 3 || x > GW - 4 || y > GH - 4) border = true;
    for (const q of [x > 0 ? p - 1 : -1, x < GW - 1 ? p + 1 : -1, p - GW, p + GW]) if (q < 0 || q >= GW * GH || h[q] <= 0) edges++;
  }
  // Centred on the chart: the land's box moved to the middle (whole cells).
  let [bx0, by0, bx1, by1] = [GW, GH, 0, 0];
  for (let p = 0; p < GW * GH; p++)
    if (h[p] > 0) {
      const x = p % GW, y = (p - x) / GW;
      [bx0, by0, bx1, by1] = [Math.min(bx0, x), Math.min(by0, y), Math.max(bx1, x), Math.max(by1, y)];
    }
  const [dx, dy] = [Math.round((GW - 1 - bx1 - bx0) / 2), Math.round((GH - 1 - by1 - by0) / 2)];
  if (dx || dy) {
    const moved = new Float32Array(GW * GH).fill(-0.05);
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const [sx, sy] = [x - dx, y - dy];
        if (sx >= 0 && sy >= 0 && sx < GW && sy < GH) moved[y * GW + x] = Math.min(h[sy * GW + sx], sx === 0 || sy === 0 || sx === GW - 1 || sy === GH - 1 ? -0.05 : Infinity);
      }
    h.set(moved);
  }
  const share = area / (GW * GH);
  const compact = border || other > area * 0.25 ? 0 : (4 * Math.PI * area) / Math.max(1, edges * edges);
  return { h, area: share, compact };
}

/** The first ground from the seed and its salts that lands in the band (else the most compact of those tried in the area band, else the last). */
export function islandGround(name: string, redraw = 0): Ground & { tries: number } {
  const base = seedOf(name) ^ Math.imul(redraw, 0x9e3779b9);
  let best: (Ground & { tries: number }) | null = null;
  for (let t = 0; t < TRIES; t++) {
    const g = { ...ground((base + Math.imul(t, 0x85ebca6b)) >>> 0), tries: t + 1 };
    const inBand = g.area >= AREA[0] && g.area <= AREA[1];
    if (inBand && g.compact >= COMPACT) return g;
    if (!best || (inBand && g.compact > (best.area >= AREA[0] && best.area <= AREA[1] ? best.compact : -1))) best = g;
  }
  return best!;
}

/** Bilinear sample of a grid field at chart coordinates. */
const sample = (f: Float32Array, x: number, y: number) => {
  const gx = Math.min(GW - 1.001, Math.max(0, (x - X0) / C)), gy = Math.min(GH - 1.001, Math.max(0, (y - Y0) / C));
  const [i, j] = [Math.floor(gx), Math.floor(gy)];
  const [u, v] = [gx - i, gy - j];
  const a = f[j * GW + i], b = f[j * GW + i + 1], c = f[(j + 1) * GW + i], d = f[(j + 1) * GW + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const toChart = ([x, y]: Point): Point => [X0 + (x - 1) * C, Y0 + (y - 1) * C];
const pathOf = (runs: Point[][], width: number) => {
  let d = "";
  for (const r of runs) r.forEach(([x, y], i) => (d += `${i ? "L" : "M"}${f1(x)} ${f1(y)}`));
  return d ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>` : "";
};

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function islandBody(p: Params): string {
  const { h } = islandGround(p.n, p.s ?? 0);
  let hmax = 0;
  for (const v of h) hmax = Math.max(hmax, v);
  let s = "";

  // Distance to land (units), a two-pass chamfer over the cells.
  const dist = new Float32Array(GW * GH);
  for (let k = 0; k < GW * GH; k++) dist[k] = h[k] > 0 ? 0 : 1e6;
  const D1 = C, D2 = C * Math.SQRT2;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + D1);
      if (j > 0) dist[k] = Math.min(dist[k], dist[k - GW] + D1, i > 0 ? dist[k - GW - 1] + D2 : 1e6, i < GW - 1 ? dist[k - GW + 1] + D2 : 1e6);
    }
  for (let j = GH - 1; j >= 0; j--)
    for (let i = GW - 1; i >= 0; i--) {
      const k = j * GW + i;
      if (i < GW - 1) dist[k] = Math.min(dist[k], dist[k + 1] + D1);
      if (j < GH - 1) dist[k] = Math.min(dist[k], dist[k + GW] + D1, i < GW - 1 ? dist[k + GW + 1] + D2 : 1e6, i > 0 ? dist[k + GW - 1] + D2 : 1e6);
    }

  // The compass rose: in the corner with the most open sea.
  const corners: Point[] = [[X0 + 24, Y0 + 26], [X1 - 24, Y0 + 26], [X0 + 24, Y1 - 26], [X1 - 24, Y1 - 26]];
  const rose = corners.reduce((a, b) => (sample(dist, b[0], b[1]) > sample(dist, a[0], a[1]) + 0.01 ? b : a));
  const roseBox: Box = { x0: rose[0] - 20, y0: rose[1] - 26, x1: rose[0] + 20, y1: rose[1] + 20 };

  // The sea along the coast: rows 2.4 apart, solid within 7 units of land, dashed out to 15.
  let hatch = "";
  for (let y = Y0 + 1.2; y <= Y1; y += 2.4) {
    let run: number | null = null;
    const flush = (x: number) => {
      if (run !== null && x - run > 0.9) hatch += `M${f1(run)} ${f1(y)}H${f1(x)}`;
      run = null;
    };
    for (let x = X0; x <= X1; x += 0.5) {
      const d = sample(dist, x, y);
      const inRose = Math.hypot(x - rose[0], y - rose[1]) < 19;
      const wet = sample(h, x, y) < 0 && !inRose && (d <= 7 || (d <= 15 && (x + y * 0.37) % 5 < 3));
      if (wet && run === null) run = x;
      else if (!wet) flush(x);
    }
    flush(X1);
  }
  s += `<path d="${hatch}" fill="none" stroke="${INK}" stroke-width=".5"/>`;

  // The coast and the contours (every third one heavier).
  const field = pad(h, GW, GH, -1);
  const runs = (level: number) => isolines(field, GW + 2, GH + 2, level).map((r) => (r.closed ? [...r.pts, r.pts[0]] : r.pts).map(toChart));
  for (let k = 1; k < LEVELS; k++) s += pathOf(runs((hmax * k) / LEVELS), k % 3 === 0 ? 0.8 : 0.5);
  s += pathOf(runs(0), 1.5);

  // The rose.
  const [rx, ry] = rose;
  s += circle(rx, ry, 13, 0.7) + circle(rx, ry, 10.5, 0.45);
  const kite = (a: number, len: number, wide: number, fill: boolean) => {
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    const tip: Point = [rx + ca * len, ry + sa * len], l: Point = [rx - sa * wide, ry + ca * wide], r: Point = [rx + sa * wide, ry - ca * wide];
    const d = `M${f1(l[0])} ${f1(l[1])}L${f1(tip[0])} ${f1(tip[1])}L${f1(r[0])} ${f1(r[1])}Z`;
    return `<path d="${d}" fill="${fill ? INK : GROUND}" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>`;
  };
  for (let q = 0; q < 4; q++) s += kite(-Math.PI / 4 + (q * Math.PI) / 2, 9, 2.2, false);
  for (let q = 0; q < 4; q++) s += kite(-Math.PI / 2 + (q * Math.PI) / 2, 17, 3, q === 0);
  s += text(rx, ry - 20, "N", 6.5, { bold: true });

  // Where the places go: peaks (local highs), capes and bays along the coast.
  const cands: { x: number; y: number; kind: "peak" | "coast" }[] = [];
  for (let j = 4; j < GH - 4; j++)
    for (let i = 4; i < GW - 4; i++) {
      const v = h[j * GW + i];
      if (v < hmax * 0.3) continue;
      let top = true;
      for (let b = -4; b <= 4 && top; b++) for (let a = -4; a <= 4; a++) if ((a || b) && h[(j + b) * GW + i + a] >= v) (top = false);
      if (top) cands.push({ x: X0 + i * C, y: Y0 + j * C, kind: "peak" });
    }
  cands.sort((a, b) => sample(h, b.x, b.y) - sample(h, a.x, a.y));
  const coast = runs(0).sort((a, b) => b.length - a.length)[0] ?? [];
  const coastal: { x: number; y: number; kind: "coast"; bend: number }[] = [];
  for (let k = 0; k < coast.length; k += 3) {
    const [x, y] = coast[k];
    let land = 0;
    for (let a = 0; a < 16; a++) land += sample(h, x + Math.cos(a * 0.3927) * 12, y + Math.sin(a * 0.3927) * 12) > 0 ? 1 : 0;
    coastal.push({ x, y, kind: "coast", bend: Math.abs(land / 16 - 0.5) });
  }
  // The most pronounced capes and bays first.
  coastal.sort((a, b) => b.bend - a.bend || a.x - b.x || a.y - b.y);
  const pool = [...cands, ...coastal];
  const names = p.x ?? [];
  const chosen: { x: number; y: number; kind: "peak" | "coast" }[] = [];
  for (let gap = 70; chosen.length < names.length && gap > 8; gap *= 0.85) {
    for (const c of pool) {
      if (chosen.length >= names.length) break;
      if (chosen.includes(c) || Math.hypot(c.x - rx, c.y - ry) < 26) continue;
      if (chosen.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= gap)) chosen.push(c);
    }
  }

  // The names: beside their mark where they fit (in the chart, clear of the rose and each other), on cleared ground.
  const SIZE = 6.2, CW = 0.602 * SIZE + 0.4;
  const taken: Box[] = [roseBox, ...chosen.map((c) => ({ x0: c.x - 3.5, y0: c.y - 3.5, x1: c.x + 3.5, y1: c.y + 3.5 }))];
  let marks = "", labels = "";
  chosen.forEach((c, k) => {
    const name = names[k];
    const w = name.length * CW;
    marks += c.kind === "peak" ? `<path d="M${f1(c.x - 3)} ${f1(c.y + 2)}L${f1(c.x)} ${f1(c.y - 3)}L${f1(c.x + 3)} ${f1(c.y + 2)}Z" fill="${INK}" stroke="${INK}" stroke-width=".5" stroke-linejoin="round"/>` : `<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="2.6" fill="${GROUND}" stroke="${INK}" stroke-width="1"/><circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="1" fill="${INK}"/>`;
    const options: [number, number, "start" | "end" | "middle"][] = [
      [c.x + 6, c.y + 2.2, "start"], [c.x - 6, c.y + 2.2, "end"], [c.x, c.y - 6, "middle"], [c.x, c.y + 10, "middle"],
      [c.x + 5, c.y - 5, "start"], [c.x - 5, c.y - 5, "end"], [c.x + 5, c.y + 9, "start"], [c.x - 5, c.y + 9, "end"],
    ];
    const boxOf = ([x, y, a]: (typeof options)[number]): Box => {
      const left = a === "start" ? x : a === "end" ? x - w : x - w / 2;
      return { x0: left - 1.2, y0: y - SIZE * 0.78, x1: left + w + 1.2, y1: y + SIZE * 0.28 };
    };
    const inside = (b: Box) => b.x0 >= X0 && b.x1 <= X1 && b.y0 >= Y0 && b.y1 <= Y1;
    const own = taken.indexOf(taken.find((t) => t.x0 === c.x - 3.5 && t.y0 === c.y - 3.5)!);
    const pick = options.find((o) => inside(boxOf(o)) && taken.every((t, i) => i === own || !hit(t, boxOf(o)))) ?? options.find((o) => inside(boxOf(o))) ?? options[0];
    const b = boxOf(pick);
    taken.push(b);
    labels += `<rect x="${f1(b.x0)}" y="${f1(b.y0)}" width="${f1(b.x1 - b.x0)}" height="${f1(b.y1 - b.y0)}" fill="${GROUND}"/>` + text(pick[0], pick[1], name, SIZE, { anchor: pick[2], bold: true });
  });
  s += labels + marks;

  // A scale bar in the corner the rose leaves (a chart's leagues, for an island that has none).
  const bx = rose[0] < 150 ? X1 - 46 : X0 + 2, by = Y1 + 8;
  s += `<path d="M${bx} ${by}H${bx + 44}M${bx} ${by - 2}V${by + 2}M${bx + 22} ${by - 2}V${by + 2}M${bx + 44} ${by - 2}V${by + 2}" fill="none" stroke="${INK}" stroke-width=".8"/>` + line(bx, by, bx + 22, by, 2);
  s += text(bx + 22, by + 8, "2 leagues", 5);

  const joined = names.join(" · ");
  const sub = !names.length ? "Uncharted" : joined.length <= 56 ? joined : `${names.length} places`;
  return s + caption(342, p.n, sub);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(islandBody((spec as { p: Params }).p), color);
