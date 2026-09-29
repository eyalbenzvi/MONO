/**
 * Level lines of a sampled field, and the hatching of what lies inside them:
 * marching squares (the saddles decided by the cell's centre), the pieces
 * joined into runs, each run closed when it comes back to its start. Your
 * Island draws its coast and contours with it, Your Route the rings round
 * the route, and scripts/tools/fetchStreets.ts traces the water it hatches.
 * Pure; coordinates are the field's own (x a column, y a row).
 */
import type { Point } from "./paths";

export interface Run {
  pts: Point[];
  closed: boolean;
}

const TOP = 0, RIGHT = 1, BOTTOM = 2, LEFT = 3;
/** Each case's pieces, as pairs of cell edges (the saddles 5 and 10 listed for a centre outside, then inside). */
const CASES: number[][] = [
  [], [LEFT, BOTTOM], [BOTTOM, RIGHT], [LEFT, RIGHT], [TOP, RIGHT], [TOP, RIGHT, LEFT, BOTTOM], [TOP, BOTTOM], [TOP, LEFT],
  [TOP, LEFT], [TOP, BOTTOM], [TOP, LEFT, BOTTOM, RIGHT], [TOP, RIGHT], [LEFT, RIGHT], [RIGHT, BOTTOM], [LEFT, BOTTOM], [],
];
const SADDLE_IN: Record<number, number[]> = { 5: [LEFT, TOP, RIGHT, BOTTOM], 10: [TOP, RIGHT, LEFT, BOTTOM] };

/** The runs where `f` (w × h, row by row) crosses `level`. Pad the field with low values first for runs that all close. */
export function isolines(f: ArrayLike<number>, w: number, h: number, level: number): Run[] {
  // Every crossing lives on a grid edge: horizontal edge (x, y)–(x+1, y) is 2(yw+x), vertical (x, y)–(x, y+1) is 2(yw+x)+1.
  const at = new Map<number, Point>();
  const links = new Map<number, number[]>();
  const point = (id: number): Point => {
    let p = at.get(id);
    if (p) return p;
    const cell = id >> 1, x = cell % w, y = (cell - x) / w;
    const [x2, y2] = id & 1 ? [x, y + 1] : [x + 1, y];
    const a = f[y * w + x], b = f[y2 * w + x2];
    const t = a === b ? 0.5 : Math.min(1, Math.max(0, (level - a) / (b - a)));
    p = [x + (x2 - x) * t, y + (y2 - y) * t];
    at.set(id, p);
    return p;
  };
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w - 1; x++) {
      const tl = f[y * w + x] >= level, tr = f[y * w + x + 1] >= level, br = f[(y + 1) * w + x + 1] >= level, bl = f[(y + 1) * w + x] >= level;
      const k = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (k === 0 || k === 15) continue;
      let pieces = CASES[k];
      if (k === 5 || k === 10) {
        const c = (f[y * w + x] + f[y * w + x + 1] + f[(y + 1) * w + x + 1] + f[(y + 1) * w + x]) / 4;
        if (c >= level) pieces = SADDLE_IN[k];
      }
      const edge = (e: number) => (e === TOP ? 2 * (y * w + x) : e === BOTTOM ? 2 * ((y + 1) * w + x) : e === LEFT ? 2 * (y * w + x) + 1 : 2 * (y * w + x + 1) + 1);
      for (let i = 0; i < pieces.length; i += 2) link(edge(pieces[i]), edge(pieces[i + 1]));
    }
  // Walk the chains: open ones from an end first (sorted, so the same field gives the same runs), then the rings.
  const seen = new Set<number>();
  const runs: Run[] = [];
  const walk = (start: number) => {
    const ids = [start];
    seen.add(start);
    let prev = -1, cur = start;
    for (;;) {
      const next = (links.get(cur) ?? []).find((n) => n !== prev && !seen.has(n));
      if (next === undefined) break;
      seen.add(next);
      ids.push(next);
      prev = cur;
      cur = next;
    }
    const closed = ids.length > 2 && (links.get(cur) ?? []).includes(start);
    runs.push({ pts: ids.map(point), closed });
  };
  const keys = [...links.keys()].sort((a, b) => a - b);
  for (const id of keys) if (!seen.has(id) && links.get(id)!.length === 1) walk(id);
  for (const id of keys) if (!seen.has(id)) walk(id);
  return runs;
}

/** A field with a border of `v` round it (w+2 × h+2), so every level line above `v` closes. */
export function pad(f: ArrayLike<number>, w: number, h: number, v: number): Float32Array {
  const out = new Float32Array((w + 2) * (h + 2)).fill(v);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(y + 1) * (w + 2) + x + 1] = f[y * w + x];
  return out;
}

/**
 * Horizontal hatching inside closed rings (even–odd: a ring inside a ring is
 * a hole): for each row y = y0, y0 + gap, …, the spans inside, as [x1, x2, y].
 */
export function hatchSpans(rings: Point[][], y0: number, y1: number, gap: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let y = y0; y <= y1; y += gap) {
    const xs: number[] = [];
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const [a, b] = [r[i], r[(i + 1) % r.length]];
        if (a[1] <= y !== b[1] <= y) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1], y]);
  }
  return out;
}

/** Whether a point is inside the rings (even–odd). */
export function inside(rings: Point[][], x: number, y: number): boolean {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}

/** Smooth value noise on the integer lattice, seeded (a hash, not a table: any size, the same everywhere). */
export function valueNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ seed;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [u, v] = [s(x - x0), s(y - y0)];
    const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal Brownian motion: `octaves` of value noise, each twice the frequency and half the weight (0–1). */
export function fbm(seed: number, octaves = 5) {
  const layers = Array.from({ length: octaves }, (_, i) => valueNoise((seed + Math.imul(i + 1, 0x9e3779b1)) | 0));
  return (x: number, y: number) => {
    let [sum, amp, norm, fx, fy] = [0, 1, 0, x, y];
    for (const n of layers) (sum += n(fx, fy) * amp), (norm += amp), (amp *= 0.5), (fx *= 2), (fy *= 2);
    return sum / norm;
  };
}
