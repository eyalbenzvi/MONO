/**
 * Your Landmarks' drawings: 24 landmarks as pen-and-ink line illustrations,
 * drawn in code. Each is authored in its own box (its larger side 100 units,
 * the ground along its bottom) as path data with absolute commands only, and
 * fitted into place by arithmetic: every point scaled and moved (no
 * transform), bottom-aligned and centred in the box it's given.
 *
 * Three weights: the outline, the detail (a little over half the outline)
 * and the fine detail, which is left out when the drawing is small enough
 * that it would only fill in (its lines sit closer together).
 */
import { INK } from "../kit";
import type { Landmark } from "../specs/landmarks";

type Pt = [number, number];

/** A number for path data (three decimals; never exponent notation). */
const n3 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 1000) / 1000));
const n2 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 100) / 100));

interface PathMap {
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
const P = (...xy: number[]) => xy.reduce((s, v, i) => s + (i % 2 ? ` ${n3(v)}` : `${i ? "L" : "M"}${n3(v)}`), "");
/** A closed shape through the points. */
const Pz = (...xy: number[]) => `${P(...xy)}Z`;
/** A line through points. */
const line = (pts: Pt[]) => P(...pts.flat());
const R = (x: number, y: number, w: number, h: number) => Pz(x, y, x + w, y, x + w, y + h, x, y + h);
/** A rectangle with rounded corners (a Cycladic house). */
const RR = (x: number, y: number, w: number, h: number, r: number) =>
  `M${n3(x)} ${n3(y + h)}V${n3(y + r)}Q${n3(x)} ${n3(y)} ${n3(x + r)} ${n3(y)}H${n3(x + w - r)}Q${n3(x + w)} ${n3(y)} ${n3(x + w)} ${n3(y + r)}V${n3(y + h)}Z`;
const ring = (cx: number, cy: number, r: number) => `M${n3(cx - r)} ${n3(cy)}A${n3(r)} ${n3(r)} 0 1 0 ${n3(cx + r)} ${n3(cy)}A${n3(r)} ${n3(r)} 0 1 0 ${n3(cx - r)} ${n3(cy)}`;
/** A round-headed arch, open at the foot: its left side x, foot yb, width w, springing ys. */
const arch = (x: number, yb: number, w: number, ys: number, ry = w / 2) => `M${n3(x)} ${n3(yb)}V${n3(ys)}A${n3(w / 2)} ${n3(ry)} 0 0 1 ${n3(x + w)} ${n3(ys)}V${n3(yb)}`;
/** A pointed arch: springing ys, apex h above it. */
const garch = (x: number, yb: number, w: number, ys: number, h: number) =>
  `M${n3(x)} ${n3(yb)}V${n3(ys)}Q${n3(x)} ${n3(ys - h * 0.62)} ${n3(x + w / 2)} ${n3(ys - h)}Q${n3(x + w)} ${n3(ys - h * 0.62)} ${n3(x + w)} ${n3(ys)}V${n3(yb)}`;
/** A mirror image about the line x = cx. */
const mir = (d: string, cx: number) => mapPath(d, { pt: (x, y) => [2 * cx - x, y], flip: true });
/** A shape and its mirror image. */
const sym = (d: string, cx: number) => d + mir(d, cx);

/** A point on a quadratic Bézier. */
const qAt = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]];
/** A quadratic Bézier as points. */
const qPts = (a: Pt, c: Pt, b: Pt, n = 24): Pt[] => Array.from({ length: n + 1 }, (_, i) => qAt(a, c, b, i / n));
/** Where a quadratic Bézier (monotonic in y) crosses height y: its x. */
function qxAt(a: Pt, c: Pt, b: Pt, y: number): number {
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
function segCross(p: Pt, p2: Pt, q: Pt, q2: Pt): number | null {
  const [rx, ry, sx, sy] = [p2[0] - p[0], p2[1] - p[1], q2[0] - q[0], q2[1] - q[1]];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / den;
  const u = ((q[0] - p[0]) * ry - (q[1] - p[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
/** A line of points up to where it first meets another (hidden behind what's in front). */
function cutAt(pts: Pt[], other: Pt[]): Pt[] {
  for (let i = 0; i + 1 < pts.length; i++)
    for (let j = 0; j + 1 < other.length; j++) {
      const t = segCross(pts[i], pts[i + 1], other[j], other[j + 1]);
      if (t !== null) return [...pts.slice(0, i + 1), [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]];
    }
  return pts;
}
/** A smooth line through points (Catmull–Rom, as points). */
function smooth(pts: Pt[], per = 8): Pt[] {
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
function yOn(pts: Pt[], x: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if ((x >= a[0] && x <= b[0]) || (x <= a[0] && x >= b[0])) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}
/** A zigzag between two edges (x of y each), from y0 to y1 in n steps: lattice. */
function lattice(outer: (y: number) => number, inner: (y: number) => number, y0: number, y1: number, n: number): string {
  const a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    a.push([i % 2 ? inner(y) : outer(y), y]);
    b.push([i % 2 ? outer(y) : inner(y), y]);
  }
  return line(a) + line(b);
}

/** What a drawing puts down: outlines, detail, fine detail, dots (x, y, r). */
interface Pen {
  o: (...d: string[]) => void;
  d: (...d: string[]) => void;
  f: (...d: string[]) => void;
  dot: (x: number, y: number, r: number) => void;
}
interface Drawing {
  w: number;
  h: number;
  draw: (g: Pen) => void;
}

/* ------------------------------------------------------------------ */
/* The drawings                                                         */
/* ------------------------------------------------------------------ */

const eiffel: Drawing = {
  w: 64,
  h: 100,
  draw(g) {
    const cx = 32;
    // The legs to the first platform: the outer edge a flaring curve, the inner straight.
    const lo: [Pt, Pt, Pt] = [[7, 100], [15.5, 87], [18.2, 68]];
    const loIn = (y: number) => 19.5 + ((100 - y) / 32) * 6.8;
    const mid: [Pt, Pt, Pt] = [[19.6, 64], [22.6, 52], [24.2, 45]];
    const midIn = (y: number) => 27 + ((64 - y) / 19) * 2.4;
    const up: [Pt, Pt, Pt] = [[25.2, 41], [29, 23], [30.1, 12]];
    const half =
      P(...lo[0], ...lo[2]).replace(/L.*/, "") +
      `Q${lo[1].join(" ")} ${lo[2].join(" ")}` +
      P(19.5, 100, 26.3, 68) +
      `M${mid[0].join(" ")}Q${mid[1].join(" ")} ${mid[2].join(" ")}` +
      P(27, 64, 29.4, 45) +
      `M${up[0].join(" ")}Q${up[1].join(" ")} ${up[2].join(" ")}`;
    g.o(sym(half, cx));
    // The platforms, the top and the mast.
    g.o(R(14.6, 64, 34.8, 4), R(22, 41, 20, 4), R(28.6, 10, 6.8, 2), P(30.6, 10, 30.6, 6.5, 33.4, 6.5, 33.4, 10), P(cx, 6.5, cx, 0.5));
    // The great arch between the legs.
    g.o("M20.1 99C22.4 82 26.6 77.6 32 77.6C37.4 77.6 41.6 82 43.9 99");
    // Lattice: each leg, the middle legs, the shaft.
    const xo = (c: [Pt, Pt, Pt]) => (y: number) => qxAt(...c, y);
    const leg = lattice(xo(lo), loIn, 99, 68.5, 5) + lattice(xo(mid), midIn, 63.6, 45.4, 3);
    g.d(sym(leg, cx));
    g.d(lattice(xo(up), (y) => 2 * cx - qxAt(...up, y), 40.6, 12.4, 7));
    // Arcading along the platforms.
    let t = "";
    for (let x = 16.8; x < 48; x += 2.9) t += P(x, 64.6, x, 67.4);
    for (let x = 24; x < 41; x += 2.8) t += P(x, 41.6, x, 44.4);
    g.f(t);
  },
};

/** The Colosseum's facade: a curved wall seen from the front, its courses bowing, its arches narrowing round the curve. */
const colosseum: Drawing = {
  w: 100,
  h: 64,
  draw(g) {
    const cx = 50, Rr = 46, dip = 3.5;
    const L = [60.5, 47, 33.5, 20.5, 9.5];
    const X = (th: number) => cx + Rr * Math.sin(th);
    const Y = (lvl: number, th: number) => L[lvl] + dip * Math.cos(th);
    const course = (lvl: number, a: number, b: number) => line(Array.from({ length: 25 }, (_, i) => a + ((b - a) * i) / 24).map((th): Pt => [X(th), Y(lvl, th)]));
    const T = 1.25, broke = 0.42, mid3 = 0.62;
    // Outline: base, the full-height left, the broken edge stepping down, the lower right.
    g.o(course(0, -T, T), course(4, -T, broke), P(X(-T), Y(0, -T), X(-T), Y(4, -T)), P(X(T), Y(0, T), X(T), Y(2, T)));
    const jag: Pt[] = [[X(broke), Y(4, broke)], [X(broke) + 0.6, Y(4, broke) + 3], [X(0.5), Y(3, 0.5) - 3.5], [X(0.5), Y(3, 0.5)], [X(mid3), Y(3, mid3)], [X(mid3) + 0.8, Y(3, mid3) + 4], [X(0.7), Y(2, 0.7) - 2.5], [X(0.74), Y(2, 0.74)]];
    g.o(line(jag), course(2, 0.74, T));
    g.d(course(1, -T, T), course(2, -T, 0.74), course(3, -T, 0.5), course(3, 0.5, mid3));
    // Arches: fourteen bays across the curve.
    const N = 14, dth = (2 * T) / N;
    let a = "", fine = "";
    for (let j = 0; j < N; j++) {
      const th = -T + dth * (j + 0.5);
      const hw = 0.3 * dth * Rr * Math.cos(th), ry = 0.3 * dth * Rr;
      const x = X(th);
      for (let lvl = 0; lvl < 3; lvl++) {
        if (lvl === 2 && th > mid3 - dth * 0.4) continue;
        const yb = Y(lvl, th) - 0.3, top = Y(lvl + 1, th) + 2.2;
        a += arch(x - hw, yb, 2 * hw, top + ry, ry);
      }
      // The attic's small windows, every other bay.
      if (j % 2 === 0 && th < broke - dth * 0.3 && Math.cos(th) > 0.5) fine += R(x - hw * 0.45, Y(4, th) + 4, hw * 0.9, 2.6);
      // Pilasters between the bays.
      const tb = -T + dth * j;
      if (j > 0) for (let lvl = 0; lvl < 3; lvl++) if (!(lvl === 2 && tb > mid3)) fine += P(X(tb), Y(lvl, tb) - 0.4, X(tb), Y(lvl + 1, tb) + 0.8);
    }
    g.d(a);
    g.f(fine);
    g.o(P(0, 64, 100, 64));
  },
};

const bigben: Drawing = {
  w: 60,
  h: 100,
  draw(g) {
    // The tower.
    g.o(P(12, 97, 12, 44, 10, 44, 10, 26, 30, 26, 30, 44, 28, 44, 28, 97), R(9, 97, 22, 3));
    g.o(P(12, 26, 12, 17, 28, 17, 28, 26), P(11, 17, 16.6, 7, 23.4, 7, 29, 17), R(16.6, 4.4, 6.8, 2.6), P(20, 4.4, 20, 0.5));
    // Pinnacles at the clock stage's corners.
    g.d(P(10, 26, 10, 21.5), P(30, 26, 30, 21.5), P(9, 26, 11, 26));
    // The clock.
    g.o(ring(20, 35, 7.2));
    g.d(ring(20, 35, 5.6), P(20, 35, 20, 31), P(20, 35, 22.8, 36.4));
    let ticks = "";
    for (let i = 0; i < 12; i += 3) {
      const a = (i / 12) * 2 * Math.PI;
      ticks += P(20 + 4.3 * Math.sin(a), 35 - 4.3 * Math.cos(a), 20 + 5.2 * Math.sin(a), 35 - 5.2 * Math.cos(a));
    }
    g.f(ticks);
    // The belfry's openings, the shaft's bands and windows.
    g.d(garch(14, 25, 3, 20.5, 2), garch(18.5, 25, 3, 20.5, 2), garch(23, 25, 3, 20.5, 2), P(12, 58, 28, 58), P(12, 72, 28, 72), P(12, 86, 28, 86), P(20, 17, 20, 9));
    g.f(P(15.5, 47, 15.5, 55), P(20, 47, 20, 55), P(24.5, 47, 24.5, 55), P(15.5, 61, 15.5, 69), P(20, 61, 20, 69), P(24.5, 61, 24.5, 69), P(15.5, 75, 15.5, 83), P(20, 75, 20, 83), P(24.5, 75, 24.5, 83));
    // The palace beside it: a gothic wing, its pinnacles and windows.
    g.o(P(28, 74, 58, 74, 58, 100), P(0, 100, 60, 100));
    let pins = "", win = "";
    for (let x = 32; x <= 56; x += 6) {
      pins += P(x, 74, x, 69.5);
      win += garch(x - 1.4, 84, 2.8, 79, 2) + garch(x - 1.4, 96, 2.8, 91, 2);
    }
    g.d(pins, P(28, 77, 58, 77));
    g.f(win);
  },
};

const tajmahal: Drawing = {
  w: 100,
  h: 76,
  draw(g) {
    const cx = 50;
    g.o(P(0, 76, 100, 76), P(3, 76, 3, 70, 97, 70, 97, 76));
    // The minaret, its balconies and its kiosk (and its twin).
    const minaret =
      P(5.3, 70, 5.8, 26) + P(9.7, 70, 9.2, 26) + P(4.6, 26, 10.4, 26) + P(5.4, 26, 5.4, 22.2) + P(9.6, 26, 9.6, 22.2) + P(4.8, 22.2, 10.2, 22.2) + "M5 22.2C4.6 19 6.4 17.6 7.5 16.6C8.6 17.6 10.4 19 10 22.2";
    g.o(sym(minaret, cx));
    g.d(sym(P(4.3, 57, 10.7, 57) + P(4.5, 44, 10.5, 44) + P(4.7, 31.5, 10.3, 31.5) + P(7.5, 16.6, 7.5, 14), cx));
    // The building, the great iwan rising above it.
    g.o(P(22, 70, 22, 41, 40, 41, 40, 38, 60, 38, 60, 41, 78, 41, 78, 70));
    g.o("M43.5 70V53Q43.5 46.5 50 43Q56.5 46.5 56.5 53V70");
    g.d(sym(P(27, 41, 27, 70) + garch(29.8, 69.5, 7.4, 62.5, 4.2) + garch(29.8, 55.5, 7.4, 49.5, 3.6), cx));
    g.f(P(41.8, 70, 41.8, 40.2, 58.2, 40.2, 58.2, 70), sym(garch(23.3, 69.5, 2.4, 63.5, 1.8) + garch(23.3, 56, 2.4, 50, 1.8), cx));
    // Drum, dome and finial; the kiosks on the roof.
    g.o(P(38.5, 38, 38.5, 33, 61.5, 33, 61.5, 38), "M38.5 33C33.5 27 34 16.5 44 12.8Q48.5 11.2 50 7.6Q51.5 11.2 56 12.8C66 16.5 66.5 27 61.5 33");
    g.d(P(cx, 7.6, cx, 2.2), sym(P(28, 41, 28, 36.8) + P(32, 41, 32, 36.8) + P(27.4, 36.8, 32.6, 36.8) + "M27.6 36.8C27.4 34 29.4 33 30 32C30.6 33 32.6 34 32.4 36.8" + P(30, 32, 30, 30.4), cx));
    g.dot(cx, 3.6, 0.9);
    // Niches along the plinth.
    let n = "";
    for (let x = 7; x < 94; x += 5.4) if (x < 20 || x > 76) n += arch(x, 75, 2.6, 72.6);
    g.f(n);
  },
};

const giza: Drawing = {
  w: 100,
  h: 60,
  draw(g) {
    // Three pyramids, each its two edges and the ridge between its faces, the shaded face coursed; the one behind hidden by those in front.
    type Pyr = { apex: Pt; l: number; r: number; ridge: number };
    const base = 60;
    const p1: Pyr = { apex: [31, 7], l: 2, r: 60, ridge: 38 };
    const p2: Pyr = { apex: [69, 17], l: 42, r: 96, ridge: 75 };
    const p3: Pyr = { apex: [89, 38], l: 78, r: 100, ridge: 91 };
    const edges = (p: Pyr): Pt[][] => [[p.apex, [p.l, base]], [p.apex, [p.r, base]]];
    const hide = (pts: Pt[], ...by: Pyr[]) => by.flatMap(edges).reduce((q, e) => cutAt(q, e), pts);
    g.o(line([[p1.l, base], p1.apex, [p1.r, base]]), line([[p3.l, base], p3.apex, [p3.r, base]]));
    g.o(line(hide([p2.apex, [p2.l, base]], p1)), line(hide([p2.apex, [p2.r, base]], p3)));
    g.d(line([p1.apex, [p1.ridge, base]]), line([p2.apex, [p2.ridge, base]]), line([p3.apex, [p3.ridge, base]]));
    // Courses across each shaded face (from the ridge to the right edge), stopped where a nearer pyramid stands.
    const edgeX = (p: Pyr, side: number, y: number) => p.apex[0] + (side - p.apex[0]) * ((y - p.apex[1]) / (base - p.apex[1]));
    let c = "";
    for (const p of [p1, p2, p3])
      for (let y = p.apex[1] + 3.4; y < base - 0.8; y += 3.4) {
        const x0 = edgeX(p, p.ridge, y) + 0.3;
        let x1 = edgeX(p, p.r, y) - 0.3;
        if (p === p2 && y > p3.apex[1]) x1 = Math.min(x1, edgeX(p3, p3.l, y) - 0.3);
        if (x1 - x0 > 0.8) c += P(x0, y, x1, y);
      }
    g.d(c);
    // The desert, the sun and a few birds.
    g.o(P(0, 60, 100, 60));
    g.d(ring(12, 16, 4.5));
    const bird = (x: number, y: number, w: number) => `M${x - w} ${y - w * 0.4}Q${x - w * 0.4} ${y - w * 0.7} ${x} ${y}Q${x + w * 0.4} ${y - w * 0.7} ${x + w} ${y - w * 0.4}`;
    g.d(bird(52, 8, 2.2), bird(58, 5, 1.8), bird(84, 10, 2));
  },
};

const machupicchu: Drawing = {
  w: 100,
  h: 72,
  draw(g) {
    // Huayna Picchu: the steep sugar-loaf behind the city, its small neighbour, the far ridges.
    g.o("M38 42C45 34 50 20 53.4 10C54.6 6 56 2.6 57.6 2.6C59.4 2.6 60.4 5.6 61.6 9.4C63.6 16 66 24 70 31Q77 40 100 44.6");
    g.d("M24 43Q30 35 35 37.6Q36.8 38.8 38 42", "M0 30Q9 20 18 26Q24 22 30 27", "M65.8 24Q80 16 100 21");
    g.f("M53.4 10Q57.6 8.2 61.8 10", "M51 17Q57 15 63.8 17.2", "M48.4 25Q56 22.8 66.6 26");
    // The saddle the city stands on.
    const top = 51;
    g.o(`M0 60Q6 54 12 ${top}H80Q88 50.4 100 52`);
    // The city: roofless stone walls, broken along their tops, a few gable ends still standing, niches in them.
    let walls = "", fine = "";
    const ruin = (x: number, w: number, h: number, gable: boolean) => {
      const t = top - h;
      walls += P(x, top, x, t, x + w * 0.35, t, x + w * 0.35, t + 0.8, x + w * 0.7, t + 0.8, x + w * 0.7, t + 0.3, x + w, t + 0.3, x + w, top);
      if (gable) walls += P(x + w, t + 0.3, x + w, t - 1.4, x + w + 1.4, t - 3.4, x + w + 2.8, t - 1.4, x + w + 2.8, top);
      for (let k = 0; k < Math.floor(w / 2.8); k++) {
        const wx = x + 0.9 + k * 2.8;
        fine += Pz(wx, t + 1.4, wx + 1, t + 1.4, wx + 1.2, top - 0.6, wx - 0.2, top - 0.6);
      }
    };
    ruin(12, 8, 4, false);
    ruin(21, 6, 5, true);
    ruin(31.2, 7.6, 3.6, false);
    ruin(53, 7, 4.6, true);
    ruin(64, 8.4, 3.8, false);
    ruin(73.6, 5, 3, false);
    g.d(walls);
    g.f(fine);
    // Terraces stepping down the slope in front, and a few on the right.
    let stairs = `M52 ${top}`, terr = "";
    for (let i = 0; i < 6; i++) {
      const y = 53.6 + i * 3, x1 = 52 - i * 4.2, x0 = Math.max(0.5, 9 - i * 3.2);
      stairs += `V${n3(y)}H${n3(x1 - 4.2)}`;
      terr += P(x0, y, x1 - 4.2, y);
    }
    g.d(stairs, terr, `M82 ${top + 0.2}V54H87V57H92V60H97`, P(87, 54, 100, 54), P(92, 57, 100, 57));
    g.d("M40 72Q52 67 66 65Q84 63 100 66");
    g.o(P(0, 72, 100, 72));
  },
};

const greatwall: Drawing = {
  w: 100,
  h: 66,
  draw(g) {
    // The ridge the wall follows, near (left) to far (right).
    const ridge = smooth([[0, 60], [12, 55], [22, 44], [30, 38], [38, 41], [48, 48], [57, 45], [66, 32], [75, 25], [86, 27], [100, 31]], 10);
    const hAt = (x: number) => 6.5 - (x / 100) * 4;
    const towers = [
      { x: 30, w: 10, h: 12 },
      { x: 75, w: 6.4, h: 7.5 },
    ];
    // Wall faces between the towers: base and crenellated top.
    const spans: [number, number][] = [[0, 25], [35, 71.8], [78.2, 100]];
    for (const [a, b] of spans) {
      const base = ridge.filter(([x]) => x >= a && x <= b);
      g.o(line(base));
      // The top, merlons every few units (narrower as it goes).
      const cren: Pt[] = [];
      let x = a, up = false;
      while (x < b) {
        const step = Math.max(1.5, 3.2 - (x / 100) * 1.7);
        const nx = Math.min(b, x + step);
        const y0 = yOn(ridge, x) - hAt(x), y1 = yOn(ridge, nx) - hAt(nx);
        const m = up ? 1.6 - x / 150 : 0;
        cren.push([x, y0 - m], [nx, y1 - m]);
        up = !up;
        x = nx;
      }
      g.d(line(cren));
      // The walkway's inner parapet (fine), a little under the top.
      g.f(line(base.map(([x, y]): Pt => [x, y - hAt(x) * 0.55])));
    }
    // Towers: a box, crenellated, with an arched door.
    for (const t of towers) {
      const yb = Math.max(yOn(ridge, t.x - t.w / 2), yOn(ridge, t.x + t.w / 2)) + 0.5;
      const top = yb - t.h;
      g.o(Pz(t.x - t.w / 2, yb, t.x - t.w / 2, top, t.x + t.w / 2, top, t.x + t.w / 2, yb));
      const m = t.w / 5;
      let c = "";
      for (let i = 0; i < 5; i += 2) c += P(t.x - t.w / 2 + i * m, top, t.x - t.w / 2 + i * m, top - m * 0.7, t.x - t.w / 2 + (i + 1) * m, top - m * 0.7, t.x - t.w / 2 + (i + 1) * m, top);
      g.d(c, arch(t.x - t.w * 0.14, yb - 0.4, t.w * 0.28, yb - t.h * 0.3), P(t.x - t.w / 2, top + t.h * 0.2, t.x + t.w / 2, top + t.h * 0.2));
      g.f(arch(t.x - t.w * 0.32, top + t.h * 0.48, t.w * 0.14, top + t.h * 0.38), arch(t.x + t.w * 0.18, top + t.h * 0.48, t.w * 0.14, top + t.h * 0.38));
    }
    // Hills behind and the slope below.
    g.d("M0 36Q10 26 22 29", "M38 28Q48 18 60 22Q64 23 68 17Q76 8 88 12Q94 14 100 12");
    g.d("M8 66Q18 58 30 56Q44 54 52 60Q58 64 62 66", "M56 52Q66 44 78 40Q90 38 100 42");
    // Trees scattered down the slopes.
    let trees = "";
    for (const [x, y, s] of [[6, 64, 3], [36, 62, 3], [44, 63, 2.6], [70, 60, 3], [80, 57, 2.6], [90, 52, 2.4], [92, 44, 2]] as const) trees += `M${x} ${y}V${y - s * 0.5}M${x - s * 0.6} ${y - s * 0.5}Q${x - s * 0.7} ${y - s * 1.6} ${x} ${y - s * 1.7}Q${x + s * 0.7} ${y - s * 1.6} ${x + s * 0.6} ${y - s * 0.5}Z`;
    g.d(trees);
    g.o(P(0, 66, 100, 66));
  },
};

const sydneyopera: Drawing = {
  w: 100,
  h: 56,
  draw(g) {
    const top = 42;
    type Shell = { l: number; r: number; tip: Pt; back?: boolean };
    // Two groups of shells, each rising toward the back, and a small shell facing the other way.
    const groups: Shell[][] = [
      [{ l: 7, r: 24, tip: [9, 25] }, { l: 11, r: 36, tip: [16, 13] }, { l: 17, r: 48, tip: [26, 7] }, { l: 40, r: 55, tip: [55, 22], back: true }],
      [{ l: 56, r: 68, tip: [58, 30] }, { l: 58, r: 77, tip: [63.5, 21] }, { l: 63, r: 86, tip: [71, 16] }, { l: 80, r: 93, tip: [93, 29], back: true }],
    ];
    let ribs = "";
    for (const shells of groups) {
      let prevBack: Pt[] | null = null;
      for (const s of shells) {
        const [tx, ty] = s.tip;
        const h = top - ty;
        // The leading edge drops steeply from the tip then flares to the base; the back rolls over and down.
        let lead = qPts(s.tip, [s.back ? s.r + (tx - s.r) * 0.1 : s.l + (tx - s.l) * 0.1, ty + h * 0.5], [s.back ? s.r : s.l, top]);
        let back = qPts(s.tip, [s.back ? tx - (tx - s.l) * 0.78 : tx + (s.r - tx) * 0.78, ty + h * 0.04], [s.back ? s.l : s.r, top]);
        if (prevBack) {
          if (s.back) back = cutAt(back, prevBack);
          else lead = cutAt(lead, prevBack);
        }
        g.o(line(lead), line(back));
        // Ribs: curves from the tip into the shell.
        for (const k of [0.33, 0.62]) {
          const bx = s.back ? s.r + (s.l - s.r) * k : s.l + (s.r - s.l) * k;
          let rib = qPts(s.tip, [tx + (bx - tx) * 0.35 + (s.back ? 1 : -1) * h * 0.08, ty + h * 0.45], [bx, top], 16);
          if (prevBack) rib = cutAt(rib, prevBack);
          ribs += line(rib);
        }
        prevBack = s.back ? lead : back;
      }
    }
    g.f(ribs);
    // The podium, its steps, and the harbour.
    g.o(P(2, 48, 2, 42, 98, 42, 98, 48), P(0, 48, 100, 48));
    g.d(P(4, 45, 96, 45));
    g.d("M4 52Q7 51 10 52Q13 53 16 52M28 53Q31 52 34 53Q37 54 40 53M60 52Q63 51 66 52Q69 53 72 52M82 53.5Q85 52.5 88 53.5Q91 54.5 94 53.5");
    g.f("M14 55.5H24M46 55.5H56M74 55.5H84");
  },
};

const goldengate: Drawing = {
  w: 100,
  h: 58,
  draw(g) {
    const deck = 38;
    // Each tower: two tapering legs, the portal's struts, a pier.
    const tower = (cx: number) => {
      const legs = P(cx - 4.4, 50, cx - 3.2, 3.5, cx - 1.4, 3.5, cx - 1.4, 50) + P(cx + 4.4, 50, cx + 3.2, 3.5, cx + 1.4, 3.5, cx + 1.4, 50);
      let struts = "";
      for (const y of [6.5, 14, 22, 30]) struts += R(cx - 1.4, y, 2.8, 1.8);
      g.o(legs, R(cx - 6, 50, 12, 3.5));
      g.d(struts);
      g.f(P(cx - 1.4, deck + 3, cx + 1.4, 49), P(cx + 1.4, deck + 3, cx - 1.4, 49));
    };
    tower(26);
    tower(74);
    // The deck.
    g.o(P(0, deck, 21.6, deck), P(30.4, deck, 69.6, deck), P(78.4, deck, 100, deck));
    g.d(P(0, deck + 2.6, 21.6, deck + 2.6), P(30.4, deck + 2.6, 69.6, deck + 2.6), P(78.4, deck + 2.6, 100, deck + 2.6));
    // The main cable and the side spans, the suspenders under them.
    const main: [Pt, Pt, Pt] = [[26, 5], [50, 67], [74, 5]];
    const sideL: [Pt, Pt, Pt] = [[26, 5], [12, 30], [0, 33]];
    const sideR: [Pt, Pt, Pt] = [[74, 5], [88, 30], [100, 33]];
    g.o(line(qPts(...main)), line(qPts(...sideL)), line(qPts(...sideR)));
    let s = "";
    for (let x = 30; x <= 70; x += 2.5) {
      const t = (x - 26) / 48;
      s += P(x, qAt(...main, t)[1], x, deck);
    }
    for (let x = 3; x <= 21; x += 2.5) {
      const y = yOn(qPts(...sideL, 40), x);
      if (deck - y > 1) s += P(x, y, x, deck);
      const y2 = yOn(qPts(...sideR, 40), 100 - x);
      if (deck - y2 > 1) s += P(100 - x, y2, 100 - x, deck);
    }
    g.f(s);
    // The water, and the headland.
    g.o(P(0, 53.5, 100, 53.5));
    g.d("M8 57Q11 56 14 57Q17 58 20 57M40 57Q43 56 46 57Q49 58 52 57M80 57Q83 56 86 57Q89 58 92 57");
  },
};

const liberty: Drawing = {
  w: 44,
  h: 100,
  draw(g) {
    // Pedestal: the base, the shaft and its cornices.
    g.o(P(3, 95, 3, 90, 41, 90, 41, 95), P(0, 100, 0, 95, 44, 95, 44, 100), P(8, 90, 8, 70, 36, 70, 36, 90), P(6.5, 70, 37.5, 70, 37.5, 67, 6.5, 67, 6.5, 70), P(0, 100, 44, 100));
    g.d(P(8, 86, 36, 86), P(8, 74, 36, 74), R(15, 64, 14, 3));
    g.f(arch(11, 83, 3.4, 78.5) + arch(16.2, 83, 3.4, 78.5) + arch(24.4, 83, 3.4, 78.5) + arch(29.6, 83, 3.4, 78.5), P(3, 92.5, 41, 92.5), P(8, 97.5, 36, 97.5));
    g.d(P(12, 90, 12, 86), P(32, 90, 32, 86), P(12, 74, 12, 70), P(32, 74, 32, 70));
    // The figure: the robe falling to the feet, the arm raised with the torch, the tablet held at the side.
    g.o("M16.2 64C15.4 56 15.6 47 17 38.2L9.4 13.2", "M12.4 12.4L19.4 34.2Q22.6 32.4 26.4 34C28.2 41 28.6 53 29 64");
    g.o("M8.2 13.4H13.6L12.8 10.6H9Z", "M9.3 10.6Q7.6 6.6 10.8 2.2Q13.8 6.6 12.4 10.6");
    // Head and crown.
    g.o(ring(23, 29.2, 2.9));
    let rays = "";
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.16 + (0.68 * i) / 6);
      rays += P(23 + 3.6 * Math.cos(a), 28.6 + 3.6 * Math.sin(a), 23 + 7.4 * Math.cos(a), 28.6 + 7.4 * Math.sin(a));
    }
    g.d(rays, P(19.8, 27.4, 26.2, 27.4));
    g.o(Pz(26.6, 39.6, 31.6, 37.8, 32.8, 50.6, 27.8, 52.2));
    // The drape across the body, the folds below.
    g.d("M26 35.6Q22 40 17.2 42.6", "M27.4 45Q23 50 16.2 52");
    g.f("M19.6 53.6Q20.6 58 20.2 63.4M23.4 52Q24.4 58 24 63.4M20 44.6Q21 47 20.6 50.4");
  },
};

const westernwall: Drawing = {
  w: 100,
  h: 62,
  draw(g) {
    const [x0, x1, yb] = [3, 97, 60];
    const rows = [6.2, 6, 5.6, 5.2, 4.8, 4.2, 3.8, 3.4, 3.2];
    // Stone lengths: a fixed, uneven sequence.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let y = yb, joints = "", margins = "", tufts = "";
    rows.forEach((h, r) => {
      const top = y - h;
      let x = x0 + rnd() * 6;
      const [lo, hi] = h > 5 ? [10, 17] : h > 4 ? [7, 12] : [5, 9];
      let prev = x0;
      while (x < x1 - 2) {
        joints += P(x, y, x, top);
        if (h >= 5 && x - prev > 4) margins += R(prev + 1.1, top + 1.1, x - prev - 2.2, h - 2.2);
        prev = x;
        x += lo + rnd() * (hi - lo);
      }
      if (h >= 5 && x1 - prev > 4) margins += R(prev + 1.1, top + 1.1, x1 - prev - 2.2, h - 2.2);
      if (r < rows.length - 1) joints += P(x0, top, x1, top);
      // Hyssop in a few joints up high.
      if (r >= 5 && r % 2 === 1) {
        const tx = x0 + 12 + rnd() * 70;
        // A sprig growing out of the joint and drooping.
        tufts += `M${n3(tx)} ${n3(top)}Q${n3(tx - 2.4)} ${n3(top - 1.4)} ${n3(tx - 3.6)} ${n3(top + 1.2)}M${n3(tx)} ${n3(top)}Q${n3(tx + 2.4)} ${n3(top - 1.6)} ${n3(tx + 3.8)} ${n3(top + 0.8)}M${n3(tx)} ${n3(top)}Q${n3(tx + 0.6)} ${n3(top - 2.4)} ${n3(tx + 2)} ${n3(top - 2.6)}`;
      }
      y = top;
    });
    const wallTop = y;
    g.o(Pz(x0, yb, x0, wallTop, x1, wallTop, x1, yb));
    g.d(joints, tufts);
    g.f(margins);
    // The Dome of the Rock beyond: drum and dome, over the wall's top.
    const [dc, dy] = [74, wallTop];
    g.o(P(dc - 11, dy, dc - 11, dy - 7, dc + 11, dy - 7, dc + 11, dy), `M${dc - 10} ${dy - 7}C${dc - 10} ${dy - 17} ${dc - 3} ${dy - 19} ${dc} ${dy - 20}C${dc + 3} ${dy - 19} ${dc + 10} ${dy - 17} ${dc + 10} ${dy - 7}`);
    g.d(P(dc, dy - 20, dc, dy - 23.5), P(dc - 11, dy - 4.5, dc + 11, dy - 4.5));
    g.f(arch(dc - 7.5, dy - 0.6, 2.2, dy - 3.2) + arch(dc - 3.3, dy - 0.6, 2.2, dy - 3.2) + arch(dc + 1.1, dy - 0.6, 2.2, dy - 3.2) + arch(dc + 5.3, dy - 0.6, 2.2, dy - 3.2));
    // Cypresses beside it.
    const cypress = (x: number, h: number) => `M${x} ${dy}C${x - 3.4} ${dy - h * 0.2} ${x - 2.4} ${dy - h * 0.75} ${x} ${dy - h}C${x + 2.4} ${dy - h * 0.75} ${x + 3.4} ${dy - h * 0.2} ${x} ${dy}`;
    g.d(cypress(dc - 22, 12), cypress(dc + 20, 9.5));
    g.o(P(0, 62, 100, 62));
  },
};

const petra: Drawing = {
  w: 84,
  h: 100,
  draw(g) {
    // The facade drawn in its own frame, set between the walls of the Siq.
    const cx = 32;
    const sh = (...d: string[]) => d.map((x) => mapPath(x, { pt: (px, py) => [px + 10, py] }));
    // The lower storey: steps, six columns, the entablature and the pediment.
    g.o(...sh(P(6, 100, 6, 97, 58, 97, 58, 100), P(7, 66, 57, 66, 57, 60, 7, 60, 7, 66), Pz(13, 60, cx, 50.5, 51, 60)));
    let cols = "";
    for (const x of [9.5, 18.5, 27.5, 36.5, 45.5, 54.5]) cols += P(x - 1.5, 97, x - 1.5, 67.5) + P(x + 1.5, 97, x + 1.5, 67.5) + P(x - 2.3, 67.5, x + 2.3, 67.5, x + 2.3, 66);
    g.d(...sh(cols, P(7, 63.5, 57, 63.5)));
    g.f(...sh(R(29.5, 78, 5, 19), P(17, 58, cx, 53.6, 47, 58)));
    // The upper storey: its floor; the round kiosk (columns, a tent roof, the urn) between two halves of a broken pediment.
    g.o(...sh(P(6, 50, 58, 50, 58, 46, 6, 46, 6, 50)));
    g.o(...sh(P(25, 46, 25, 22.5, 39, 22.5, 39, 46), P(24, 22.5, 24, 19.5, 40, 19.5, 40, 22.5), "M24.4 19.5Q30 16.6 32 11.4Q34 16.6 39.6 19.5"));
    g.o(...sh("M30.7 10.6Q29.8 8 31.3 7.1V6H32.7V7.1Q34.2 8 33.3 10.6Z", P(30.4, 11.4, 33.6, 11.4)));
    g.d(...sh(P(27.2, 44, 27.2, 24), P(30.4, 44, 30.4, 24), P(33.6, 44, 33.6, 24), P(36.8, 44, 36.8, 24)));
    g.o(...sh(sym(P(7, 46, 7, 24, 22, 24, 22, 46) + P(6, 24, 6, 20.5, 23, 20.5, 23, 24) + P(5, 20.5, 21.6, 15.2, 21.6, 20.5), cx)));
    g.d(...sh(sym(P(10, 44.5, 10, 26) + P(19, 44.5, 19, 26), cx)));
    g.f(...sh(sym(P(8.6, 19.8, 20.8, 16.3), cx)));
    // The Siq: ragged rock walls either side, their strata.
    const left: Pt[] = [[13, 100], [11.6, 93], [14, 86], [12, 78], [13.6, 70], [10.4, 62], [12.4, 53], [9.6, 44], [11.8, 35], [8.4, 26], [10.6, 17], [7.4, 8], [9, 0]];
    const right: Pt[] = [[71, 100], [72.6, 92], [70.2, 84], [72.2, 76], [70.6, 68], [73.6, 60], [71.4, 51], [74.4, 42], [72, 33], [75.4, 24], [73, 15], [76.4, 6], [75, 0]];
    g.o(line(smooth(left, 4)), line(smooth(right, 4)));
    const xAt = (pts: Pt[], y: number) => {
      for (let i = 0; i + 1 < pts.length; i++) if (y <= pts[i][1] && y >= pts[i + 1][1]) return pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * (pts[i][1] - y)) / (pts[i][1] - pts[i + 1][1]);
      return pts[0][0];
    };
    let strata = "", fine = "";
    for (const y of [11, 29, 47, 65, 83]) {
      const lx = xAt(left, y) - 1.4, rx = xAt(right, y + 5) + 1.4;
      strata += `M0.6 ${n3(y + 1.6)}Q${n3(lx / 2)} ${n3(y - 1)} ${n3(lx)} ${n3(y)}M${n3(rx)} ${n3(y + 5)}Q${n3((rx + 83.4) / 2)} ${n3(y + 3.4)} 83.4 ${n3(y + 6.6)}`;
      fine += `M1 ${n3(y + 8)}Q${n3(lx / 3)} ${n3(y + 6.4)} ${n3(lx * 0.6)} ${n3(y + 7.4)}M${n3(rx + 3)} ${n3(y + 12.4)}Q${n3(rx + 6)} ${n3(y + 11)} 83 ${n3(y + 12.6)}`;
    }
    g.d(strata);
    g.f(fine);
  },
};

const acropolis: Drawing = {
  w: 100,
  h: 60,
  draw(g) {
    // The rock: cliffs and strata.
    g.o("M0 60C5 56 8 50 10 44Q12 38 16 36.5H84Q88 38 90 44C92 50 95 56 100 60");
    g.d("M12 42Q30 40.5 50 41.5Q70 42.5 88.5 41", "M10.5 48Q24 46 36 47.5M60 47Q76 45.5 91 47.5", "M8 54Q20 52.6 30 54M72 53.5Q84 52 94 54");
    g.f("M24 38V44M42 38.5V43M58 38V44M76 38V43.5M18 49V53M84 49V53");
    // The Parthenon: steps, eight columns, the entablature and the pediment (broken at the right).
    g.o(P(22, 36.5, 22, 34.2, 78, 34.2, 78, 36.5), P(23.5, 34.2, 23.5, 32.6, 76.5, 32.6, 76.5, 34.2));
    let cols = "";
    for (let i = 0; i < 8; i++) {
      const x = 26.5 + i * 6.7;
      cols += P(x - 1.6, 32.6, x - 1.3, 20.8) + P(x + 1.6, 32.6, x + 1.3, 20.8);
    }
    g.d(cols);
    g.o(P(23.5, 20.8, 76.5, 20.8, 76.5, 16.8, 23.5, 16.8, 23.5, 20.8), P(22.5, 16.8, 50, 9.6, 63, 13), P(66.5, 14, 77.5, 16.8));
    g.f(P(23.5, 18.8, 76.5, 18.8), P(27, 16.2, 50, 10.8, 60, 13.4));
  },
};

const sagrada: Drawing = {
  w: 70,
  h: 100,
  draw(g) {
    const cx = 35, base = 62;
    // The four towers of the Nativity front: bottle-shaped, pierced, crowned by pinnacles.
    const tower = (tx: number, hw: number, top: number) => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 20; i++) {
        const y = base - ((base - top) * i) / 20;
        const u = (base - y) / (base - top);
        pts.push([tx - hw * Math.sqrt(Math.max(0, 1 - u ** 2.2)) * (1 - 0.12 * u), y]);
      }
      const side = line(pts);
      g.o(side + mir(side, tx));
      // Openings spiralling up.
      let slits = "";
      for (let i = 0; i < 9; i++) {
        const y = base - 5 - i * ((base - top - 10) / 9);
        const u = (base - y) / (base - top);
        const w = hw * Math.sqrt(Math.max(0, 1 - u ** 2.2)) * 0.5;
        const off = (i % 2 ? 0.25 : -0.25) * w;
        slits += P(tx + off - w * 0.35, y, tx + off + w * 0.35, y);
      }
      g.f(slits);
      // Pinnacle: a stem, a ball and a cross.
      g.d(P(tx, top, tx, top - 4), ring(tx, top - 5.8, 1.8), P(tx - 1.8, top - 9.2, tx + 1.8, top - 9.2), P(tx, top - 7.6, tx, top - 10.8));
    };
    tower(12.5, 5, 22);
    tower(26, 5, 12.5);
    tower(44, 5, 12.5);
    tower(57.5, 5, 22);
    // The front below: three portals under pointed gables.
    g.o(P(5, 100, 5, base, 65, base, 65, 100), P(0, 100, 70, 100));
    g.o(garch(27, 100, 16, 82, 13), P(28.5, base, cx, 49, 41.5, base));
    g.d(garch(9, 100, 10, 87, 7) + garch(51, 100, 10, 87, 7), garch(30.5, 100, 9, 85, 6.5), P(cx, 100, cx, 85));
    g.f(P(9, 76, 19, 76), P(51, 76, 61, 76), P(5, 68, 28, 68), P(42, 68, 65, 68), P(31.6, 58, 38.4, 58));
  },
};

const towerbridge: Drawing = {
  w: 100,
  h: 62,
  draw(g) {
    const deck = 40;
    const tower = (cx: number) => {
      g.o(P(cx - 7, 50, cx - 7, 15, cx + 7, 15, cx + 7, 50), R(cx - 9, 50, 18, 4.5));
      // Four corner turrets and the roof between them.
      g.o(P(cx - 7, 15, cx - 7, 12, cx - 5.5, 6.5, cx - 4, 12, cx - 4, 15), P(cx + 7, 15, cx + 7, 12, cx + 5.5, 6.5, cx + 4, 12, cx + 4, 15), P(cx - 4, 13, cx, 4.2, cx + 4, 13));
      g.d(P(cx, 4.2, cx, 1.5), P(cx - 7, 12, cx + 7, 12), garch(cx - 3.8, deck, 7.6, 33, 3.6));
      g.f(garch(cx - 3.2, 25, 2.2, 20.5, 1.6) + garch(cx + 1, 25, 2.2, 20.5, 1.6) + garch(cx - 1.1, 48.5, 2.2, 45, 1.4), P(cx - 7, 27.5, cx + 7, 27.5));
    };
    tower(33);
    tower(67);
    // The high walkways, latticed.
    g.o(P(40, 16.5, 60, 16.5), P(40, 21, 60, 21));
    let lat = "";
    for (let x = 40; x < 59.9; x += 4) lat += P(x, 16.5, x + 2, 21, x + 4, 16.5);
    g.d(lat);
    // The road deck, the bascules' joint.
    g.o(P(0, deck, 26, deck), P(40, deck, 60, deck), P(74, deck, 100, deck));
    g.d(P(0, deck + 2.6, 26, deck + 2.6), P(40, deck + 2.6, 60, deck + 2.6), P(74, deck + 2.6, 100, deck + 2.6));
    g.f(P(50, deck, 50, deck + 2.6));
    // The side spans: chains hung from the towers to the shore, with hangers.
    const chainL: [Pt, Pt, Pt] = [[26, 21], [14, 42], [4, 27]];
    g.o(sym(line(qPts(...chainL)) + P(2, deck, 2, 27, 6, 27, 6, deck) + P(2, 27, 4, 23, 6, 27), 50));
    let h = "";
    for (let x = 9; x <= 23; x += 3.5) h += P(x, yOn(qPts(...chainL, 40), x), x, deck);
    g.f(sym(h, 50));
    // The river.
    g.o(P(0, 54.5, 100, 54.5));
    g.d("M4 58Q7 57 10 58Q13 59 16 58M42 58Q45 57 48 58Q51 59 54 58M82 58Q85 57 88 58Q91 59 94 58");
  },
};

const pisa: Drawing = {
  w: 50,
  h: 100,
  draw(g) {
    // Drawn upright, then leant 5° about its foot.
    const [px, py] = [21, 100 - 11 * Math.sin((5 * Math.PI) / 180)];
    const a = (5 * Math.PI) / 180;
    const lean = (d: string) => mapPath(d, { pt: (x, y) => [px + (x - px) * Math.cos(a) - (y - py) * Math.sin(a), py + (x - px) * Math.sin(a) + (y - py) * Math.cos(a)], turn: 5 });
    const cx = px, R0 = 11, dip = 1.2;
    const Y = (y: number, th: number) => y + dip * Math.cos(th);
    const course = (y: number, r: number) => line(Array.from({ length: 17 }, (_, i) => -Math.PI / 2 + (Math.PI * i) / 16).map((th): Pt => [cx + r * Math.sin(th), Y(y, th)]));
    const levels = [py, 81, 72.2, 63.4, 54.6, 45.8, 37, 28.2];
    const o: string[] = [], d: string[] = [], f: string[] = [];
    o.push(P(cx - R0, py, cx - R0, 28.2), P(cx + R0, py, cx + R0, 28.2), course(py, R0), course(28.2, R0));
    // The belfry, narrower, and its roof.
    o.push(P(cx - 7.6, 28.2 + dip * 0, cx - 7.6, 18.5), P(cx + 7.6, 28.2, cx + 7.6, 18.5), course(18.5, 7.6), `M${cx - 5} ${18.5 + dip * 0.6}Q${cx} ${14.5} ${cx + 5} ${18.5 + dip * 0.6}`);
    for (let i = 1; i < levels.length - 1; i++) d.push(course(levels[i], R0));
    // Arcades round the cylinder: arches narrower toward the edges.
    const arcade = (yb: number, ytop: number, r: number, n: number, cls: string[]) => {
      const T = 1.3, dt = (2 * T) / n;
      for (let j = 0; j < n; j++) {
        const th = -T + dt * (j + 0.5);
        const hw = 0.32 * dt * r * Math.cos(th), ry = 0.32 * dt * r;
        cls.push(arch(cx + r * Math.sin(th) - hw, Y(yb, th) - 0.3, 2 * hw, Y(ytop, th) + 1 + ry, ry));
      }
    };
    arcade(levels[0], levels[1], R0, 5, d);
    for (let i = 1; i < 7; i++) arcade(levels[i], levels[i + 1], R0, 6, i % 2 ? d : d);
    arcade(28.2, 18.5, 7.6, 5, d);
    g.o(...o.map(lean));
    g.d(...d.map(lean));
    g.f(...f.map(lean));
    // The ground; the foot where the tower has sunk.
    const foot = mapPath(P(cx - R0, py), { pt: (x, y) => [px + (x - px) * Math.cos(a) - (y - py) * Math.sin(a), py + (x - px) * Math.sin(a) + (y - py) * Math.cos(a)] });
    const [fx, fy] = foot.slice(1).split(" ").map(Number);
    g.o(P(fx, fy, fx, 100), P(0, 100, 50, 100));
    g.f(P(4, 100, 4, 100));
  },
};

const redeemer: Drawing = {
  w: 70,
  h: 100,
  draw(g) {
    const cx = 35;
    // Corcovado: a sharp granite peak, the chapel block on its summit.
    g.o("M0 100C9 91 16 78 22 64C26 55 29.4 49 31.2 46H38.8C40.6 49 44 55 48 64C54 78 61 90 70 97");
    g.d("M24.6 61Q27.6 63 28.4 69M45.6 61Q42.6 64 42 70");
    g.f("M31 51Q30 57 27.8 61M39 51Q40 56 42 60");
    // A few trees on the lower slopes; clouds drifting by.
    let trees = "";
    for (const [x, y] of [[10, 95], [16, 88], [23, 95], [48, 95], [55, 90], [61, 96]] as const) trees += `M${x - 2.2} ${y}Q${x - 2.2} ${y - 2.6} ${x} ${y - 2.8}Q${x + 2.2} ${y - 2.6} ${x + 2.2} ${y}`;
    g.d(trees);
    const cloud = (x: number, y: number, w: number) => `M${x} ${y}H${x + w}Q${x + w + 0.6} ${y - 3} ${x + w * 0.72} ${y - 3}Q${x + w * 0.6} ${y - 6.4} ${x + w * 0.38} ${y - 4.2}Q${x + w * 0.2} ${y - 5.6} ${x + w * 0.16} ${y - 2.6}Q${x - 1} ${y - 2.4} ${x} ${y}`;
    g.d(cloud(2, 58, 15), cloud(53, 64, 13));
    // The art-deco pedestal: the chapel block, its door, the stepped plinth.
    g.o(P(29.6, 46, 29.6, 39.4, 40.4, 39.4, 40.4, 46), P(31, 39.4, 31, 37.2, 39, 37.2, 39, 39.4), P(32.2, 37.2, 32.2, 35.6, 37.8, 35.6, 37.8, 37.2));
    g.d(garch(33.7, 46, 2.6, 43.2, 1.5), P(29.6, 41.2, 40.4, 41.2));
    // The figure: the robe widening to the feet, the arms level and the hands dropping a little, the head.
    const half = "M35 35.6H31.6C32.4 30 33.3 26 33.5 22.4L33.2 17.9Q27 17.3 20.6 16.8H17.8Q16.4 17 15.2 16.4Q14.6 15.4 15.8 14.8Q16.8 14.2 17.8 14.1L21 13.8L32.3 13Q33.5 12.6 33.9 11.4H35";
    g.o(sym(half, cx), ring(cx, 8.9, 2.5));
    // Long folds down the robe, the sash, the sleeves.
    g.d("M34.2 19.6Q33.8 28 33.3 35.4M35.8 19.6Q36.2 28 36.7 35.4", "M33.5 22.6Q35 23.4 36.5 22.6");
    g.f("M35 24V35.4", "M24 17.1Q25.2 19 27.6 17.6M46 17.1Q44.8 19 42.4 17.6");
  },
};

const fuji: Drawing = {
  w: 100,
  h: 68,
  draw(g) {
    // The cone: long concave slopes, the crater's notched rim.
    g.o("M0 52Q24 46 36 26Q40 17 42.5 11.5L45 12.8L47.2 10.8L50 12.4L52.6 10.6L55 12.6L57.5 11.5Q60 17 64 26Q76 46 100 52");
    // The snow-cap's ragged edge, and its gullies.
    const snow: Pt[] = [[36.6, 25], [39, 29.5], [40.4, 25.5], [42.4, 32], [44.4, 26], [46.6, 34], [48.6, 27], [50.6, 33], [52.6, 26.5], [54.8, 31.5], [56.6, 25.8], [58.6, 30], [60, 25], [63.4, 27]];
    g.d(line(snow));
    g.f("M45 12.8L44 22M47.2 10.8L46.6 24M50 12.4L50.2 26M52.6 10.6L53.4 23M55 12.6L56.3 22");
    g.d("M42.4 32Q40 36 37 39M46.6 34Q46 37 45 40M50.6 33Q51.4 36.4 52.6 39.4M54.8 31.5Q57.4 35 60.4 37.6");
    // Cloud bands across the lower slopes, and the sun.
    g.d("M14 42Q22 38.6 30 41Q36 42.8 42 41", "M62 44Q70 41 78 43.4Q84 45 90 44", ring(84, 14, 5.5));
    g.f("M20 46.5Q28 44.6 34 46.2M66 48.6Q72 47 78 48.4");
    g.o(P(0, 56, 100, 56));
    g.d("M4 54Q20 50 34 54M60 53.5Q76 50.5 96 54");
    // The lake, the mountain in it.
    g.d(P(12, 59, 30, 59), P(38, 59, 62, 59), P(70, 59, 88, 59), P(24, 62, 40, 62), P(46, 62, 54, 62), P(60, 62, 76, 62), P(36, 65, 45, 65), P(55, 65, 64, 65));
    g.d(P(44, 67.4, 56, 67.4), P(4, 61.6, 16, 61.6), P(84, 61.6, 96, 61.6), P(2, 64.6, 26, 64.6), P(74, 64.6, 98, 64.6));
    // A lenticular cloud drifting by.
    g.d("M16 22Q23 19.4 31 21Q27 23.6 16 22Z");
  },
};

const angkor: Drawing = {
  w: 100,
  h: 60,
  draw(g) {
    // The terraces, stepping up to the middle; their galleries.
    g.o(P(3, 56, 3, 50, 14, 50, 14, 44, 26, 44, 26, 38, 74, 38, 74, 44, 86, 44, 86, 50, 97, 50, 97, 56), P(0, 56, 100, 56));
    let cols = "";
    for (let x = 6; x < 95; x += 3.2) cols += P(x, 51.6, x, 55);
    for (let x = 16.6; x < 84; x += 3.4) if (x < 25 || x > 75) cols += P(x, 45.6, x, 49);
    g.f(cols);
    g.d(P(3, 51.6, 97, 51.6), P(14, 45.6, 86, 45.6), P(26, 39.6, 74, 39.6));
    // The towers: lotus buds of stacked tiers.
    const tower = (tx: number, yb: number, hw: number, top: number, tiers: number) => {
      const left: Pt[] = [];
      const th = (yb - top) / (tiers + 1.2);
      for (let i = 0; i < tiers; i++) {
        const y0 = yb - i * th, y1 = y0 - th;
        const u0 = i / tiers, u1 = (i + 1) / tiers;
        const w0 = hw * (1 - 0.15 * u0 - 0.6 * u0 ** 2.4), w1 = hw * (1 - 0.15 * u1 - 0.6 * u1 ** 2.4);
        left.push([tx - w0, y0], [tx - w0 - th * 0.12, y0 - th * 0.35], [tx - w1 * 1.02, y1 + th * 0.08], [tx - w1, y1]);
      }
      const last = left[left.length - 1];
      left.push([tx - (tx - last[0]) * 0.45, last[1] - th * 0.7], [tx, top]);
      const side = line(left);
      g.o(side + mir(side, tx));
      let bands = "";
      for (let i = 1; i < tiers; i++) {
        const y = yb - i * th;
        const x = left[i * 4][0];
        bands += `M${n3(x + 0.4)} ${n3(y)}Q${n3(tx)} ${n3(y + 0.9)} ${n3(2 * tx - x - 0.4)} ${n3(y)}`;
      }
      g.d(bands);
      g.f(garch(tx - hw * 0.28, yb, hw * 0.56, yb - th * 0.9, th * 0.5));
    };
    tower(20, 44, 3.8, 25, 5);
    tower(80, 44, 3.8, 25, 5);
    tower(35, 38, 4.4, 15, 6);
    tower(65, 38, 4.4, 15, 6);
    tower(50, 38, 5.6, 3, 7);
    // A sugar palm.
    g.d("M93 50V36M93 36Q89 34 86.5 36.5M93 36Q97 34 99.5 36.5M93 36Q90 31.5 87.5 32M93 36Q96 31.5 98.5 32M93 36Q93 32 94 30");
  },
};

const brandenburg: Drawing = {
  w: 100,
  h: 66,
  draw(pen) {
    // Drawn with the gate's foot at 60, then set 6 lower to leave the quadriga room.
    const dn = (d: string[]) => d.map((x) => mapPath(x, { pt: (px, py) => [px, py + 6] }));
    const g: Pen = { o: (...d) => pen.o(...dn(d)), d: (...d) => pen.d(...dn(d)), f: (...d) => pen.f(...dn(d)), dot: (x, y, r) => pen.dot(x, y + 6, r) };
    // Steps, six Doric columns, the entablature, the stepped attic.
    g.o(P(6, 60, 6, 57, 94, 57, 94, 60), P(0, 60, 100, 60));
    let cols = "";
    const xs = [14, 28, 42.5, 57.5, 72, 86];
    for (const x of xs) cols += P(x - 2.4, 57, x - 2, 32.5) + P(x + 2.4, 57, x + 2, 32.5) + P(x - 3, 32.5, x + 3, 32.5, x + 3, 30.6, x - 3, 30.6, x - 3, 32.5);
    g.o(cols);
    g.o(P(9, 30.6, 91, 30.6, 91, 24, 9, 24, 9, 30.6));
    let tri = "";
    for (let x = 12; x < 89; x += 3.6) tri += P(x, 25.6, x, 28.4);
    g.f(tri);
    g.d(P(9, 25.3, 91, 25.3));
    g.o(P(20, 24, 20, 21, 31, 21, 31, 17, 69, 17, 69, 21, 80, 21, 80, 24));
    g.d(R(36, 18.6, 28, 3.6));
    // The quadriga, in profile: four horses abreast (the nearest whole, the heads of the others rising beside it, all their legs), the chariot, the goddess with her staff.
    const s = 1.5, X = (u: number) => 38 + u * s, Y = (v: number) => 17 - 9.4 * s + v * s;
    const Q = (...uv: number[]) => P(...uv.map((v, i) => (i % 2 ? Y(v) : X(v))));
    const head = (du: number, dv: number) => Q(du, dv, -2.6 + du, 1.6 + dv, -2.4 + du, 2.5 + dv, -0.8 + du, 2 + dv, 0.2 + du, 2.6 + dv, 0.6 + du, 5 + dv) + Q(0.4 + du, 0.1 + dv, 1.8 + du, 1.4 + dv, 2.8 + du, 4 + dv);
    let q = "";
    for (let k = 3; k >= 1; k--) q += head(k * 2.3, -k * 0.7);
    q += head(0, 0) + Q(2.8, 4, 6, 3.9, 9, 4.2, 9.9, 5, 9.6, 6.2, 3, 6.4, 0.8, 5.6, 0.6, 5);
    // Legs: the nearest horse's, one foreleg raised, and the others' between them.
    q += Q(1.8, 6.2, 1, 7.6, 0.2, 7.9) + Q(3, 6.4, 3.2, 9.4) + Q(8, 6.3, 8.6, 9.4) + Q(9.2, 6, 10, 9.2) + Q(4.4, 6.4, 4.8, 9.4) + Q(6.4, 6.4, 6.6, 9.4);
    g.d(q);
    // The chariot and its wheel; the goddess, her staff with the wreath and cross.
    g.d(Q(10.6, 5, 14, 5, 14, 8, 10.6, 8), ring(X(12.6), Y(8.2), 1.2 * s), Q(12.4, 5, 12.2, -0.6), Q(12.2, 1, 14.6, -0.6, 14.6, -5.6), Q(13.7, -4.6, 15.5, -4.6), ring(X(14.6), Y(-3), 0.8 * s));
    g.dot(X(12.2), Y(-1.6), 0.9);
    // Guardhouses to either side.
    g.o(P(0, 57, 0, 40, 5, 40, 5, 57), P(100, 57, 100, 40, 95, 40, 95, 57));
    g.f(P(0, 43, 5, 43), P(95, 43, 100, 43));
  },
};

const burjkhalifa: Drawing = {
  w: 40,
  h: 100,
  draw(g) {
    const cx = 20;
    // Setbacks spiralling up: the left and the right each step in, at different heights.
    const L: [number, number][] = [[6, 97], [8, 80], [10, 65], [11.8, 51], [13.4, 39], [15, 29], [16.4, 21]];
    const Rt: [number, number][] = [[34, 97], [31.6, 86], [29.6, 71], [27.8, 57], [26.2, 45], [24.8, 34], [23.4, 24]];
    const side = (s: [number, number][], dir: number) => {
      const pts: Pt[] = [];
      s.forEach(([x, y], i) => {
        const next = s[i + 1];
        pts.push([x, y]);
        if (next) pts.push([x, next[1]], [x + dir * 0.0, next[1]]);
      });
      return pts;
    };
    const left = side(L, 1), right = side(Rt, -1);
    const lt = left[left.length - 1], rt = right[right.length - 1];
    g.o(line(left) + P(lt[0], lt[1], 17.4, 16));
    g.o(line(right) + P(rt[0], rt[1], 22.6, 16));
    g.o(P(17.4, 16, cx - 0.5, 3, cx, 0.3, cx + 0.5, 3, 22.6, 16));
    // Each setback's roof (the step's top), and the wings' fins up the face.
    let steps = "";
    L.forEach(([x, y], i) => i > 0 && (steps += P(L[i - 1][0], y, x, y)));
    Rt.forEach(([x, y], i) => i > 0 && (steps += P(Rt[i - 1][0], y, x, y)));
    g.o(steps);
    let fins = "";
    for (let i = 1; i < L.length; i++) fins += P(L[i][0] + 2, 97, L[i][0] + 2, L[i][1]);
    for (let i = 1; i < Rt.length; i++) fins += P(Rt[i][0] - 2, 97, Rt[i][0] - 2, Rt[i][1]);
    g.f(fins);
    g.d(P(cx, 97, cx, 16));
    let floors = "";
    for (let y = 92; y > 20; y -= 5) {
      // Each wing's face at this height: the last setback at or below it.
      const lx = L.filter(([, yy]) => yy >= y).pop()![0], rx = Rt.filter(([, yy]) => yy >= y).pop()![0];
      floors += P(lx + 0.8, y, cx - 0.8, y) + P(cx + 0.8, y, rx - 0.8, y);
    }
    g.f(floors);
    g.o(P(2, 97, 38, 97), P(0, 100, 40, 100));
  },
};

const empirestate: Drawing = {
  w: 40,
  h: 100,
  draw(g) {
    const cx = 20;
    const half = P(1, 100, 1, 88, 4.5, 88, 4.5, 81, 7, 81, 7, 43, 9, 43, 9, 25, 11.5, 25, 11.5, 20.5, 13.5, 20.5, 13.5, 16.5, 15.4, 16.5, 15.4, 13.2, 16.6, 13.2, 16.6, 8.4) + `Q${16.8} 5.6 ${cx} 5`;
    g.o(sym(half, cx), P(cx, 5, cx, 0.4), P(0, 100, 40, 100));
    // The piers up the shaft and the wings; the mast's ribs.
    let piers = "";
    for (let x = 10.6; x < 29.5; x += 3.1) piers += P(x, 80.5, x, 26);
    g.d(piers, P(4.5, 88, 35.5, 88), P(7, 81, 33, 81));
    g.f(P(18, 12.8, 18, 8.8), P(22, 12.8, 22, 8.8), P(13.5, 18.5, 26.5, 18.5), P(8, 45, 8, 79), P(32, 45, 32, 79), P(3, 91, 3, 98), P(37, 91, 37, 98));
    g.d(P(9, 43, 31, 43));
    let bands = "";
    for (let y = 30; y < 80; y += 6) bands += P(9, y, 31, y);
    g.f(bands, P(1, 94, 39, 94));
  },
};

const neuschwanstein: Drawing = {
  w: 96,
  h: 80,
  draw(g) {
    const ground = 56;
    // The crag and its fir trees.
    g.o("M6 80C10 72 10 64 14 58Q15 56 17 56H78Q82 56 84 60C86 66 88 74 92 80");
    g.d("M16 64Q20 66 21 70M80 64Q77 66 77 71");
    let firs = "";
    for (const [x, y, s] of [[4, 80, 5], [10, 80, 6], [86, 80, 6], [93, 80, 5], [20, 80, 4], [74, 80, 4.5]] as const) firs += Pz(x - s * 0.45, y, x, y - s * 1.5, x + s * 0.45, y);
    g.d(firs);
    // The palace: tall, gabled, a turret at its corner.
    g.o(P(50, ground, 50, 22, 68, 22, 68, ground), P(49, 22, 59, 11, 69, 22));
    g.o(P(66, 34, 66, 17, 71, 17, 71, 40), P(65.2, 17, 68.5, 6, 71.8, 17), P(71, 40, 68, 40));
    g.d(P(68.5, 6, 68.5, 3.5));
    // The tall north tower and its cone; the bower and its stair tower; the gatehouse.
    g.o(P(42, ground, 42, 16, 47.6, 16, 47.6, ground), P(41, 16, 44.8, 2.5, 48.6, 16));
    g.d(P(44.8, 2.5, 44.8, 0.4), P(41, 16, 48.6, 16), P(41.4, 19, 48.2, 19));
    g.o(P(26, ground, 26, 36, 38, 36, 38, ground), P(25, 36, 32, 29, 39, 36));
    g.o(P(38, 44, 38, 26, 42, 26), P(37.2, 26, 40, 17, 42, 22));
    g.o(P(15, ground, 15, 42, 26, 42), P(15, 42, 15, 39, 17, 39, 17, 42, 19.4, 42, 19.4, 39, 21.6, 39, 21.6, 42, 24, 42, 24, 39, 26, 39));
    g.o(P(13.6, 42, 13.6, 34, 17.4, 34, 17.4, 42), P(13, 34, 15.5, 27, 18, 34));
    g.d(garch(18.4, ground, 5, 50, 3));
    // Windows: arched, in rows.
    let w = "";
    for (const y of [28, 36, 44]) for (let x = 52.2; x < 66; x += 3.4) w += garch(x, y + 3.6, 1.6, y + 1.2, 1.2);
    for (let x = 28.2; x < 37; x += 3.2) w += garch(x, 46, 1.6, 43.4, 1.2);
    w += garch(43.9, 26, 1.6, 23.4, 1.2) + garch(43.9, 36, 1.6, 33.4, 1.2);
    g.f(w);
    // Mountains behind.
    g.d("M0 36Q6 26 12 30L14 31", "M72 30Q78 24 84 26Q90 22 96 28");
  },
};

const santorini: Drawing = {
  w: 100,
  h: 64,
  draw(g) {
    // The sea and the caldera's island beyond.
    g.d(P(74, 30, 100, 30), "M80 30Q86 25.6 94 30");
    g.f("M78 36H84M88 40H96M80 45H86");
    // Houses stacked down the slope: whitewashed boxes, rounded at the corners.
    const houses: [number, number, number, number][] = [
      [0, 50, 13, 14], [13, 54, 16, 10], [29, 56, 13, 8], [42, 52, 16, 12], [76, 54, 12, 10], [88, 50, 12, 14],
      [2, 38, 10, 12], [15, 44, 13, 10], [30, 46, 11, 10], [72, 42, 12, 12],
      [16, 36, 10, 8],
    ];
    let hs = "", win = "";
    for (const [x, y, w, h] of houses) {
      hs += RR(x, y, w, h, 1.4);
      win += R(x + w * 0.2, y + h * 0.3, w * 0.18, h * 0.25);
      if (w > 11) win += arch(x + w * 0.58, y + h, w * 0.2, y + h * 0.55);
    }
    g.d(hs);
    g.f(win);
    // The church: its box, drum, dome and cross; the bell tower beside it.
    g.o(P(58, 64, 58, 40, 72, 40, 72, 64), P(59.5, 40, 59.5, 35.6, 70.5, 35.6, 70.5, 40), "M59.5 35.6A5.5 5.5 0 0 1 70.5 35.6");
    g.d(P(65, 30.1, 65, 24.4), P(63, 26.4, 67, 26.4), arch(62.6, 64, 4.8, 57.4), P(59.5, 38, 70.5, 38));
    g.o(P(44, 52, 44, 36, 56, 36, 56, 52), P(46, 36, 46, 29, 54, 29, 54, 36), P(48, 29, 48, 25.4, 52, 25.4, 52, 29));
    g.d(arch(45.8, 45, 3.6, 40.4) + arch(50.6, 45, 3.6, 40.4) + arch(48.2, 35, 3.6, 32));
    g.dot(47.6, 41.6, 0.9);
    g.dot(52.4, 41.6, 0.9);
    g.dot(50, 33.2, 0.8);
    g.d(P(50, 25.4, 50, 22), P(48.6, 23.2, 51.4, 23.2));
    // The little dome on a house to the left.
    g.o("M3.5 38A3.5 3.5 0 0 1 10.5 38");
    g.d(P(7, 34.5, 7, 32));
    g.o(P(0, 64, 100, 64));
  },
};

const DRAWINGS: Record<Landmark, Drawing> = {
  eiffel, colosseum, bigben, tajmahal, giza, machupicchu, greatwall, sydneyopera, goldengate, liberty, westernwall, petra,
  acropolis, sagrada, towerbridge, pisa, redeemer, fuji, angkor, brandenburg, burjkhalifa, empirestate, neuschwanstein, santorini,
};

/** Each drawing's parts in its own box, drawn once. */
const cache = new Map<Landmark, { w: number; h: number; o: string; d: string; f: string; dots: [number, number, number][] }>();
function parts(id: Landmark) {
  let c = cache.get(id);
  if (!c) {
    const dr = DRAWINGS[id];
    const acc = { o: [] as string[], d: [] as string[], f: [] as string[], dots: [] as [number, number, number][] };
    dr.draw({ o: (...d) => acc.o.push(...d), d: (...d) => acc.d.push(...d), f: (...d) => acc.f.push(...d), dot: (x, y, r) => acc.dots.push([x, y, r]) });
    c = { w: dr.w, h: dr.h, o: acc.o.join(""), d: acc.d.join(""), f: acc.f.join(""), dots: acc.dots };
    cache.set(id, c);
  }
  return c;
}

/** A drawing's own box (width, height). */
export const landmarkBox = (id: Landmark) => ({ w: DRAWINGS[id].w, h: DRAWINGS[id].h });

export interface LandmarkOpts {
  /** The outline's stroke width, print units (by default from the drawing's scale: 0.9–1.2 at the grid's sizes). */
  weight?: number;
  /** Draw the fine detail (by default when the drawing is large enough for it). */
  fine?: boolean;
}

/** The scale at which a drawing's fine detail stays open (its lines at least ~0.8 apart). */
export const FINE_SCALE = 0.62;

/**
 * A landmark drawn into the box (x, y, w, h): its proportions kept, centred
 * across and standing on the box's bottom. Stroked in the ink, round caps
 * and joins; every point placed by arithmetic.
 */
export function landmarkSvg(id: Landmark, x: number, y: number, w: number, h: number, opts: LandmarkOpts = {}): string {
  const p = parts(id);
  const k = Math.min(w / p.w, h / p.h);
  const ox = x + (w - p.w * k) / 2, oy = y + h - p.h * k;
  // 0.9 at the nine-up's tiles to 1.2 at full size, a little heavier when drawn larger still.
  const weight = opts.weight ?? (k <= 1 ? Math.min(1.2, Math.max(0.9, 0.5 + 0.7 * k)) : Math.min(1.6, 1.2 + (k - 1) * 0.35));
  const detail = Math.max(0.5, weight * 0.58), fineW = Math.max(0.5, weight * 0.46);
  const fine = opts.fine ?? k >= FINE_SCALE;
  const map: PathMap = { pt: (px, py) => [ox + px * k, oy + py * k], len: (r) => r * k, fmt: n2 };
  const stroke = (d: string, sw: number) => (d ? `<path d="${mapPath(d, map)}" fill="none" stroke="${INK}" stroke-width="${n2(sw)}" stroke-linecap="round" stroke-linejoin="round"/>` : "");
  let dots = "";
  for (const [cx, cy, r] of p.dots) {
    const [X, Y, Rr] = [ox + cx * k, oy + cy * k, Math.max(0.45, r * k)];
    dots += `M${n2(X - Rr)} ${n2(Y)}A${n2(Rr)} ${n2(Rr)} 0 1 0 ${n2(X + Rr)} ${n2(Y)}A${n2(Rr)} ${n2(Rr)} 0 1 0 ${n2(X - Rr)} ${n2(Y)}Z`;
  }
  return stroke(p.o, weight) + stroke(p.d, detail) + (fine ? stroke(p.f, fineW) : "") + (dots ? `<path d="${dots}" fill="${INK}"/>` : "");
}
