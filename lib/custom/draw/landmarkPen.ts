/**
 * The pen Your Landmarks' drawings are made with (lib/custom/draw/landmarks
 * and landmarksMore): path data mapped point by point, the shapes the
 * drawings share (lines, arches, rings, mirror images, curves as points),
 * and the small things several drawings put in (trees, birds, ripples).
 */

export type Pt = [number, number];

/** A number for path data (three decimals; never exponent notation). */
export const n3 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 1000) / 1000));
export const n2 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 100) / 100));

export interface PathMap {
  pt: (x: number, y: number) => Pt;
  /** A length (an arc's radius). */
  len?: (r: number) => number;
  /** Degrees added to an arc's axis (a turn). */
  turn?: number;
  /** A mirror image: arcs sweep the other way. */
  flip?: boolean;
  fmt?: (v: number) => string;
}

/** Path data (absolute M L H V Q C A Z) with every point mapped; H and V become L. */
export function mapPath(d: string, m: PathMap): string {
  const toks = d.match(/[MLHVQCAZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const f = m.fmt ?? n3;
  const len = m.len ?? ((r: number) => r);
  let out = "";
  let cmd = "";
  let [cx, cy, sx, sy] = [0, 0, 0, 0];
  let i = 0;
  const num = () => Number(toks[i++]);
  const put = (x: number, y: number) => {
    const [X, Y] = m.pt(x, y);
    return `${f(X)} ${f(Y)}`;
  };
  while (i < toks.length) {
    if (/[A-Z]/.test(toks[i])) {
      cmd = toks[i++];
      if (cmd === "Z") {
        out += "Z";
        [cx, cy] = [sx, sy];
        continue;
      }
    }
    switch (cmd) {
      case "M": {
        const [x, y] = [num(), num()];
        out += `M${put(x, y)}`;
        [cx, cy, sx, sy] = [x, y, x, y];
        cmd = "L";
        break;
      }
      case "L": {
        const [x, y] = [num(), num()];
        out += `L${put(x, y)}`;
        [cx, cy] = [x, y];
        break;
      }
      case "H": {
        const x = num();
        out += `L${put(x, cy)}`;
        cx = x;
        break;
      }
      case "V": {
        const y = num();
        out += `L${put(cx, y)}`;
        cy = y;
        break;
      }
      case "Q": {
        const [x1, y1, x, y] = [num(), num(), num(), num()];
        out += `Q${put(x1, y1)} ${put(x, y)}`;
        [cx, cy] = [x, y];
        break;
      }
      case "C": {
        const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
        out += `C${put(x1, y1)} ${put(x2, y2)} ${put(x, y)}`;
        [cx, cy] = [x, y];
        break;
      }
      case "A": {
        const [rx, ry, rot, large, sweep, x, y] = [num(), num(), num(), num(), num(), num(), num()];
        out += `A${f(len(rx))} ${f(len(ry))} ${n3(rot + (m.turn ?? 0))} ${large} ${m.flip ? 1 - sweep : sweep} ${put(x, y)}`;
        [cx, cy] = [x, y];
        break;
      }
      default:
        throw new Error(`landmarks: path command ${cmd}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Drawing in the local box                                             */
/* ------------------------------------------------------------------ */

/** An open line through the points (x, y, x, y, …). */
export const P = (...xy: number[]) => xy.reduce((s, v, i) => s + (i % 2 ? ` ${n3(v)}` : `${i ? "L" : "M"}${n3(v)}`), "");
/** A closed shape through the points. */
export const Pz = (...xy: number[]) => `${P(...xy)}Z`;
/** A line through points. */
export const line = (pts: Pt[]) => P(...pts.flat());
export const R = (x: number, y: number, w: number, h: number) => Pz(x, y, x + w, y, x + w, y + h, x, y + h);
/** A rectangle with rounded corners (a Cycladic house). */
export const RR = (x: number, y: number, w: number, h: number, r: number) =>
  `M${n3(x)} ${n3(y + h)}V${n3(y + r)}Q${n3(x)} ${n3(y)} ${n3(x + r)} ${n3(y)}H${n3(x + w - r)}Q${n3(x + w)} ${n3(y)} ${n3(x + w)} ${n3(y + r)}V${n3(y + h)}Z`;
export const ring = (cx: number, cy: number, r: number) => `M${n3(cx - r)} ${n3(cy)}A${n3(r)} ${n3(r)} 0 1 0 ${n3(cx + r)} ${n3(cy)}A${n3(r)} ${n3(r)} 0 1 0 ${n3(cx - r)} ${n3(cy)}`;
/** A round-headed arch, open at the foot: its left side x, foot yb, width w, springing ys. */
export const arch = (x: number, yb: number, w: number, ys: number, ry = w / 2) => `M${n3(x)} ${n3(yb)}V${n3(ys)}A${n3(w / 2)} ${n3(ry)} 0 0 1 ${n3(x + w)} ${n3(ys)}V${n3(yb)}`;
/** A pointed arch: springing ys, apex h above it. */
export const garch = (x: number, yb: number, w: number, ys: number, h: number) =>
  `M${n3(x)} ${n3(yb)}V${n3(ys)}Q${n3(x)} ${n3(ys - h * 0.62)} ${n3(x + w / 2)} ${n3(ys - h)}Q${n3(x + w)} ${n3(ys - h * 0.62)} ${n3(x + w)} ${n3(ys)}V${n3(yb)}`;
/** A mirror image about the line x = cx. */
export const mir = (d: string, cx: number) => mapPath(d, { pt: (x, y) => [2 * cx - x, y], flip: true });
/** A shape and its mirror image. */
export const sym = (d: string, cx: number) => d + mir(d, cx);

/** A point on a quadratic Bézier. */
export const qAt = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]];
/** A quadratic Bézier as points. */
export const qPts = (a: Pt, c: Pt, b: Pt, n = 24): Pt[] => Array.from({ length: n + 1 }, (_, i) => qAt(a, c, b, i / n));
/** Where a quadratic Bézier (monotonic in y) crosses height y: its x. */
export function qxAt(a: Pt, c: Pt, b: Pt, y: number): number {
  let [lo, hi] = [0, 1];
  const up = b[1] > a[1];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if ((qAt(a, c, b, m)[1] < y) === up) lo = m;
    else hi = m;
  }
  return qAt(a, c, b, (lo + hi) / 2)[0];
}
/** Where two segments cross (the parameter along the first), or null. */
export function segCross(p: Pt, p2: Pt, q: Pt, q2: Pt): number | null {
  const [rx, ry, sx, sy] = [p2[0] - p[0], p2[1] - p[1], q2[0] - q[0], q2[1] - q[1]];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / den;
  const u = ((q[0] - p[0]) * ry - (q[1] - p[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
/** A line of points up to where it first meets another (hidden behind what's in front). */
export function cutAt(pts: Pt[], other: Pt[]): Pt[] {
  for (let i = 0; i + 1 < pts.length; i++)
    for (let j = 0; j + 1 < other.length; j++) {
      const t = segCross(pts[i], pts[i + 1], other[j], other[j + 1]);
      if (t !== null) return [...pts.slice(0, i + 1), [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]];
    }
  return pts;
}
/** A smooth line through points (Catmull–Rom, as points). */
export function smooth(pts: Pt[], per = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** The height of a line of points at x (linear between them). */
export function yOn(pts: Pt[], x: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if ((x >= a[0] && x <= b[0]) || (x <= a[0] && x >= b[0])) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}
/** A zigzag between two edges (x of y each), from y0 to y1 in n steps: lattice. */
export function lattice(outer: (y: number) => number, inner: (y: number) => number, y0: number, y1: number, n: number): string {
  const a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    a.push([i % 2 ? inner(y) : outer(y), y]);
    b.push([i % 2 ? outer(y) : inner(y), y]);
  }
  return line(a) + line(b);
}

/** What a drawing puts down: outlines, detail, fine detail, dots (x, y, r). */
export interface Pen {
  o: (...d: string[]) => void;
  d: (...d: string[]) => void;
  f: (...d: string[]) => void;
  dot: (x: number, y: number, r: number) => void;
}
export interface Drawing {
  w: number;
  h: number;
  draw: (g: Pen) => void;
}

/* ------------------------------------------------------------------ */
/* Small things several drawings put in                                */
/* ------------------------------------------------------------------ */

/** Path data from a template, its numbers written as path data wants them (n3). */
export const D = (s: TemplateStringsArray, ...v: number[]) => s.reduce((a, t, i) => a + t + (i < v.length ? n3(v[i]) : ""), "");
/** Path data moved by (dx, dy), scaled by s about the origin. */
export const place = (d: string, dx: number, dy = 0, s = 1) => mapPath(d, { pt: (x, y) => [dx + x * s, dy + y * s], len: (r) => r * s });
/** A pen that puts everything down moved by (dx, dy): a drawing authored off its box. */
export const moved = (pen: Pen, dx: number, dy: number): Pen => ({
  o: (...d) => pen.o(...d.map((x) => place(x, dx, dy))),
  d: (...d) => pen.d(...d.map((x) => place(x, dx, dy))),
  f: (...d) => pen.f(...d.map((x) => place(x, dx, dy))),
  dot: (x, y, r) => pen.dot(x + dx, y + dy, r),
});
/** A broad-leaved tree standing at (x, y), its crown about s across. */
export const tree = (x: number, y: number, s: number) =>
  D`M${x} ${y}V${y - s * 0.45}M${x - s * 0.5} ${y - s * 0.45}Q${x - s * 0.75} ${y - s * 1.05} ${x - s * 0.2} ${y - s * 1.1}Q${x} ${y - s * 1.45} ${x + s * 0.25} ${y - s * 1.1}Q${x + s * 0.78} ${y - s * 1.0} ${x + s * 0.5} ${y - s * 0.45}Z`;
/** A fir: a narrow triangle. */
export const fir = (x: number, y: number, s: number) => Pz(x - s * 0.45, y, x, y - s * 1.5, x + s * 0.45, y);
/** A bird in flight, two arcs. */
export const bird = (x: number, y: number, w: number) => D`M${x - w} ${y - w * 0.4}Q${x - w * 0.4} ${y - w * 0.7} ${x} ${y}Q${x + w * 0.4} ${y - w * 0.7} ${x + w} ${y - w * 0.4}`;
/** A ripple on the water, w long. */
export const wave = (x: number, y: number, w = 12) => D`M${x} ${y}Q${x + w / 4} ${y - 1} ${x + w / 2} ${y}Q${x + (3 * w) / 4} ${y + 1} ${x + w} ${y}`;
/** A small cloud sitting on the line y, w long. */
export const cloud = (x: number, y: number, w: number) =>
  D`M${x} ${y}H${x + w}Q${x + w + 0.6} ${y - 3} ${x + w * 0.72} ${y - 3}Q${x + w * 0.6} ${y - 6.4} ${x + w * 0.38} ${y - 4.2}Q${x + w * 0.2} ${y - 5.6} ${x + w * 0.16} ${y - 2.6}Q${x - 1} ${y - 2.4} ${x} ${y}`;
/** A tuft of grass rooted at (x, y). */
export const tuft = (x: number, y: number, s = 1) =>
  D`M${x - 1.3 * s} ${y}Q${x - 1.5 * s} ${y - 1.2 * s} ${x - 2.3 * s} ${y - 2 * s}M${x - 0.5 * s} ${y}Q${x - 0.5 * s} ${y - 1.8 * s} ${x - 1 * s} ${y - 3 * s}M${x + 0.4 * s} ${y}Q${x + 0.5 * s} ${y - 1.6 * s} ${x + 1 * s} ${y - 2.6 * s}M${x + 1.2 * s} ${y}Q${x + 1.5 * s} ${y - 1 * s} ${x + 2.4 * s} ${y - 1.6 * s}`;
/** Where a line of points (monotonic in y) crosses height y: its x. */
export function xOn(pts: Pt[], y: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if ((y >= a[1] && y <= b[1]) || (y <= a[1] && y >= b[1])) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
  }
  return pts[0][0];
}
/** A horizontal line from x0 to x1 at y, left open across the gaps ([from, to] each). */
export function gapped(y: number, x0: number, x1: number, gaps: [number, number][]): string {
  let s = "", x = x0;
  for (const [a, b] of [...gaps].sort((m, n) => m[0] - n[0])) {
    if (a > x) s += P(x, y, Math.min(a, x1), y);
    x = Math.max(x, b);
  }
  if (x < x1) s += P(x, y, x1, y);
  return s;
}
