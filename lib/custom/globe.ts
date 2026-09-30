/**
 * The land on an orthographic globe (Your Place, Your Journey): the
 * countries of Your Countries (data/countries, Natural Earth's outlines kept
 * in Equal Earth) taken back to the sphere once, split into coastline (an
 * edge no other country shares) and border (drawn once), and the pieces
 * along the ±180° seam and the south pole's line left out. Each drawing
 * projects them for its view: what's round the back hidden, a line cut
 * exactly where it goes over the horizon or out of the lens, simplified to
 * the print's scale (Douglas-Peucker on screen), and specks too small to
 * print dropped. The land can be hatched: level lines, each cut where it
 * crosses a coast (found on a mask of the land, a lookup per point).
 */
import { f1 } from "./kit";
import { EE_X, EE_Y } from "./equalEarth";
import type { Countries } from "./data";

export type V3 = [number, number, number];
const DEG = Math.PI / 180;
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/** Equal Earth (x east, y north, radius 1) back to latitude and longitude, degrees. */
export function equalEarthInverse(x: number, y: number): [number, number] {
  let t = y / A1;
  for (let i = 0; i < 12; i++) {
    const t2 = t * t, t6 = t2 * t2 * t2;
    const f = t * (A1 + A2 * t2 + A3 * t6 + A4 * t6 * t2) - y;
    const df = A1 + 3 * A2 * t2 + 7 * A3 * t6 + 9 * A4 * t6 * t2;
    const dt = f / df;
    t -= dt;
    if (Math.abs(dt) < 1e-12) break;
  }
  const t2 = t * t, t6 = t2 * t2 * t2;
  const lat = Math.asin(Math.max(-1, Math.min(1, Math.sin(t) / M)));
  const lon = (x * 3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)) / (2 * Math.sqrt(3) * Math.cos(t));
  return [lat / DEG, Math.max(-180, Math.min(180, lon / DEG))];
}

export const vec = (lat: number, lon: number): V3 => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];

/** The land mask: Equal Earth's rectangle in cells. */
const MW = 2048, MH = Math.round((MW * EE_Y) / EE_X);
interface Land {
  /** Polylines on the sphere, x y z x y z… */
  coast: Float64Array[];
  border: Float64Array[];
  mask: Uint16Array;
}
const cache = new WeakMap<Countries, Land>();

/** A piece no longer than this in Equal Earth units (about a degree) is drawn straight; longer ones are split first. */
const STEP = 0.02;

/** Equal Earth (thousandths, y down, as the file keeps it) to a mask cell, or −1 off it. */
const cellOf = (x: number, y: number) => {
  const col = Math.floor(((x / 1000 + EE_X) / (2 * EE_X)) * MW), row = Math.floor(((y / 1000 + EE_Y) / (2 * EE_Y)) * MH);
  return col >= 0 && col < MW && row >= 0 && row < MH ? row * MW + col : -1;
};

/** The mask: each cell the country it's in (its index + 1), 0 for the sea; each country's rows filled between alternate crossings of its rings. */
function buildMask(countries: Countries): Uint16Array {
  const mask = new Uint16Array(MW * MH);
  countries.list.forEach((c, ci) => {
    const xs = new Map<number, number[]>();
    for (const r of c.rings) {
      const n = r.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        // Cell space: x from −EE_X, y from the top.
        const [ax, ay, bx, by] = [((r[2 * i] / 1000 + EE_X) / (2 * EE_X)) * MW, ((r[2 * i + 1] / 1000 + EE_Y) / (2 * EE_Y)) * MH, ((r[2 * j] / 1000 + EE_X) / (2 * EE_X)) * MW, ((r[2 * j + 1] / 1000 + EE_Y) / (2 * EE_Y)) * MH];
        const [y0, y1] = [Math.min(ay, by), Math.max(ay, by)];
        for (let row = Math.max(0, Math.ceil(y0 - 0.5)); row < MH && row + 0.5 < y1; row++) {
          const list = xs.get(row) ?? [];
          list.push(ax + ((row + 0.5 - ay) / (by - ay)) * (bx - ax));
          xs.set(row, list);
        }
      }
    }
    for (const [row, list] of xs) {
      list.sort((m, n) => m - n);
      for (let k = 0; k + 1 < list.length; k += 2)
        for (let col = Math.max(0, Math.ceil(list[k] - 0.5)); col < MW && col + 0.5 < list[k + 1]; col++) mask[row * MW + col] = ci + 1;
    }
  });
  return mask;
}

/** Polylines joined end to start where they meet (a coast runs on from one country into the next), so each is drawn, and smoothed, as one. */
function chain(lines: Float64Array[]): Float64Array[] {
  const at = (L: Float64Array, i: number) => `${L[i]},${L[i + 1]},${L[i + 2]}`;
  const byStart = new Map<string, number>();
  lines.forEach((L, i) => byStart.set(at(L, 0), i));
  const used = new Uint8Array(lines.length);
  const out: Float64Array[] = [];
  // Start from a line nothing runs into, then rings.
  const into = new Set(lines.map((L) => at(L, L.length - 3)));
  const order = [...lines.keys()].sort((a, b) => Number(into.has(at(lines[a], 0))) - Number(into.has(at(lines[b], 0))) || a - b);
  for (const i of order) {
    if (used[i]) continue;
    used[i] = 1;
    const run: number[] = Array.from(lines[i]);
    for (;;) {
      const j = byStart.get(`${run[run.length - 3]},${run[run.length - 2]},${run[run.length - 1]}`);
      if (j === undefined || used[j]) break;
      used[j] = 1;
      for (let k = 3; k < lines[j].length; k++) run.push(lines[j][k]);
    }
    out.push(Float64Array.from(run));
  }
  return out;
}

/** How far to either side of an edge to look for a neighbour (thousandths of Equal Earth: past the slivers the outlines' simplification leaves between neighbours). */
const SIDE = 6;

function build(countries: Countries): Land {
  const mask = buildMask(countries);
  // Each edge by its ends, to know which are shared (a border) and with which country.
  const key = (ax: number, ay: number, bx: number, by: number) => `${ax},${ay},${bx},${by}`;
  const owner = new Map<string, number>();
  countries.list.forEach((c, ci) => {
    for (const r of c.rings) for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      owner.set(key(r[i], r[i + 1], r[j], r[j + 1]), ci);
    }
  });
  const coast: Float64Array[] = [], border: Float64Array[] = [];
  countries.list.forEach((c, ci) => {
    for (const r of c.rings) {
      const n = r.length / 2;
      // Each edge: 0 coast, 1 a border this country draws, 2 not drawn (the neighbour draws it, or it's the seam or the pole).
      const kind: number[] = [];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [ax, ay, bx, by] = [r[2 * i], r[2 * i + 1], r[2 * j], r[2 * j + 1]];
        const [la1, lo1] = equalEarthInverse(ax / 1000, -ay / 1000), [la2, lo2] = equalEarthInverse(bx / 1000, -by / 1000);
        if ((Math.abs(lo1) > 179.7 && Math.abs(lo2) > 179.7) || (la1 < -88.5 && la2 < -88.5)) kind.push(2);
        else {
          let o = owner.get(key(bx, by, ax, ay));
          if (o === undefined) {
            // Not shared exactly (the neighbours were simplified apart): a border when there's land to both sides of its middle, another country's to one.
            const [mx, my, len] = [(ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay) || 1];
            const [nx, ny] = [(-(by - ay) / len) * SIDE, ((bx - ax) / len) * SIDE];
            const sides = [cellOf(mx + nx, my + ny), cellOf(mx - nx, my - ny)].map((cell) => (cell >= 0 ? mask[cell] : 0));
            if (sides[0] && sides[1]) for (const id of sides) if (id !== ci + 1) o = id - 1;
          }
          kind.push(o === undefined ? 0 : o > ci ? 1 : 2);
        }
      }
      // Start where the kind changes, so a run isn't split at the ring's first point.
      let s = 0;
      while (s < n && kind[s] === kind[(s + n - 1) % n]) s++;
      if (s === n) s = 0;
      let run: number[] = [], runKind = -1;
      const flush = () => {
        if (run.length >= 6 && runKind < 2) (runKind === 0 ? coast : border).push(Float64Array.from(run));
        run = [];
      };
      for (let q = 0; q < n; q++) {
        const i = (s + q) % n, j = (i + 1) % n;
        if (kind[i] !== runKind) flush(), (runKind = kind[i]);
        if (runKind === 2) continue;
        const [ax, ay, bx, by] = [r[2 * i] / 1000, -r[2 * i + 1] / 1000, r[2 * j] / 1000, -r[2 * j + 1] / 1000];
        const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
        for (let m = run.length ? 1 : 0; m <= k; m++) run.push(...vec(...equalEarthInverse(ax + ((bx - ax) * m) / k, ay + ((by - ay) * m) / k)));
      }
      flush();
    }
  });
  return { coast: chain(coast), border: chain(border), mask };
}
const landOf = (countries: Countries) => {
  let l = cache.get(countries);
  if (!l) cache.set(countries, (l = build(countries)));
  return l;
};

/** How a globe is seen: its centre on the sphere, the scale (the globe's radius on the print), where it sits, and the round window it's seen through. */
export interface View {
  centre: V3;
  /** The globe's radius, print units (larger than `r` when seen close through a lens). */
  k: number;
  cx: number;
  cy: number;
  /** The window's radius: nothing is drawn beyond it. */
  r: number;
}

/** A view's projection: a point on the sphere to the print, and whether it faces us. */
export function projector(v: View) {
  const c = v.centre;
  const east: V3 = Math.hypot(c[0], c[1]) < 1e-9 ? [0, 1, 0] : norm([-c[1], c[0], 0]);
  const north: V3 = [c[1] * east[2] - c[2] * east[1], c[2] * east[0] - c[0] * east[2], c[0] * east[1] - c[1] * east[0]];
  return (x: number, y: number, z: number): [number, number, number] => [v.cx + v.k * (x * east[0] + y * east[1] + z * east[2]), v.cy - v.k * (x * north[0] + y * north[1] + z * north[2]), x * c[0] + y * c[1] + z * c[2]];
}
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Douglas-Peucker on screen points (x, y pairs). */
function simplify(p: number[], tol: number): number[] {
  const n = p.length / 2;
  if (n < 3) return p;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay, bx, by] = [p[2 * a], p[2 * a + 1], p[2 * b], p[2 * b + 1]];
    const len = Math.hypot(bx - ax, by - ay);
    let far = -1, best = tol;
    for (let i = a + 1; i < b; i++) {
      const d = len < 1e-9 ? Math.hypot(p[2 * i] - ax, p[2 * i + 1] - ay) : Math.abs((bx - ax) * (ay - p[2 * i + 1]) - (ax - p[2 * i]) * (by - ay)) / len;
      if (d > best) (best = d), (far = i);
    }
    if (far >= 0) (keep[far] = 1), stack.push([a, far], [far, b]);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
  return out;
}

/**
 * Polylines on the sphere as path data for a view: the back hidden, each cut
 * where it goes over the horizon (the crossing found on the chord, then put
 * on the limb) or out of the window (on the circle), simplified to `tol`,
 * pieces spanning less than `min` dropped.
 */
export function tracePolylines(lines: Float64Array[], v: View, tol = 0.25, min = 1): string {
  return piecesPath(projectPolylines(lines, v, tol, min));
}
/**
 * A polyline's corners cut (Chaikin: each edge's quarter points), its ends
 * kept, or all the way round when it closes: seen close, the outlines'
 * simplification shows as corners that no coast has.
 */
function chaikin(p: number[]): number[] {
  const n = p.length / 2;
  if (n < 3) return p;
  const closed = Math.hypot(p[0] - p[p.length - 2], p[1] - p[p.length - 1]) < 1e-6;
  const out: number[] = closed ? [] : [p[0], p[1]];
  for (let i = 0; i + 1 < n; i++) {
    const [ax, ay, bx, by] = [p[2 * i], p[2 * i + 1], p[2 * i + 2], p[2 * i + 3]];
    if (closed || i > 0) out.push(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by);
    if (closed || i + 2 < n) out.push(0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by);
  }
  if (closed) out.push(out[0], out[1]);
  else out.push(p[p.length - 2], p[p.length - 1]);
  return out;
}

/** Screen polylines (x, y pairs) as path data. */
function piecesPath(pieces: number[][]): string {
  let d = "";
  for (const s of pieces) {
    d += `M${f1(s[0])} ${f1(s[1])}`;
    for (let i = 2; i < s.length; i += 2) d += `L${f1(s[i])} ${f1(s[i + 1])}`;
  }
  return d;
}
/** Polylines on the sphere on the print, as tracePolylines draws them: each visible piece's points, x, y pairs. */
function projectPolylines(lines: Float64Array[], v: View, tol: number, min: number): number[][] {
  const proj = projector(v);
  const r2 = v.r * v.r;
  const out: number[][] = [];
  let cur: number[] = [];
  const emit = () => {
    if (cur.length >= 4) {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < cur.length; i += 2) (x0 = Math.min(x0, cur[i])), (x1 = Math.max(x1, cur[i])), (y0 = Math.min(y0, cur[i + 1])), (y1 = Math.max(y1, cur[i + 1]));
      if (Math.max(x1 - x0, y1 - y0) >= min) out.push(simplify(cur, tol));
    }
    cur = [];
  };
  /** The part of screen segment a→b inside the window, as fractions [t0, t1], or null. */
  const inWindow = (ax: number, ay: number, bx: number, by: number): [number, number] | null => {
    const [px, py, qx, qy] = [ax - v.cx, ay - v.cy, bx - ax, by - ay];
    const A = qx * qx + qy * qy, B = 2 * (px * qx + py * qy), C = px * px + py * py - r2;
    if (A < 1e-12) return C <= 0 ? [0, 1] : null;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) return null;
    const sq = Math.sqrt(disc);
    const t0 = Math.max(0, (-B - sq) / (2 * A)), t1 = Math.min(1, (-B + sq) / (2 * A));
    return t0 < t1 ? [t0, t1] : null;
  };
  for (const L of lines) {
    const n = L.length / 3;
    let prev: [number, number, number] | null = null;
    let pv: V3 = [0, 0, 0];
    /** Whether the line being drawn ends at the previous point (so the next piece carries on from it). */
    let open = false;
    for (let i = 0; i < n; i++) {
      const p: V3 = [L[3 * i], L[3 * i + 1], L[3 * i + 2]];
      const q = proj(...p);
      if (prev) {
        let [a, b] = [prev, q];
        if (a[2] < 0 && b[2] < 0) {
          emit();
          open = false;
        } else {
          if (a[2] < 0 || b[2] < 0) {
            // Over the horizon: where the chord meets the plane of the limb, pushed out onto the sphere.
            const t = a[2] / (a[2] - b[2]);
            const h = proj(...norm([pv[0] + (p[0] - pv[0]) * t, pv[1] + (p[1] - pv[1]) * t, pv[2] + (p[2] - pv[2]) * t]));
            h[2] = 0;
            if (a[2] < 0) a = h;
            else b = h;
          }
          const w = inWindow(a[0], a[1], b[0], b[1]);
          if (!w) {
            emit();
            open = false;
          } else {
            if (!(open && w[0] === 0 && a === prev)) {
              emit();
              cur.push(a[0] + (b[0] - a[0]) * w[0], a[1] + (b[1] - a[1]) * w[0]);
            }
            cur.push(a[0] + (b[0] - a[0]) * w[1], a[1] + (b[1] - a[1]) * w[1]);
            open = w[1] === 1 && b === q;
            if (!open) emit();
          }
        }
      }
      (prev = q), (pv = p);
    }
    emit();
  }
  return out;
}

export interface LandPaths {
  coast: string;
  border: string;
  /** Level lines across the land, `gap` apart (empty when not asked for). */
  hatch: string;
}

/**
 * The land for a view: coastlines, borders, and (when `gap` is given) level
 * hatching `gap` apart, each line's runs over land found on the mask,
 * sampled every half unit and pulled in `inset` from the coast at each end.
 */
export function landPaths(countries: Countries | undefined, v: View, opts: { tol?: number; min?: number; gap?: number; inset?: number; smooth?: number } = {}): LandPaths {
  if (!countries) return { coast: "", border: "", hatch: "" };
  const land = landOf(countries);
  const tol = opts.tol ?? 0.25, min = opts.min ?? 1;
  let coast = projectPolylines(land.coast, v, tol, min);
  for (let k = 0; k < (opts.smooth ?? 0); k++) coast = coast.map(chaikin);
  const out: LandPaths = { coast: piecesPath(coast), border: tracePolylines(land.border, v, tol, 2.5), hatch: "" };
  if (opts.gap) out.hatch = hatchLand(land.mask, coast, v, opts.gap, opts.inset ?? 0.9);
  return out;
}

/** Whether a point on the sphere is land: to Equal Earth, then the mask. */
function landAt(mask: Uint16Array, x: number, y: number, z: number): boolean {
  const lat = Math.asin(Math.max(-1, Math.min(1, z))), lon = Math.atan2(y, x);
  const t = Math.asin(M * Math.sin(lat));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const ex = (2 * Math.sqrt(3) * lon * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const ey = t * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1);
  const col = Math.floor(((ex + EE_X) / (2 * EE_X)) * MW), row = Math.floor(((-ey + EE_Y) / (2 * EE_Y)) * MH);
  return col >= 0 && col < MW && row >= 0 && row < MH && mask[row * MW + col] > 0;
}

/** Whether a point of the print is land: back to the sphere, then the mask. */
function onLand(mask: Uint16Array, v: View, east: V3, north: V3, x: number, y: number): boolean {
  const [u, w] = [(x - v.cx) / v.k, -(y - v.cy) / v.k];
  const z2 = 1 - u * u - w * w;
  if (z2 < 0) return false;
  const z = Math.sqrt(z2), c = v.centre;
  return landAt(mask, u * east[0] + w * north[0] + z * c[0], u * east[1] + w * north[1] + z * c[1], u * east[2] + w * north[2] + z * c[2]);
}

const seaCache = new WeakMap<Countries, Map<number, Float64Array[]>>();
/**
 * The graticule every `g` degrees over the sea only (a line stops at the
 * coast, found by bisection), as polylines on the sphere, a point a degree.
 * The meridians stop at the last parallel short of the pole, all but every
 * 90°, so they don't crowd into a star there. Without the countries, the
 * whole graticule.
 */
export function seaGraticule(countries: Countries | undefined, g: number): Float64Array[] {
  const mask = countries ? landOf(countries).mask : null;
  const byG = countries ? (seaCache.get(countries) ?? new Map<number, Float64Array[]>()) : null;
  if (countries && byG) seaCache.set(countries, byG);
  const hit = byG?.get(g);
  if (hit) return hit;
  const out: Float64Array[] = [];
  const curve = (f: (t: number) => [number, number], n: number) => {
    let run: number[] = [];
    let prevT = 0, prevLand = true;
    const flush = () => {
      if (run.length >= 6) out.push(Float64Array.from(run));
      run = [];
    };
    const isLand = (t: number) => !!mask && landAt(mask, ...vec(...f(t)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, land = isLand(t);
      if (i && land !== prevLand) {
        let [a, b] = [prevT, t];
        for (let k = 0; k < 10; k++) {
          const m = (a + b) / 2;
          if (isLand(m) === prevLand) a = m;
          else b = m;
        }
        run.push(...vec(...f(prevLand ? b : a)));
      }
      if (land) flush();
      else run.push(...vec(...f(t)));
      (prevT = t), (prevLand = land);
    }
    flush();
  };
  const last = Math.floor((90 - 1e-9) / g) * g;
  for (let lat = -last; lat <= last; lat += g) curve((t) => [lat, -180 + 360 * t], 360);
  for (let lon = -180; lon < 180; lon += g) {
    const top = lon % 90 === 0 ? 90 : last;
    curve((t) => [-top + 2 * top * t, lon], Math.ceil(2 * top));
  }
  byG?.set(g, out);
  return out;
}

function hatchLand(mask: Uint16Array, coast: number[][], v: View, gap: number, inset: number): string {
  const c = v.centre;
  const east: V3 = Math.hypot(c[0], c[1]) < 1e-9 ? [0, 1, 0] : norm([-c[1], c[0], 0]);
  const north: V3 = [c[1] * east[2] - c[2] * east[1], c[2] * east[0] - c[0] * east[2], c[0] * east[1] - c[1] * east[0]];
  const R = Math.min(v.r, v.k) - 0.6;
  // Every coast segment on the print, for the lines to cross.
  const segs: number[] = [];
  for (const p of coast) for (let i = 2; i < p.length; i += 2) segs.push(p[i - 2], p[i - 1], p[i], p[i + 1]);
  let d = "";
  for (let y = v.cy - R + gap / 2; y < v.cy + R; y += gap) {
    const half = Math.sqrt(Math.max(0, R * R - (y - v.cy) ** 2));
    const xs = [v.cx - half, v.cx + half];
    for (let i = 0; i < segs.length; i += 4) {
      const [ax, ay, bx, by] = [segs[i], segs[i + 1], segs[i + 2], segs[i + 3]];
      if ((ay <= y) !== (by <= y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    // Each stretch between crossings is land or sea by its middle; neighbouring land stretches (a coast drawn twice, a speck) join.
    let start = NaN, stop = NaN;
    const end = () => {
      const [a, b] = [start + inset, stop - inset];
      if (b - a >= 1.2) d += `M${f1(a)} ${f1(y)}H${f1(b)}`;
      start = NaN;
    };
    for (let k = 0; k + 1 < xs.length; k++) {
      const [a, b] = [Math.max(xs[k], v.cx - half), Math.min(xs[k + 1], v.cx + half)];
      if (b <= a) continue;
      const land = onLand(mask, v, east, north, (a + b) / 2, y);
      if (land) {
        if (Number.isNaN(start)) start = a;
        stop = b;
      } else if (!Number.isNaN(start) && b - a > 0.6) end();
    }
    if (!Number.isNaN(start)) end();
  }
  return d;
}
