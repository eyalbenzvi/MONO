/**
 * A Julia set drawn in lines: z → z² + c iterated over a grid, each point's
 * smooth escape time (the continuous iteration count), and the bands of
 * escape time traced as contours by marching squares, the way a survey
 * draws height. The set itself (the points that never escape) is outlined
 * bold. Levels are chosen by area (each band holds about as much of the
 * picture as the next), only levels whose contour closes inside the box are
 * drawn, and a contour thins out where the bands crowd (a cell spanning more
 * than a band draws nothing), so lines never pack tighter than a cell. One
 * ink: no greys, the tone is the spacing of the lines.
 */
import { f1 } from "../kit";
import type { Box } from "./paths";

export interface JuliaDrawing {
  /** The escape-time contours, as path data. */
  bands: string;
  /** The settling-time contours inside the set ("" when c has no attracting cycle). */
  inner: string;
  /** The set's outline (never escaping, to the iteration limit), as path data. */
  edge: string;
  /** How many contour levels were drawn. */
  levels: number;
  /** For curating c: the set's share of the box, how many separate pieces its outline has, and how intricate it is (its outline's length squared over its area: a disc is 4π ≈ 12.6). */
  inShare: number;
  pieces: number;
  complexity: number;
}

const BAIL = 64;
/** Room round the set for its contours, as a share of its reach. */
const MARGIN = 1.22;
/** Contour runs shorter than this (print units) are left out: specks where the escape time is chaotic at the grid's scale. */
const SPECK = 3;
const LOG2 = Math.log(2);

/**
 * Marching squares over a grid of values: the contour at `level` as point
 * chains (grid units), cells where the field changes by more than `steep`
 * left out. Segments are joined through the grid edges they cross, so each
 * chain is one run of path data.
 */
/** Scratch arrays for the marching squares, one set per grid (cleared after each level: only what was touched). */
interface Work {
  l1: Int32Array;
  l2: Int32Array;
  px: Float64Array;
  py: Float64Array;
  has: Uint8Array;
  seen: Uint8Array;
}
const work = (E: number): Work => ({ l1: new Int32Array(E).fill(-1), l2: new Int32Array(E).fill(-1), px: new Float64Array(E), py: new Float64Array(E), has: new Uint8Array(E), seen: new Uint8Array(E) });

function contour(v: Float64Array, nx: number, ny: number, level: number, steep: number, w: Work = work(2 * nx * ny)): [number, number][][] {
  // Edge ids: horizontal edge (i, j)→(i+1, j) is j*nx+i; vertical edge (i, j)→(i, j+1) is nx*ny + j*nx + i. An edge
  // crossing joins at most two cells, so each has at most two links.
  const { l1, l2, px, py, has, seen } = w;
  const touched: number[] = [];
  const cross = (id: number, i0: number, j0: number, i1: number, j1: number) => {
    if (!has[id]) {
      has[id] = 1;
      const a = v[j0 * nx + i0], b = v[j1 * nx + i1];
      const t = a === b || !Number.isFinite(a - b) ? 0.5 : (level - a) / (b - a);
      px[id] = i0 + (i1 - i0) * t;
      py[id] = j0 + (j1 - j0) * t;
      touched.push(id);
    }
    return id;
  };
  const link = (a: number, b: number) => {
    if (l1[a] < 0) l1[a] = b;
    else l2[a] = b;
    if (l1[b] < 0) l1[b] = a;
    else l2[b] = a;
  };
  const V = nx * ny;
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
      const k = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (k === 0 || k === 15) continue;
      if (steep > 0 && !(Math.max(a, b, c, d) - Math.min(a, b, c, d) <= steep)) continue;
      const top = () => cross(j * nx + i, i, j, i + 1, j);
      const bottom = () => cross((j + 1) * nx + i, i, j + 1, i + 1, j + 1);
      const left = () => cross(V + j * nx + i, i, j, i, j + 1);
      const right = () => cross(V + j * nx + i + 1, i + 1, j, i + 1, j + 1);
      switch (k) {
        case 1: case 14: link(left(), top()); break;
        case 2: case 13: link(top(), right()); break;
        case 3: case 12: link(left(), right()); break;
        case 4: case 11: link(right(), bottom()); break;
        case 6: case 9: link(top(), bottom()); break;
        case 7: case 8: link(left(), bottom()); break;
        case 5: case 10: {
          // A saddle: the centre's value decides which corners join.
          const mid = (a + b + c + d) / 4 >= level;
          if ((k === 5) === mid) link(left(), top()), link(right(), bottom());
          else link(left(), bottom()), link(top(), right());
          break;
        }
      }
    }
  // Chains: from the open ends first (one link), then the closed loops; each crossing is visited once.
  const chains: [number, number][][] = [];
  const walk = (start: number) => {
    const chain: [number, number][] = [];
    let [prev, cur] = [-1, start];
    while (cur >= 0 && !seen[cur]) {
      seen[cur] = 1;
      chain.push([px[cur], py[cur]]);
      const next = l1[cur] !== prev && l1[cur] >= 0 && !seen[l1[cur]] ? l1[cur] : l2[cur] !== prev && l2[cur] >= 0 && !seen[l2[cur]] ? l2[cur] : -1;
      // A loop closes on its start.
      if (next < 0 && chain.length > 2 && (l1[cur] === start || l2[cur] === start)) chain.push([px[start], py[start]]);
      [prev, cur] = [cur, next];
    }
    if (chain.length > 1) chains.push(chain);
  };
  touched.sort((a, b) => a - b);
  for (const id of touched) if (!seen[id] && (l1[id] < 0) !== (l2[id] < 0)) walk(id);
  for (const id of touched) if (!seen[id]) walk(id);
  for (const id of touched) (l1[id] = -1), (l2[id] = -1), (has[id] = 0), (seen[id] = 0);
  return chains;
}

/** Point chains as path data, in print units: grid (i, j) → box. */
function chainsPath(chains: [number, number][][], x0: number, y0: number, step: number): string {
  let d = "";
  for (const ch of chains) {
    let len = 0;
    for (let k = 1; k < ch.length && len * step < SPECK; k++) len += Math.hypot(ch[k][0] - ch[k - 1][0], ch[k][1] - ch[k - 1][1]);
    if (len * step < SPECK) continue;
    let last = "";
    ch.forEach(([i, j], k) => {
      const p = `${f1(x0 + i * step)} ${f1(y0 + j * step)}`;
      if (p === last) return;
      d += (k === 0 ? "M" : "L") + p;
      last = p;
    });
  }
  return d;
}

/** An attracting cycle of z → z² + c (the orbit of 0 settles on it when c is inside the Mandelbrot set's hyperbolic parts). */
export interface Cycle {
  /** Its points, [re, im]. */
  points: [number, number][];
  /** Its multiplier's size (under 1: attracting; near 1: the set is intricate, and slow to settle). */
  mult: number;
}

/** The attracting cycle the critical orbit settles on (period up to 16), or null (c outside, or on the edge). */
export function attractingCycle(cx: number, cy: number): Cycle | null {
  let [x, y] = [0, 0];
  for (let n = 0; n < 4000; n++) {
    [x, y] = [x * x - y * y + cx, 2 * x * y + cy];
    if (x * x + y * y > 4) return null;
  }
  const [x0, y0] = [x, y];
  const points: [number, number][] = [];
  for (let p = 1; p <= 16; p++) {
    points.push([x, y]);
    [x, y] = [x * x - y * y + cx, 2 * x * y + cy];
    if (Math.hypot(x - x0, y - y0) < 1e-9) {
      const mult = points.reduce((m, [a, b]) => m * 2 * Math.hypot(a, b), 1);
      return mult < 1 ? { points, mult } : null;
    }
  }
  return null;
}

export interface JuliaOptions {
  /** Grid points across the box (fewer is faster and coarser). */
  across?: number;
  /** Escape-time levels to trace outside the set, and settling-time levels inside it. */
  levels?: number;
  inner?: number;
  /** The iteration limit. */
  max?: number;
}

/** How close to the cycle counts as arrived (the settling time's zero). */
const NEAR = 1e-2;
/** How close (in grid cells) to the set an escaping point may be and still count as on it. */
const THREAD = 0.45;

/**
 * The filled Julia set of c, fitted into the box: turned so its long axis
 * stands upright, scaled so the set and a margin of contours fill the box.
 * Outside, the escape time's contours; inside (c with an attracting cycle),
 * the time each point takes to settle on the cycle, traced the same way.
 */
export function juliaDrawing(cx: number, cy: number, box: Box, o: JuliaOptions = {}): JuliaDrawing {
  const max = o.max ?? 400;
  const cyc = attractingCycle(cx, cy);
  const pts = cyc?.points ?? [];
  // Per step, near the cycle, the distance to it shrinks by this much (the multiplier spread over the period).
  const rho = cyc ? Math.max(1e-6, cyc.mult) ** (1 / pts.length) : 0.5;
  /** Outside: +escape time. Inside: −(1 + settling time). Neither, by the limit: Infinity. */
  const px = pts.map((p) => p[0]), py = pts.map((p) => p[1]);
  const np = pts.length, near2 = NEAR * NEAR, bail2 = BAIL * BAIL, lr = Math.log(1 / rho);
  // The distance estimate of the last point that escaped (|z| log|z| / |dz/dz0|): how far it lies from the set.
  let de = Infinity;
  const field = (zx: number, zy: number, lim: number): number => {
    let [dx0, dy0] = [1, 0];
    for (let n = 0; n < lim; n++) {
      const x2 = zx * zx, y2 = zy * zy;
      if (x2 + y2 > bail2) {
        const r = Math.sqrt(x2 + y2);
        de = (r * Math.log(r)) / Math.hypot(dx0, dy0);
        return n + 1 - Math.log(Math.log(x2 + y2) / 2) / LOG2;
      }
      [dx0, dy0] = [2 * (zx * dx0 - zy * dy0), 2 * (zx * dy0 + zy * dx0)];
      for (let k = 0; k < np; k++) {
        const dx = zx - px[k], dy = zy - py[k], d2 = dx * dx + dy * dy;
        if (d2 < near2) return -(1 + Math.max(0, n - Math.log(near2 / Math.max(d2, 1e-300)) / 2 / lr));
      }
      zy = 2 * zx * zy + cy;
      zx = x2 - y2 + cx;
    }
    return Infinity;
  };

  // A first look, coarse, at the whole plane the set can be in (|z| ≤ 2): its axis and reach.
  const N0 = 80;
  const coarse: number[] = [];
  for (let j = 0; j < N0; j++)
    for (let i = 0; i < N0; i++) coarse.push(field(-2 + (4 * (i + 0.5)) / N0, -2 + (4 * (j + 0.5)) / N0, 200));
  const solid = coarse.some((m) => !(m > 0 && Number.isFinite(m)));
  // The set's mass (or, for dust, the slow escapers', by escape time), for its long axis.
  let [sxx, syy, sxy] = [0, 0, 0];
  coarse.forEach((m, k) => {
    const [x, y] = [-2 + (4 * ((k % N0) + 0.5)) / N0, -2 + (4 * (Math.floor(k / N0) + 0.5)) / N0];
    const wgt = m > 0 && Number.isFinite(m) ? (solid ? 0 : Math.max(0, m - 3)) : 1;
    [sxx, syy, sxy] = [sxx + wgt * x * x, syy + wgt * y * y, sxy + wgt * x * y];
  });
  // The long axis (principal axis of the weighted points), turned to stand upright.
  const phi = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const [ca, sa] = [Math.cos(phi - Math.PI / 2), Math.sin(phi - Math.PI / 2)];
  // Screen (u, v) → plane: rotate by the axis angle so the long axis runs down the print.
  const toZ = (u: number, v: number): [number, number] => [u * ca - v * sa, u * sa + v * ca];

  // Reach: how far out the set goes (the points that don't escape, or, for dust, the slowest escapers), along each
  // screen axis, with a margin for the contours round it.
  const esc = coarse.filter((m) => m > 0 && Number.isFinite(m)).sort((a, b) => a - b);
  const core = solid ? Infinity : esc[Math.floor(esc.length * 0.9)];
  let [ur, vr] = [0.1, 0.1];
  for (let j = 0; j < N0; j++)
    for (let i = 0; i < N0; i++) {
      const m = coarse[j * N0 + i];
      if (m > 0 && m < core) continue;
      const [x, y] = [-2 + (4 * (i + 0.5)) / N0, -2 + (4 * (j + 0.5)) / N0];
      // The inverse turn: plane → screen.
      const u = x * ca + y * sa, v = -x * sa + y * ca;
      [ur, vr] = [Math.max(ur, Math.abs(u) + 2 / N0), Math.max(vr, Math.abs(v) + 2 / N0)];
    }
  [ur, vr] = [ur * MARGIN, vr * MARGIN];
  const scale = Math.min(box.w / 2 / ur, box.h / 2 / vr);
  const nx = o.across ?? 170;
  const step = box.w / (nx - 1);
  const ny = Math.floor(box.h / step) + 1;
  const bx = box.x, by = box.y + (box.h - (ny - 1) * step) / 2;
  const [mx, my] = [box.x + box.w / 2, box.y + box.h / 2];
  // Three grids for the marching squares: escape time (the set counts as Infinity), settling time (outside counts as
  // Infinity), and the set itself (1 inside).
  const out = new Float64Array(nx * ny);
  const settle = new Float64Array(nx * ny);
  const inside = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const [zx, zy] = toZ((bx + i * step - mx) / scale, (by + j * step - my) / scale);
      const m = field(zx, zy, max);
      const k = j * nx + i;
      const escaped = m > 0 && Number.isFinite(m);
      out[k] = escaped ? m : Infinity;
      settle[k] = m < 0 ? -m : Infinity;
      // The set, thickened to the print's finest line: points that escape but lie within a fraction of a cell of it
      // count as on it, so a dendrite's threads and a near-boundary set's spirals draw as lines, not scattered dust.
      // Kept as a distance (negated, in cells) so the outline is traced smoothly between grid points.
      inside[k] = escaped ? -de / (step / scale) : 0;
    }
  // Outside, every contour must close inside the box: levels start above the highest escape time on its border.
  let rim = 0;
  for (let i = 0; i < nx; i++) rim = Math.max(rim, out[i], out[(ny - 1) * nx + i]);
  for (let j = 0; j < ny; j++) rim = Math.max(rim, out[j * nx], out[j * nx + nx - 1]);
  const pick = (vals: number[], want: number) => {
    vals.sort((a, b) => a - b);
    const lv: number[] = [];
    // By area: each band holds about as much of the picture as the next.
    for (let k = 1; k <= want && vals.length > 40; k++) {
      const q = vals[Math.floor((vals.length * k) / (want + 1))];
      if (!lv.length || q - lv[lv.length - 1] > 0.05) lv.push(q);
    }
    return lv;
  };
  const w = work(2 * nx * ny);
  const trace = (grid: Float64Array, lv: number[]) =>
    lv
      .map((l, k) => {
        const gap = Math.min(k > 0 ? l - lv[k - 1] : Infinity, k < lv.length - 1 ? lv[k + 1] - l : Infinity);
        return chainsPath(contour(grid, nx, ny, l, Number.isFinite(gap) ? gap * 1.1 : 0, w), bx, by, step);
      })
      .join("");
  const outLv = pick(Array.from(out).filter((m) => Number.isFinite(m) && m > rim), o.levels ?? 8);
  const inLv = pick(Array.from(settle).filter(Number.isFinite), o.inner ?? 7);
  const rims = contour(inside, nx, ny, -THREAD, 0, w);
  return {
    bands: trace(out, outLv),
    inner: trace(settle, inLv),
    edge: chainsPath(rims, bx, by, step),
    levels: outLv.length + inLv.length,
    inShare: inside.reduce((a, b) => a + (b >= -THREAD ? 1 : 0), 0) / inside.length,
    pieces: rims.length,
    complexity: (() => {
      let len = 0;
      for (const ch of rims) for (let k = 1; k < ch.length; k++) len += Math.hypot(ch[k][0] - ch[k - 1][0], ch[k][1] - ch[k - 1][1]);
      const area = inside.reduce((a, b) => a + (b >= -THREAD ? 1 : 0), 0);
      return area ? (len * len) / area : 0;
    })(),
  };
}
