/**
 * Eight dinosaur skeletons (and a pterosaur, which is not one, as every
 * museum label says) drawn in code as a monograph's "restoration of the
 * skeleton": side view, facing left, bones outlined in the ink and filled
 * with the ground so the near ones hide the far ones.
 *
 * Every animal is built in metres, y up, from one recipe: a spline for the
 * backbone with a vertebra placed at each step (centrum, neural spine,
 * chevron, cervical rib, each sized from the species' tables), ribs swept
 * from the dorsals, a pelvis and a shoulder girdle, limbs as chains of long
 * bones between joints, toes and claws, and a skull outlined in its own
 * units with its openings, teeth and horns. Two passes: the first finds the
 * animal's extent, the second draws at the scale that fits the box, so the
 * detail (how finely a curve is sampled, when a tail vertebra becomes a
 * dash) is chosen in print units. No transform: every point is placed by
 * arithmetic.
 */
import { INK, f1 } from "../kit";
import { GROUND } from "../svg";

type P = [number, number];

export const DINOSAURS = ["tyrannosaurus", "triceratops", "stegosaurus", "brontosaurus", "allosaurus", "diplodocus", "iguanodon", "pteranodon"] as const;
export type Dinosaur = (typeof DINOSAURS)[number];

/** Line weights, print units (1 unit ≈ 0.93 mm on the shirt). */
const W = { bone: 0.85, far: 0.6, fine: 0.55, skull: 0.9 };

// ---------------------------------------------------------------- geometry

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k];
const len = (a: P) => Math.hypot(a[0], a[1]);
const unit = (a: P): P => mul(a, 1 / (len(a) || 1));
/** The left normal (y up: a vector pointing right turns to point up). */
const perp = (a: P): P => [-a[1], a[0]];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rot = (a: P, deg: number): P => {
  const r = (deg * Math.PI) / 180;
  return [a[0] * Math.cos(r) - a[1] * Math.sin(r), a[0] * Math.sin(r) + a[1] * Math.cos(r)];
};
const dir = (deg: number): P => rot([1, 0], deg);

const same = (a: P, b: P) => a[0] === b[0] && a[1] === b[1];

/**
 * A Catmull-Rom curve through the points, each piece cut into steps about
 * `seg` long. A point written twice is a corner: the curve runs smooth up to
 * it and leaves it afresh (a horn's tip, a plate's point, a peduncle).
 */
function spline(pts: P[], closed: boolean, seg: number): P[] {
  const corners: number[] = [];
  for (let i = 0; i < pts.length; i++) if (same(pts[i], pts[(i + 1) % pts.length]) && (closed || i + 1 < pts.length)) corners.push(i);
  if (corners.length) {
    // Rotate a closed outline to start at a corner, then draw each run between corners open.
    const q = closed ? [...pts.slice(corners[0] + 1), ...pts.slice(0, corners[0] + 1)] : pts;
    const runs: P[][] = [[]];
    for (let i = 0; i < q.length; i++) {
      runs[runs.length - 1].push(q[i]);
      if (i + 1 < q.length && same(q[i], q[i + 1])) runs.push([]);
    }
    if (closed) runs[runs.length - 1].push(q[0]);
    return runs.filter((r) => r.length > 1).flatMap((r) => smooth(r, false, seg));
  }
  return smooth(pts, closed, seg);
}

function smooth(pts: P[], closed: boolean, seg: number): P[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: P[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const steps = Math.max(2, Math.ceil(len(sub(p2, p1)) / seg));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** An ellipse's points (centre, radii, turned `deg`). */
function ell(cx: number, cy: number, rx: number, ry: number, deg = 0, n = 16): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    out.push(add([cx, cy], rot([rx * Math.cos(a), ry * Math.sin(a)], deg)));
  }
  return out;
}

/** A value from a table of (x, value) pairs, linear between them, held at the ends. */
function table(t: [number, number][], x: number): number {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) return t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * (x - t[i - 1][0])) / (t[i][0] - t[i - 1][0]);
  return t[t.length - 1][1];
}

/** A polyline measured: each point's distance along it. */
class Track {
  pts: P[];
  s: number[];
  total: number;
  constructor(pts: P[]) {
    this.pts = pts;
    this.s = [0];
    for (let i = 1; i < pts.length; i++) this.s.push(this.s[i - 1] + len(sub(pts[i], pts[i - 1])));
    this.total = this.s[this.s.length - 1];
  }
  /** The point and unit tangent at distance d. */
  at(d: number): { p: P; t: P } {
    const s = this.s;
    d = Math.max(0, Math.min(this.total, d));
    let i = 1;
    while (i < s.length - 1 && s[i] < d) i++;
    const f = (d - s[i - 1]) / (s[i] - s[i - 1] || 1);
    return { p: lerp(this.pts[i - 1], this.pts[i], f), t: unit(sub(this.pts[i], this.pts[i - 1])) };
  }
  /** The distance at which the track first reaches x. */
  atX(x: number): number {
    for (let i = 1; i < this.pts.length; i++)
      if (this.pts[i][0] >= x) {
        const f = (x - this.pts[i - 1][0]) / (this.pts[i][0] - this.pts[i - 1][0] || 1);
        return this.s[i - 1] + f * (this.s[i] - this.s[i - 1]);
      }
    return this.total;
  }
}

// ---------------------------------------------------------------- the sheet

interface Prim {
  pts: P[];
  closed: boolean;
  /** Stroke weight, print units (0: no stroke). */
  w: number;
  fill: "none" | "ground" | "ink";
}

/** Everything drawn, in metres, in paint order; `k` is the print units a metre will be. */
class Sheet {
  prims: Prim[] = [];
  constructor(readonly k: number) {}
  /** A sampling step, metres, for curves about `units` print units a piece. */
  step(units = 1.4) {
    return units / this.k;
  }
  poly(pts: P[], closed: boolean, w: number, fill: Prim["fill"] = "none") {
    this.prims.push({ pts, closed, w, fill });
  }
  curve(pts: P[], closed: boolean, w: number, fill: Prim["fill"] = "none") {
    this.poly(spline(pts, closed, this.step()), closed, w, fill);
  }
  line(a: P, b: P, w: number) {
    this.poly([a, b], false, w);
  }
  /** A shape outlined and filled with the ground (it hides what's behind); a small one filled with the ink instead. */
  solid(pts: P[], w: number, smooth = true) {
    const q = smooth ? spline(pts, true, this.step()) : pts;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of q) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
    if (Math.min(x1 - x0, y1 - y0) * this.k < 2.2) this.poly(q, true, 0.3, "ink");
    else this.poly(q, true, w, "ground");
  }
  /**
   * A tapering ribbon along a centreline, filled with the ink: `w0` wide at
   * the start, `w1` at the end, in print units (a rib, a finger of the wing).
   */
  ribbon(center: P[], w0: number, w1: number) {
    const c = spline(center, false, this.step(1.2));
    const tr = new Track(c);
    const left: P[] = [], right: P[] = [];
    for (let i = 0; i < c.length; i++) {
      const t = unit(sub(c[Math.min(c.length - 1, i + 1)], c[Math.max(0, i - 1)]));
      const n = perp(t);
      const hw = ((w0 + (w1 - w0) * (tr.s[i] / (tr.total || 1))) / 2) / this.k;
      left.push(add(c[i], mul(n, hw)));
      right.push(sub(c[i], mul(n, hw)));
    }
    this.poly([...left, ...right.reverse()], true, 0, "ink");
  }

  /**
   * A long bone between two joints: round ends `ra` and `rb` (half-widths,
   * metres), a waisted shaft, bowed by `bow` of its length, a gap left at
   * each joint.
   */
  bone(a: P, b: P, ra: number, rb: number, o: { shaft?: number; bow?: number; w?: number; gap?: number } = {}) {
    const gap = o.gap ?? 0.9 / this.k / 2;
    const u = unit(sub(b, a));
    const a1 = add(a, mul(u, gap + ra * 0.45)), b1 = sub(b, mul(u, gap + rb * 0.45));
    const L = len(sub(b1, a1));
    if (L <= 0) return;
    const n = perp(u);
    const sh = (o.shaft ?? 0.55) * Math.min(ra, rb);
    const bow = (o.bow ?? 0) * L;
    const e = 0.3;
    const bump = (x: number) => (x < e ? Math.cos((Math.PI * x) / (2 * e)) ** 2 : 0);
    const hw = (t: number) => sh + (ra - sh) * bump(t) + (rb - sh) * bump(1 - t);
    const axis = (t: number): P => add(lerp(a1, b1, t), mul(n, bow * 4 * t * (1 - t)));
    const N = Math.max(6, Math.ceil((L * this.k) / 1.4));
    const left: P[] = [], right: P[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const tg = unit(sub(axis(Math.min(1, t + 0.01)), axis(Math.max(0, t - 0.01))));
      const nn = perp(tg);
      left.push(add(axis(t), mul(nn, hw(t))));
      right.push(sub(axis(t), mul(nn, hw(t))));
    }
    const cap = (c: P, r: number, sign: number): P[] => {
      const out: P[] = [];
      for (let i = 1; i < 8; i++) {
        const ph = -Math.PI / 2 + (i / 8) * Math.PI;
        out.push(add(c, add(mul(u, sign * r * 0.45 * Math.cos(ph)), mul(n, -sign * r * Math.sin(ph)))));
      }
      return out;
    };
    // Along the left side, round the far end, back along the right, round the near end.
    const pts = [...left, ...cap(b1, rb, 1), ...right.reverse(), ...cap(a1, ra, -1)];
    const small = Math.min(ra, rb) * 2 * this.k < 1.6;
    if (small) this.ribbon([a1, axis(0.5), b1], Math.min(1.1, Math.max(0.6, ra * 2 * this.k)), Math.min(1.0, Math.max(0.6, rb * 2 * this.k)));
    else this.poly(pts, true, o.w ?? W.bone, "ground");
  }

  /** A horn, a spike or a claw: a cone from a base `wb` wide to a point, bent by `bend` of its length (positive: to the left of travel). */
  cone(base: P, tip: P, wb: number, bend = 0, w = W.bone) {
    this.solid(conePts(base, tip, wb, bend), w, false);
  }
}

/** A cone's outline (a horn, a claw, a spike, a tooth), in any units. */
function conePts(base: P, tip: P, wb: number, bend = 0, n = 8): P[] {
  const u = unit(sub(tip, base)), nn = perp(u), L = len(sub(tip, base));
  const c = (t: number): P => add(lerp(base, tip, t), mul(nn, bend * L * Math.sin(Math.PI * t * 0.5) * t));
  const left: P[] = [], right: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const hw = (wb / 2) * (1 - t) ** 0.9;
    left.push(add(c(t), mul(nn, hw)));
    right.push(sub(c(t), mul(nn, hw)));
  }
  return [...left.slice(0, -1), c(1), ...right.slice(0, -1).reverse()];
}

// ---------------------------------------------------------------- recipes

/** A table over x (metres along the animal): (x, value) pairs. */
type Tab = [number, number][];

interface Skull {
  /** Snout to back, metres; turned `deg` (positive: the snout tipped down). */
  L: number;
  deg: number;
  /** Where the neck meets it, in the skull's units (x 0 at the snout, 1 at the back; y up). */
  condyle: P;
  outline: P[];
  jaw: P[];
  /** The jaw opened about this joint by `open` degrees. */
  joint: P;
  open: number;
  holes: P[][];
  jawHoles?: P[][];
  /** Tooth rows: from, to, count, length (skull units). */
  teeth?: [P, P, number, number][];
  jawTeeth?: [P, P, number, number][];
  /** Horns (base, tip, base width, bend), the far ones drawn behind the skull. */
  horns?: [P, P, number, number][];
  farHorns?: [P, P, number, number][];
  /** A frill's scalloped edge: the outline's points from..to get this many bumps. */
  scallop?: { from: number; to: number; count: number; amp: number };
  /** Open lines on the skull (a ridge, a suture). */
  lines?: P[][];
}

interface Leg {
  /** Joints, top down: hip or shoulder, knee or elbow, ankle or wrist, the ball of the foot. */
  joints: P[];
  /** Each bone's half-widths at its two ends. */
  r: [number, number][];
  bow?: number[];
  /** Toes from the ball: angles (degrees, 180 = forward) of each phalanx, their lengths, and the claw. */
  toes: { a: number[]; l: number[]; r: number; claw: number; clawBend?: number }[];
  /** How many metapodials fan from the ankle to the ball. */
  fan?: number;
}

interface Species {
  /** The backbone: condyle to tail tip, metres, y up. */
  spine: P[];
  /** Where the neck, the back and the sacrum end (x), and each region's count. */
  ends: [number, number, number];
  counts: [number, number, number, number];
  /** Centrum height, neural spine height, the spine's lean back (degrees): by x. */
  hc: Tab;
  hs: Tab;
  lean: Tab;
  /** Chevron length by x (0: none), rib length by x, how far the ribs sweep back. */
  chev: Tab;
  rib: Tab;
  sweep: number;
  /** Cervical ribs' length as a share of the vertebra's (sauropods: long). */
  cervRib?: number;
  /** Gastralia along a belly line. */
  belly?: P[];
  hind: Leg;
  fore: Leg;
  /** The far legs: the near ones' joints moved (dx) or given whole. */
  farHind?: Partial<Leg> & { dx?: number };
  farFore?: Partial<Leg> & { dx?: number };
  scapula: P[];
  coracoid: P[];
  ilium: P[];
  /** Pubis and ischium as bones: from, to, half-widths; a boot or a paddle as a shape. */
  pubis: [P, P, number, number][];
  ischium: [P, P, number, number][];
  pelvisExtra?: P[][];
  skull: Skull;
  /** Drawn first (far plates) and after the legs (near plates, spikes, a wing). */
  back?: (s: Sheet, sp: Built) => void;
  front?: (s: Sheet, sp: Built) => void;
}

/** A vertebra placed: where, which way, how big. */
interface Vert {
  p: P;
  t: P;
  n: P;
  l: number;
  hc: number;
  hs: number;
  lean: number;
  region: 0 | 1 | 2 | 3;
}
interface Built {
  track: Track;
  verts: Vert[];
  /** The top of a vertebra's neural spine. */
  top: (v: Vert) => P;
}

// ---------------------------------------------------------------- drawing

function placeVerts(sp: Species, track: Track): Vert[] {
  const bounds = [0, ...sp.ends.map((x) => track.atX(x)), track.total];
  const out: Vert[] = [];
  for (let r = 0; r < 4; r++) {
    const [s0, s1] = [bounds[r], bounds[r + 1]];
    const n = sp.counts[r];
    const gap = (s1 - s0) / n;
    for (let i = 0; i < n; i++) {
      const { p, t } = track.at(s0 + (i + 0.5) * gap);
      const x = p[0];
      out.push({ p, t, n: perp(t), l: gap, hc: table(sp.hc, x), hs: table(sp.hs, x), lean: table(sp.lean, x), region: r as Vert["region"] });
    }
  }
  return out;
}

const spineTop = (v: Vert): P => add(v.p, add(mul(v.n, v.hc / 2 + v.hs), mul(v.t, v.hs * Math.tan((v.lean * Math.PI) / 180))));

function drawVert(s: Sheet, v: Vert, sp: Species) {
  const k = s.k;
  // A neck's vertebrae are short and broad and overlap; the rest have joints between them.
  const gap = v.region === 0 ? Math.max(0.06 * v.l, 0.6 / k) : Math.min(0.4 * v.l, Math.max(0.16 * v.l, 0.8 / k));
  const l = v.l - gap;
  const at = (a: number, b: number): P => add(v.p, add(mul(v.t, a), mul(v.n, b)));
  const lp = l * k, hp = v.hc * k;
  if (lp < 1.1 || hp < 0.9) return false;
  if (lp < 2 || hp < 1.8) {
    // Too small to outline: a dash as thick as the centrum.
    s.ribbon([at(-l / 2, 0), at(l / 2, 0)], Math.max(0.6, Math.min(hp, 1.3)), Math.max(0.55, Math.min(hp, 1.3) * 0.9));
    if (v.hs * k > 1.2) s.ribbon([at(0, v.hc / 2), spineTop(v)], 0.7, 0.5);
    return true;
  }
  const w = Math.min(lp, hp) < 3.4 ? W.fine : W.bone;
  const h = v.hc / 2;
  // Chevron under a tail vertebra, raked back.
  const ch = v.region === 3 ? table(sp.chev, v.p[0]) : 0;
  if (ch * k > 1.2) {
    const base = at(l * 0.25, -h * 0.9);
    const tip = add(base, mul(add(mul(v.n, -Math.cos(0.55)), mul(v.t, Math.sin(0.55))), ch));
    if (ch * k > 5 && l * k > 3) s.cone(base, tip, l * 0.38, 0, W.fine);
    else s.line(base, tip, W.fine);
  }
  // Cervical rib, running back under the next vertebra.
  if (v.region === 0 && sp.cervRib) {
    const a = at(-l * 0.25, -h * 0.75), b = at(l * (sp.cervRib - 0.25), -h * 1.05);
    s.ribbon([a, lerp(a, b, 0.5), b], Math.max(0.6, Math.min(1.2, v.hc * k * 0.18)), 0.5);
  }
  // Transverse process: a short wing of bone sticking out sideways, seen end on as a knob (the back and the base of the tail).
  if ((v.region === 1 || v.region === 3) && v.hs > 0 && lp > 3.5) s.solid([at(-l * 0.28, h * 0.55), at(l * 0.3, h * 0.7), at(l * 0.36, h * 1.05), at(-l * 0.3, h * 1.0)], W.fine, false);
  // Neural spine: from the arch, leaning back, a rounded top.
  if (v.hs * k > 1.2) {
    const lean = Math.tan((v.lean * Math.PI) / 180);
    const bw = Math.min(l * 0.62, Math.max(l * 0.35, v.hs * 0.6)), tw = bw * (v.hs > v.l * 1.5 ? 0.75 : 0.55);
    const top = v.hc / 2 + v.hs;
    const pts: P[] = [at(-bw / 2, h * 0.5), at(-bw / 2 + top * lean * 0.3 - bw * 0.05, h + (top - h) * 0.3), at(-tw / 2 + top * lean, top - tw * 0.25), at(top * lean, top), at(tw / 2 + top * lean, top - tw * 0.25), at(bw / 2 + top * lean * 0.3, h + (top - h) * 0.3), at(bw / 2, h * 0.5)];
    if (bw * k < 2.2) s.ribbon([at(0, h * 0.8), at(top * lean, top)], Math.min(1.3, Math.max(0.75, bw * k * 0.6)), 0.5);
    else s.solid(pts, w, false);
    // Zygapophyses: the little joints between one arch and the next.
    if (lp > 5) s.poly([at(-l / 2 - gap * 0.4, h * 1.25), at(-l * 0.2, h * 1.5), at(l * 0.2, h * 1.5), at(l / 2 + gap * 0.3, h * 1.3)], false, W.fine);
  }
  // Centrum: a spool, its ends a little hollow.
  const c: P[] = [at(-l / 2, -h), at(0, -h * 0.82), at(l / 2, -h), at(l / 2 - l * 0.06, 0), at(l / 2, h), at(0, h * 0.9), at(-l / 2, h), at(-l / 2 + l * 0.06, 0)];
  s.solid(c, w, false);
  return true;
}

function drawSpine(s: Sheet, sp: Species, verts: Vert[], track: Track) {
  let taperFrom = -1;
  for (let i = 0; i < verts.length; i++) if (!drawVert(s, verts[i], sp) && taperFrom < 0) taperFrom = i;
  // The tail's last few, too fine for dashes: one tapering line to the tip.
  if (taperFrom >= 0) {
    const d0 = track.atX(verts[taperFrom].p[0]) - verts[taperFrom].l / 2;
    const pts: P[] = [];
    for (let d = d0; d < track.total; d += s.step(2)) pts.push(track.at(d).p);
    pts.push(track.at(track.total).p);
    if (pts.length > 1) s.ribbon(pts, 0.8, 0.5);
  }
}

function drawRibs(s: Sheet, sp: Species, verts: Vert[]) {
  for (const v of verts) {
    if (v.region !== 1) continue;
    const R = table(sp.rib, v.p[0]);
    if (R * s.k < 3) continue;
    const head = add(v.p, mul(v.n, v.hc * 0.35));
    const pts: P[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      // Down (the world's down, a little along the spine's own), bowed forward, swept back at the foot.
      const down = unit(add(mul(v.n, -0.5), [0, -1]));
      pts.push(add(head, add(mul(down, R * t), mul(v.t, R * (sp.sweep * t * t - 0.08 * Math.sin(Math.PI * t))))));
    }
    s.ribbon(pts, Math.min(1.4, Math.max(0.8, R * s.k * 0.03)), 0.55);
  }
}

function drawBelly(s: Sheet, sp: Species) {
  if (!sp.belly) return;
  const tr = new Track(spline(sp.belly, false, s.step()));
  const n = Math.max(6, Math.round((tr.total * s.k) / 3));
  for (let i = 0; i < n; i++) {
    const { p, t } = tr.at(((i + 0.5) / n) * tr.total);
    const up = perp(t);
    const L = Math.min(0.3 * tr.total, 5.5 / s.k);
    // A gastralium: a thin rod from the belly's midline up and back towards the ribs' ends.
    s.curve([p, add(p, add(mul(up, L * 0.45), mul(t, -L * 0.4))), add(p, add(mul(up, L * 0.8), mul(t, -L * 0.7)))], false, W.fine);
  }
}

function drawLeg(s: Sheet, leg: Leg, w: number) {
  const j = leg.joints;
  for (let i = 0; i < j.length - 1; i++) {
    const [ra, rb] = leg.r[i];
    if (i === j.length - 2 && (leg.fan ?? 1) > 1 && ra * s.k > 1.6) {
      // Metapodials: a fan of long bones, the far ones peeping behind.
      const f = leg.fan!;
      for (let m = f - 1; m >= 0; m--) {
        const off = (m - (f - 1) / 2) * ra * 0.9;
        const nrm = perp(unit(sub(j[i + 1], j[i])));
        s.bone(add(j[i], mul(nrm, off * 0.6)), add(j[i + 1], mul(nrm, off)), ra * (m === 0 ? 1 : 0.8), rb * (m === 0 ? 1 : 0.8), { w, bow: 0 });
      }
    } else s.bone(j[i], j[i + 1], ra, rb, { w, bow: leg.bow?.[i] ?? 0 });
  }
  const ball = j[j.length - 1];
  for (const toe of leg.toes) {
    let p = ball;
    for (let q = 0; q < toe.l.length; q++) {
      const e = add(p, mul(dir(toe.a[q]), toe.l[q]));
      const r = toe.r * (1 - q * 0.12);
      s.bone(p, e, r, r * 0.85, { w, shaft: 0.7 });
      p = e;
    }
    if (toe.claw > 0) {
      const a = toe.a[toe.a.length - 1];
      const base = add(p, mul(dir(a), 0.5 / s.k));
      s.cone(base, add(base, mul(dir(a + (toe.clawBend ?? 25)), toe.claw)), toe.r * 1.7, 0.18, w);
    }
  }
}

function farLeg(leg: Leg, far?: Partial<Leg> & { dx?: number }): Leg | null {
  if (!far) return null;
  const dx = far.dx ?? 0;
  return {
    joints: far.joints ?? leg.joints.map(([x, y]) => [x + dx, y] as P),
    r: far.r ?? leg.r,
    bow: far.bow ?? leg.bow,
    toes: far.toes ?? leg.toes,
    fan: far.fan ?? leg.fan,
  };
}

function drawSkull(s: Sheet, sk: Skull, condyle: P, far: boolean) {
  const c = rot([1, 0], -sk.deg), n = perp(c);
  const snout = sub(condyle, add(mul(c, sk.condyle[0] * sk.L), mul(n, sk.condyle[1] * sk.L)));
  const map = (p: P): P => add(snout, add(mul(c, p[0] * sk.L), mul(n, p[1] * sk.L)));
  const jawMap = (p: P): P => map(add(sk.joint, rot(sub(p, sk.joint), sk.open)));
  if (far) {
    for (const [b, t, wb, bend] of sk.farHorns ?? []) s.cone(map(b), map(t), wb * sk.L, bend, W.far);
    return;
  }
  const teeth = (rows: [P, P, number, number][] | undefined, m: (p: P) => P, down: number) => {
    for (const [a, b, cnt, tl] of rows ?? []) {
      for (let i = 0; i < cnt; i++) {
        const t = (i + 0.5) / cnt;
        const base = lerp(a, b, t);
        const wd = (len(sub(b, a)) / cnt) * 0.7;
        const l = tl * (0.75 + 0.25 * Math.sin(Math.PI * t) + 0.1 * Math.sin(i * 2.3));
        const pts = conePts([base[0] + wd / 2, base[1]], [base[0] - wd * 0.15, base[1] + down * l], wd, 0, 3).map(m);
        s.poly(pts, true, 0.3, "ink");
      }
    }
  };
  // Lower teeth behind the jaw's edge, the jaw, upper teeth, the skull over all.
  teeth(sk.jawTeeth, jawMap, 1);
  s.solid(sk.jaw.map(jawMap), W.skull);
  for (const h of sk.jawHoles ?? []) s.curve(h.map(jawMap), true, W.fine);
  teeth(sk.teeth, map, -1);
  let out = spline(sk.outline, true, s.step() / sk.L);
  if (sk.scallop) {
    // The frill's edge: little bony bumps (epoccipitals) along a stretch of the outline.
    const { from, to, count, amp } = sk.scallop;
    const src = sk.outline;
    const i0 = out.findIndex((p) => len(sub(p, src[from])) < 1e-9), i1 = out.findIndex((p) => len(sub(p, src[to])) < 1e-9);
    out = out.map((p, i) => {
      if (i <= i0 || i >= i1) return p;
      const f = (i - i0) / (i1 - i0);
      const tg = unit(sub(out[i + 1], out[i - 1]));
      return add(p, mul(perp(tg), -amp * Math.abs(Math.sin(Math.PI * f * count))));
    });
  }
  s.poly(out.map(map), true, W.skull, "ground");
  for (const h of sk.holes) s.curve(h.map(map), true, W.fine);
  for (const l of sk.lines ?? []) s.curve(l.map(map), false, W.fine);
  for (const [b, t, wb, bend] of sk.horns ?? []) s.cone(map(b), map(t), wb * sk.L, bend, W.skull);
}

/** The whole skeleton on a sheet at scale k. */
function build(sp: Species, k: number): Sheet {
  const s = new Sheet(k);
  const track = new Track(spline(sp.spine, false, 0.02));
  const verts = placeVerts(sp, track);
  const built: Built = { track, verts, top: spineTop };
  const fh = farLeg(sp.hind, sp.farHind), ff = farLeg(sp.fore, sp.farFore);
  drawSkull(s, sp.skull, sp.spine[0], true);
  if (ff) drawLeg(s, ff, W.far);
  if (fh) drawLeg(s, fh, W.far);
  sp.back?.(s, built);
  drawRibs(s, sp, verts);
  drawBelly(s, sp);
  drawSpine(s, sp, verts, track);
  s.solid(sp.ilium, W.bone);
  {
    // The rim over the hip socket.
    const A = sp.hind.joints[0], r = sp.hind.r[0][0] * 1.45;
    const arc: P[] = [];
    for (let i = 0; i <= 8; i++) arc.push(add(A, mul(dir(15 + i * 18.75), r)));
    s.curve(arc, false, W.fine);
  }
  for (const x of sp.pelvisExtra ?? []) s.solid(x, W.bone);
  for (const [a, b, ra, rb] of sp.ischium) s.bone(a, b, ra, rb, { shaft: 0.7 });
  for (const [a, b, ra, rb] of sp.pubis) s.bone(a, b, ra, rb, { shaft: 0.7 });
  s.solid(sp.coracoid, W.bone);
  s.solid(sp.scapula, W.bone);
  drawLeg(s, sp.hind, W.bone);
  drawLeg(s, sp.fore, W.bone);
  sp.front?.(s, built);
  drawSkull(s, sp.skull, sp.spine[0], false);
  return s;
}

// ---------------------------------------------------------------- the eight

const scaled = (A: P, kx: number, ky: number, pts: P[]): P[] => pts.map(([x, y]) => [A[0] + x * kx, A[1] + y * ky] as P);

/** A theropod's ilium about its hip socket, scaled from a Tyrannosaurus' (about 2 m long). */
const theropodIlium = (A: P, k: number) =>
  scaled(A, k, k, [[-0.78, 0.15], [-0.88, 0.37], [-0.72, 0.6], [-0.1, 0.72], [0.5, 0.71], [0.95, 0.6], [1.12, 0.41], [0.85, 0.29], [0.4, 0.17], [0.3, -0.02], [0.3, -0.02], [0.15, 0.15], [-0.05, 0.19], [-0.22, 0.13], [-0.3, -0.01], [-0.3, -0.01], [-0.45, 0.13], [-0.62, 0.19]]);

/** An ornithischian's ilium (an Iguanodon's, about 2 m long): a slender process forward, a low blade, the socket between two peduncles. */
const ornithIlium = (A: P, kx: number, ky: number) =>
  scaled(A, kx, ky, [[-1.0, 0.24], [-1.0, 0.24], [-0.75, 0.31], [-0.35, 0.45], [0.2, 0.52], [0.65, 0.46], [0.95, 0.3], [0.97, 0.21], [0.8, 0.12], [0.4, 0.1], [0.22, -0.07], [0.22, -0.07], [0.1, 0.12], [0.0, 0.16], [-0.1, 0.12], [-0.2, -0.05], [-0.2, -0.05], [-0.35, 0.1], [-0.7, 0.15], [-0.95, 0.17]]);

/**
 * A theropod's pubis: a long blade from its peduncle under the hip down and
 * forward to the boot, `w` wide, the boot `boot` long (reaching `fore` of
 * it ahead of the shaft) and `deep` deep.
 */
function pubisPts(top: P, foot: P, w: number, boot: number, fore: number, deep: number): P[] {
  const u = unit(sub(foot, top)), n = perp(u);
  const at = (t: number, b: number): P => add(lerp(top, foot, t), mul(n, b));
  const f0: P = [foot[0] - boot * fore, foot[1] - deep * 0.35], f1: P = [foot[0] + boot * (1 - fore), foot[1] - deep * 0.1];
  return [at(0, w * 0.6), at(0.35, w * 0.42), at(0.8, w * 0.38), [foot[0] - boot * fore * 0.4, foot[1] + deep * 0.3], f0, f0, [foot[0] - boot * fore * 0.2, foot[1] - deep * 0.7], [foot[0] + boot * 0.3, foot[1] - deep * 0.75], f1, [foot[0] + w * 0.25, foot[1] + deep * 0.4], at(0.7, -w * 0.3), at(0.3, -w * 0.4), at(0, -w * 0.55)];
}

/** A theropod's ischium: a blade from its peduncle down and back, the obturator flange on its front edge, a small foot at the end. */
function ischiumPts(top: P, end: P, w: number): P[] {
  const u = unit(sub(end, top)), n = perp(u);
  const at = (t: number, b: number): P => add(lerp(top, end, t), mul(n, b));
  return [at(0, w * 0.5), at(0.3, w * 0.35), at(0.85, w * 0.22), at(1, w * 0.3), at(1.02, -w * 0.1), at(0.92, -w * 0.3), at(0.55, -w * 0.35), at(0.42, -w * 0.62), at(0.42, -w * 0.62), at(0.3, -w * 0.4), at(0, -w * 0.5)];
}

/**
 * A shoulder blade from its socket `g` to its top end: the acromion flaring
 * forward by the socket, a narrow neck `N` wide, the blade widening to `B`.
 */
function scapulaPts(g: P, top: P, N: number, B: number): P[] {
  const u = unit(sub(top, g)), n = perp(u), L = len(sub(top, g));
  const at = (a: number, b: number): P => add(g, add(mul(u, a * L), mul(n, b)));
  return [at(0, -0.55 * N), at(0.0, 0.55 * N), at(0.1, 1.05 * N), at(0.28, 0.5 * N), at(0.62, 0.5 * N + 0.25 * (B - N)), at(0.94, 0.55 * B), at(1.0, 0.3 * B), at(1.0, -0.3 * B), at(0.93, -0.5 * B), at(0.55, -0.5 * N - 0.15 * (B - N)), at(0.25, -0.5 * N), at(0.08, -0.7 * N)];
}

/**
 * An ilium in side view about the hip socket A: a blade reaching `f` forward
 * and `b` back, `h` high, the socket (radius r) arched into its lower edge
 * between the two peduncles, the pubic and the ischial.
 */
function iliumPts(A: P, f: number, b: number, h: number, r: number, preLow = 0.22, pedK = 0.7): P[] {
  const [x, y] = A;
  const ped = r * pedK;
  const pub: P = [x - r * 0.95, y - ped], isc: P = [x + r * 0.95, y - ped];
  return [
    [x - f * 0.88, y + h * preLow],
    [x - f, y + h * (preLow + 0.28)],
    [x - f, y + h * (preLow + 0.28)],
    [x - f * 0.8, y + h * 0.86],
    [x - f * 0.3, y + h],
    [x + b * 0.35, y + h * 0.98],
    [x + b * 0.82, y + h * 0.8],
    [x + b, y + h * 0.45],
    [x + b * 0.7, y + h * 0.22],
    [x + r * 1.5, y + h * 0.12],
    isc,
    isc,
    [x + r * 0.55, y + r * 0.85],
    [x, y + r * 1.05],
    [x - r * 0.55, y + r * 0.85],
    pub,
    pub,
    [x - r * 1.5, y + h * 0.14],
    [x - f * 0.5, y + h * 0.2],
  ];
}

const theropodToes = (r: number, l: number, claw: number): Leg["toes"] => [
  { a: [200, 185, 180], l: [l * 0.42, l * 0.33, l * 0.25], r, claw, clawBend: 30 },
  { a: [192, 176], l: [l * 0.38, l * 0.3], r: r * 0.85, claw: claw * 0.85, clawBend: 30 },
];

const SPECIES: Record<Dinosaur, Species> = {
  tyrannosaurus: {
    spine: [[1.4, 3.3], [1.72, 3.05], [2.1, 2.98], [2.5, 3.18], [3.5, 3.45], [4.6, 3.55], [5.6, 3.55], [6.6, 3.45], [7.6, 3.2], [9.0, 2.72], [10.6, 2.18], [12.4, 1.72]],
    ends: [2.45, 5.5, 6.55],
    counts: [10, 13, 5, 38],
    hc: [[1.4, 0.2], [2.4, 0.22], [5.5, 0.23], [7, 0.22], [10, 0.1], [12.4, 0.04]],
    hs: [[1.4, 0.12], [2.4, 0.18], [3, 0.4], [5.5, 0.48], [6.6, 0.42], [8, 0.25], [10, 0.05], [11, 0]],
    lean: [[1.4, -20], [2.5, -5], [4, 5], [6, 15], [7, 35], [10, 50]],
    chev: [[6.6, 0], [6.8, 0.5], [8.5, 0.3], [10.5, 0.06], [11, 0]],
    rib: [[2.5, 1.0], [3.4, 1.72], [4.4, 1.68], [5.4, 0.6]],
    sweep: 0.3,
    belly: [[4.75, 1.72], [4.2, 1.8], [3.7, 1.93], [3.2, 2.2]],
    hind: {
      joints: [[6.0, 2.95], [5.62, 1.72], [6.1, 0.66], [5.84, 0.13]],
      r: [[0.22, 0.18], [0.16, 0.13], [0.11, 0.09]],
      bow: [-0.05, 0.02, 0],
      fan: 2,
      toes: theropodToes(0.07, 0.72, 0.2),
    },
    fore: {
      // The famous arms: a stout humerus, a short forearm, two clawed fingers, held forward of the chest.
      joints: [[2.9, 2.4], [2.62, 1.98], [2.36, 1.88], [2.24, 1.84]],
      r: [[0.085, 0.07], [0.065, 0.058], [0.048, 0.044]],
      toes: [
        { a: [196, 216], l: [0.15, 0.11], r: 0.046, claw: 0.15, clawBend: 30 },
        { a: [226, 246], l: [0.13, 0.1], r: 0.042, claw: 0.13, clawBend: 30 },
      ],
    },
    farHind: { joints: [[6.0, 2.95], [5.95, 1.74], [6.55, 0.74], [6.4, 0.13]] },
    farFore: { joints: [[2.95, 2.42], [2.8, 2.0], [2.56, 1.9], [2.45, 1.86]], toes: [{ a: [212, 232], l: [0.13, 0.09], r: 0.04, claw: 0.12, clawBend: 30 }] },
    scapula: scapulaPts([2.93, 2.42], [3.78, 3.3], 0.1, 0.2),
    coracoid: [[2.78, 2.22], [2.98, 2.3], [3.02, 2.48], [2.85, 2.55], [2.7, 2.4]],
    ilium: theropodIlium([6.0, 2.95], 1),
    pubis: [],
    ischium: [],
    pelvisExtra: [pubisPts([5.72, 2.96], [5.08, 1.66], 0.15, 0.95, 0.38, 0.22), ischiumPts([6.28, 2.96], [6.88, 1.98], 0.2)],
    skull: {
      L: 1.55,
      deg: 5,
      condyle: [0.96, 0.27],
      outline: [[0.0, 0.08], [0.02, 0.2], [0.1, 0.3], [0.32, 0.37], [0.55, 0.43], [0.7, 0.5], [0.8, 0.56], [0.9, 0.58], [0.98, 0.53], [1.01, 0.42], [0.98, 0.28], [0.99, 0.08], [0.95, -0.03], [0.87, 0.02], [0.78, 0.07], [0.68, 0.03], [0.5, 0.0], [0.3, -0.01], [0.12, 0.01]],
      jaw: [[0.03, -0.01], [0.3, -0.04], [0.6, -0.02], [0.82, 0.02], [0.97, -0.02], [1.0, -0.1], [0.9, -0.2], [0.7, -0.22], [0.42, -0.16], [0.15, -0.11], [0.03, -0.07]],
      joint: [0.96, -0.04],
      open: 7,
      holes: [
        ell(0.075, 0.22, 0.035, 0.045, -30, 10),
        [[0.36, 0.18], [0.5, 0.31], [0.64, 0.36], [0.68, 0.24], [0.66, 0.12], [0.52, 0.08]],
        ell(0.29, 0.2, 0.028, 0.035, 0, 10),
        [[0.77, 0.36], [0.8, 0.47], [0.845, 0.44], [0.815, 0.34], [0.8, 0.22]],
        [[0.86, 0.1], [0.865, 0.34], [0.92, 0.45], [0.95, 0.26], [0.92, 0.1]],
      ],
      jawHoles: [ell(0.76, -0.1, 0.07, 0.03, 5, 12)],
      teeth: [[[0.04, 0.0], [0.62, 0.02], 11, 0.075]],
      jawTeeth: [[[0.06, -0.03], [0.58, -0.02], 10, 0.05]],
    },
  },

  allosaurus: {
    spine: [[0.95, 2.42], [1.2, 2.22], [1.55, 2.13], [1.9, 2.28], [2.6, 2.48], [3.4, 2.53], [4.1, 2.5], [4.8, 2.4], [5.6, 2.15], [6.8, 1.72], [8.1, 1.3], [9.1, 1.05]],
    ends: [1.9, 4.0, 4.78],
    counts: [9, 14, 5, 44],
    hc: [[0.95, 0.1], [1.9, 0.13], [4, 0.14], [5, 0.13], [7, 0.06], [9.1, 0.025]],
    hs: [[0.95, 0.06], [1.9, 0.12], [2.3, 0.26], [4, 0.3], [4.8, 0.28], [6, 0.15], [7.5, 0.02], [8, 0]],
    lean: [[0.95, -20], [2, -5], [3, 5], [4.5, 15], [5.2, 35], [7, 50]],
    chev: [[4.8, 0], [5.0, 0.32], [6.5, 0.18], [8, 0.03], [8.3, 0]],
    rib: [[1.95, 0.6], [2.6, 1.0], [3.2, 0.95], [3.9, 0.35]],
    sweep: 0.3,
    belly: [[3.65, 1.08], [3.2, 1.2], [2.8, 1.35], [2.35, 1.55]],
    hind: {
      joints: [[4.35, 2.05], [4.0, 1.25], [4.4, 0.5], [4.2, 0.09]],
      r: [[0.12, 0.1], [0.09, 0.075], [0.065, 0.055]],
      bow: [-0.04, 0.02, 0],
      fan: 2,
      toes: theropodToes(0.04, 0.45, 0.13),
    },
    fore: {
      joints: [[2.05, 1.6], [2.18, 1.25], [2.02, 1.0], [1.92, 0.92]],
      r: [[0.05, 0.045], [0.035, 0.03], [0.025, 0.022]],
      toes: [
        { a: [230, 255], l: [0.1, 0.07], r: 0.02, claw: 0.14, clawBend: 35 },
        { a: [215, 240], l: [0.12, 0.08], r: 0.018, claw: 0.12, clawBend: 35 },
      ],
    },
    farHind: { joints: [[4.35, 2.05], [4.3, 1.27], [4.75, 0.58], [4.62, 0.09]] },
    farFore: { joints: [[2.05, 1.6], [2.26, 1.3], [2.2, 1.04], [2.13, 0.95]] },
    scapula: scapulaPts([2.02, 1.58], [2.74, 2.35], 0.07, 0.14),
    coracoid: [[1.9, 1.45], [2.06, 1.5], [2.1, 1.65], [1.97, 1.72], [1.84, 1.6]],
    ilium: theropodIlium([4.35, 2.05], 0.72),
    pubis: [],
    ischium: [],
    pelvisExtra: [pubisPts([4.27, 2.07], [3.86, 1.04], 0.1, 0.52, 0.34, 0.13), ischiumPts([4.55, 2.04], [4.98, 1.26], 0.13)],
    skull: {
      L: 0.85,
      deg: 4,
      condyle: [0.96, 0.27],
      outline: [[0.0, 0.07], [0.02, 0.17], [0.1, 0.24], [0.38, 0.29], [0.58, 0.33], [0.63, 0.42], [0.67, 0.49], [0.67, 0.49], [0.72, 0.38], [0.85, 0.39], [0.96, 0.36], [1.01, 0.28], [0.98, 0.1], [0.96, -0.01], [0.86, 0.03], [0.74, 0.05], [0.6, 0.02], [0.4, 0.0], [0.12, 0.01]],
      jaw: [[0.03, -0.01], [0.35, -0.03], [0.7, 0.0], [0.97, -0.01], [1.0, -0.08], [0.9, -0.15], [0.7, -0.16], [0.4, -0.11], [0.12, -0.08], [0.03, -0.05]],
      joint: [0.96, -0.03],
      open: 9,
      holes: [
        ell(0.07, 0.17, 0.035, 0.03, -20, 10),
        [[0.3, 0.15], [0.45, 0.26], [0.62, 0.28], [0.64, 0.18], [0.6, 0.08], [0.45, 0.07]],
        ell(0.24, 0.16, 0.02, 0.025, 0, 8),
        [[0.72, 0.3], [0.75, 0.36], [0.79, 0.33], [0.765, 0.22], [0.74, 0.16]],
        [[0.83, 0.08], [0.84, 0.28], [0.9, 0.33], [0.94, 0.2], [0.9, 0.08]],
      ],
      jawHoles: [ell(0.76, -0.07, 0.07, 0.025, 3, 12)],
      teeth: [[[0.04, 0.0], [0.64, 0.02], 13, 0.06]],
      jawTeeth: [[[0.06, -0.02], [0.6, -0.01], 12, 0.045]],
    },
  },

  iguanodon: {
    spine: [[1.05, 2.55], [1.3, 2.42], [1.65, 2.35], [2.05, 2.45], [3.0, 2.68], [4.1, 2.78], [4.8, 2.76], [5.6, 2.6], [6.7, 2.2], [8.2, 1.62], [9.9, 1.05]],
    ends: [2.05, 4.65, 5.4],
    counts: [10, 17, 6, 42],
    hc: [[1.05, 0.12], [2.05, 0.15], [4.6, 0.17], [5.5, 0.16], [7.5, 0.09], [9.9, 0.03]],
    hs: [[1.05, 0.08], [2.05, 0.14], [2.5, 0.3], [4.6, 0.38], [5.5, 0.42], [6.5, 0.3], [8.5, 0.08], [9.2, 0]],
    lean: [[1.05, -15], [2.2, 0], [4, 8], [5.4, 20], [6.5, 35], [9, 50]],
    chev: [[5.4, 0], [5.6, 0.42], [7.5, 0.25], [9, 0.05], [9.3, 0]],
    rib: [[2.1, 0.7], [2.9, 1.2], [3.8, 1.15], [4.6, 0.5]],
    sweep: 0.28,
    hind: {
      joints: [[5.0, 2.2], [4.72, 1.14], [5.05, 0.36], [4.88, 0.07]],
      r: [[0.15, 0.12], [0.11, 0.09], [0.08, 0.07]],
      bow: [-0.05, 0.02, 0],
      fan: 2,
      toes: [
        { a: [196, 182, 180], l: [0.13, 0.1, 0.07], r: 0.05, claw: 0.1, clawBend: 10 },
        { a: [188, 178], l: [0.12, 0.09], r: 0.045, claw: 0.09, clawBend: 10 },
      ],
    },
    fore: {
      joints: [[2.6, 1.85], [2.78, 1.1], [2.6, 0.38], [2.5, 0.05]],
      r: [[0.1, 0.08], [0.07, 0.06], [0.05, 0.045]],
      bow: [0.04, -0.02, 0],
      fan: 2,
      toes: [
        { a: [215, 200], l: [0.12, 0.08], r: 0.03, claw: 0.06, clawBend: 5 },
        { a: [200, 188], l: [0.11, 0.07], r: 0.028, claw: 0.05, clawBend: 5 },
      ],
    },
    farHind: { joints: [[5.0, 2.2], [5.0, 1.15], [5.35, 0.4], [5.18, 0.07]] },
    farFore: { joints: [[2.6, 1.85], [2.95, 1.12], [2.9, 0.4], [2.82, 0.05]] },
    scapula: scapulaPts([2.56, 1.86], [3.42, 2.66], 0.09, 0.24),
    coracoid: [[2.45, 1.7], [2.62, 1.74], [2.68, 1.92], [2.52, 2.0], [2.38, 1.86]],
    ilium: ornithIlium([5.0, 2.2], 1, 1),
    pubis: [[[4.9, 2.25], [5.9, 1.3], 0.05, 0.03]],
    ischium: [[[5.2, 2.2], [6.1, 1.05], 0.08, 0.06]],
    pelvisExtra: [[[4.88, 2.18], [4.55, 2.06], [4.25, 1.98], [4.12, 1.9], [4.2, 1.8], [4.5, 1.84], [4.82, 2.02]]],
    skull: {
      L: 0.8,
      deg: 28,
      condyle: [0.95, 0.24],
      outline: [[0.0, 0.03], [0.02, 0.12], [0.12, 0.2], [0.35, 0.29], [0.6, 0.36], [0.8, 0.4], [0.95, 0.38], [1.01, 0.28], [0.98, 0.08], [0.9, -0.02], [0.72, 0.01], [0.4, 0.03], [0.18, 0.02], [0.06, -0.01]],
      jaw: [[0.04, -0.02], [0.2, -0.0], [0.5, 0.0], [0.72, 0.04], [0.8, 0.14], [0.86, 0.04], [0.95, -0.02], [0.9, -0.1], [0.6, -0.13], [0.3, -0.1], [0.06, -0.06]],
      joint: [0.93, -0.02],
      open: 4,
      holes: [
        [[0.08, 0.12], [0.2, 0.22], [0.32, 0.24], [0.28, 0.16], [0.14, 0.1]],
        ell(0.5, 0.2, 0.04, 0.025, -10, 10),
        ell(0.72, 0.27, 0.065, 0.07, 0, 14),
        [[0.84, 0.08], [0.85, 0.25], [0.9, 0.3], [0.94, 0.18], [0.9, 0.06]],
      ],
      jawHoles: [],
      teeth: [[[0.36, 0.02], [0.7, 0.02], 9, 0.035]],
      jawTeeth: [[[0.36, 0.0], [0.68, 0.02], 8, 0.03]],
    },
    front: (s) => {
      // The thumb spike, pointing up and forward from the wrist.
      s.cone([2.6, 0.32], [2.38, 0.56], 0.1, 0.1);
    },
    back: (s, b) => {
      // Ossified tendons: a lattice along the neural spines of the back, hips and tail.
      const vs = b.verts.filter((v) => v.p[0] > 3.2 && v.p[0] < 8.4 && v.hs > 0.1);
      for (let i = 0; i + 4 < vs.length; i += 2) {
        const at = (v: Vert, f: number) => add(v.p, mul(v.n, v.hc / 2 + v.hs * f));
        s.line(at(vs[i], 0.8), at(vs[i + 4], 0.35), W.fine);
        s.line(at(vs[i], 0.35), at(vs[i + 4], 0.8), W.fine);
      }
    },
  },

  stegosaurus: {
    spine: [[0.8, 1.2], [1.05, 1.28], [1.5, 1.48], [2.0, 1.75], [3.0, 2.35], [4.0, 2.78], [4.8, 2.88], [5.5, 2.74], [6.4, 2.3], [7.5, 1.72], [8.6, 1.25], [9.2, 1.08]],
    ends: [1.95, 4.5, 5.2],
    counts: [10, 17, 5, 44],
    hc: [[0.8, 0.09], [1.95, 0.13], [4.5, 0.16], [5.5, 0.15], [7.5, 0.08], [9.2, 0.04]],
    hs: [[0.8, 0.05], [1.95, 0.12], [2.6, 0.4], [4.5, 0.55], [5.2, 0.5], [6, 0.4], [8, 0.1], [9, 0.03]],
    lean: [[0.8, -10], [2, 0], [4.5, 0], [5.3, 10], [6, 20], [8, 30]],
    chev: [[5.2, 0], [5.4, 0.35], [7.2, 0.25], [9, 0.06]],
    rib: [[2.0, 0.6], [2.8, 1.25], [3.8, 1.3], [4.5, 0.6]],
    sweep: 0.18,
    hind: {
      joints: [[4.85, 2.2], [4.72, 1.12], [4.84, 0.38], [4.78, 0.08]],
      r: [[0.15, 0.13], [0.1, 0.09], [0.07, 0.065]],
      bow: [0, 0.01, 0],
      fan: 2,
      toes: [
        { a: [200, 185], l: [0.08, 0.06], r: 0.04, claw: 0.08, clawBend: 5 },
        { a: [192, 180], l: [0.07, 0.05], r: 0.035, claw: 0.07, clawBend: 5 },
      ],
    },
    fore: {
      joints: [[2.2, 1.35], [2.3, 0.82], [2.2, 0.36], [2.17, 0.06]],
      r: [[0.1, 0.09], [0.07, 0.06], [0.05, 0.045]],
      bow: [0.03, -0.02, 0],
      fan: 2,
      toes: [{ a: [200, 185], l: [0.06, 0.05], r: 0.035, claw: 0.05, clawBend: 5 }],
    },
    farHind: { joints: [[4.85, 2.2], [4.95, 1.13], [5.12, 0.4], [5.07, 0.08]] },
    farFore: { joints: [[2.2, 1.35], [2.45, 0.85], [2.46, 0.38], [2.44, 0.06]] },
    scapula: scapulaPts([2.12, 1.35], [2.92, 2.13], 0.1, 0.3),
    coracoid: [[1.98, 1.2], [2.2, 1.22], [2.26, 1.42], [2.08, 1.52], [1.92, 1.38]],
    ilium: ornithIlium([4.85, 2.2], 0.85, 1.05),
    pubis: [[[4.75, 2.25], [5.55, 1.55], 0.04, 0.03]],
    ischium: [[[5.0, 2.22], [5.6, 1.55], 0.07, 0.05]],
    pelvisExtra: [[[4.75, 2.25], [4.45, 2.15], [4.2, 2.1], [4.25, 1.98], [4.55, 2.0], [4.8, 2.1]]],
    skull: {
      L: 0.45,
      deg: 12,
      condyle: [0.95, 0.2],
      outline: [[0.0, 0.05], [0.04, 0.14], [0.25, 0.23], [0.55, 0.3], [0.8, 0.32], [0.97, 0.27], [1.0, 0.12], [0.95, 0.02], [0.8, -0.0], [0.45, 0.0], [0.15, 0.0]],
      jaw: [[0.04, -0.0], [0.4, -0.02], [0.75, -0.0], [0.93, -0.02], [0.9, -0.09], [0.6, -0.1], [0.3, -0.08], [0.06, -0.05]],
      joint: [0.92, -0.02],
      open: 3,
      holes: [ell(0.1, 0.13, 0.05, 0.035, -15, 10), ell(0.45, 0.15, 0.04, 0.025, 0, 10), ell(0.73, 0.2, 0.07, 0.065, 0, 14)],
      teeth: [[[0.25, 0.0], [0.65, 0.0], 7, 0.035]],
    },
    back: (s, b) => stegoPlates(s, b, 1),
    front: (s, b) => {
      stegoPlates(s, b, 0);
      // The thagomizer: two pairs of spikes near the tail's end.
      const at = (x: number) => b.track.at(b.track.atX(x));
      for (const [x, ang, L, far] of [[8.3, 40, 0.7, 1], [8.75, 20, 0.62, 1], [8.25, 55, 0.75, 0], [8.7, 30, 0.68, 0]] as const) {
        const { p, t } = at(x);
        const base = add(p, mul(perp(t), 0.06));
        const d = rot(t, ang);
        if (far) s.cone(base, add(base, mul(d, L)), 0.11, 0.08, W.far);
        else s.cone(base, add(base, mul(d, L)), 0.13, 0.08, W.bone);
      }
    },
  },

  triceratops: {
    spine: [[2.2, 1.55], [2.45, 1.62], [2.8, 1.85], [3.6, 2.25], [4.6, 2.5], [5.5, 2.48], [6.2, 2.35], [7.0, 1.92], [8.0, 1.35], [8.9, 0.95]],
    ends: [2.75, 5.25, 6.3],
    counts: [8, 12, 10, 38],
    hc: [[2.2, 0.16], [2.75, 0.18], [5.2, 0.2], [6.3, 0.17], [7.5, 0.1], [8.9, 0.04]],
    hs: [[2.2, 0.1], [2.75, 0.2], [3.3, 0.32], [5.2, 0.35], [6.3, 0.3], [7.2, 0.2], [8.5, 0.03]],
    lean: [[2.2, -5], [3, 0], [5, 5], [6.3, 15], [7, 30], [8.5, 45]],
    chev: [[6.3, 0], [6.5, 0.32], [7.8, 0.18], [8.7, 0.03]],
    rib: [[2.8, 0.8], [3.5, 1.35], [4.5, 1.35], [5.2, 0.7]],
    sweep: 0.15,
    hind: {
      joints: [[5.8, 1.92], [5.66, 0.95], [5.86, 0.3], [5.76, 0.07]],
      r: [[0.16, 0.13], [0.11, 0.1], [0.08, 0.07]],
      bow: [-0.03, 0.02, 0],
      fan: 2,
      toes: [
        { a: [200, 185], l: [0.1, 0.08], r: 0.05, claw: 0.08, clawBend: 5 },
        { a: [190, 180], l: [0.09, 0.07], r: 0.045, claw: 0.07, clawBend: 5 },
      ],
    },
    fore: {
      joints: [[3.35, 1.32], [3.55, 0.64], [3.42, 0.2], [3.33, 0.05]],
      r: [[0.13, 0.11], [0.09, 0.08], [0.06, 0.055]],
      bow: [0.04, -0.02, 0],
      fan: 2,
      toes: [{ a: [205, 188], l: [0.07, 0.06], r: 0.04, claw: 0.06, clawBend: 5 }],
    },
    farHind: { joints: [[5.8, 1.92], [5.92, 0.96], [6.15, 0.32], [6.07, 0.07]] },
    farFore: { joints: [[3.35, 1.32], [3.75, 0.7], [3.7, 0.22], [3.63, 0.05]] },
    scapula: scapulaPts([3.25, 1.35], [4.06, 2.15], 0.12, 0.32),
    coracoid: [[3.12, 1.2], [3.35, 1.22], [3.42, 1.42], [3.22, 1.52], [3.05, 1.36]],
    ilium: ornithIlium([5.8, 1.92], 0.98, 0.85),
    pubis: [[[5.7, 1.92], [5.3, 1.55], 0.08, 0.1]],
    ischium: [[[5.95, 1.9], [6.6, 0.95], 0.08, 0.06]],
    skull: {
      L: 2.25,
      deg: 6,
      condyle: [0.66, 0.24],
      outline: [[0.0, -0.03], [0.0, -0.03], [0.015, 0.08], [0.06, 0.17], [0.12, 0.23], [0.2, 0.27], [0.3, 0.31], [0.4, 0.37], [0.48, 0.43], [0.56, 0.5], [0.66, 0.63], [0.78, 0.76], [0.9, 0.85], [0.98, 0.85], [1.02, 0.77], [1.0, 0.65], [0.94, 0.55], [0.85, 0.45], [0.77, 0.35], [0.71, 0.25], [0.67, 0.14], [0.62, 0.05], [0.58, -0.06], [0.58, -0.06], [0.53, 0.03], [0.42, 0.05], [0.28, 0.07], [0.16, 0.07], [0.09, 0.05], [0.04, 0.02]],
      jaw: [[0.025, -0.035], [0.025, -0.035], [0.1, 0.03], [0.25, 0.05], [0.4, 0.06], [0.46, 0.16], [0.52, 0.12], [0.58, 0.0], [0.55, -0.05], [0.42, -0.075], [0.24, -0.065], [0.1, -0.045]],
      joint: [0.58, 0.0],
      open: 1,
      holes: [
        ell(0.105, 0.155, 0.055, 0.035, -25, 12),
        ell(0.5, 0.37, 0.035, 0.028, 0, 10),
        ell(0.32, 0.21, 0.03, 0.014, -15, 8),
        [[0.6, 0.2], [0.64, 0.36], [0.68, 0.33], [0.66, 0.2]],
      ],
      jawHoles: [],
      scallop: { from: 10, to: 17, count: 9, amp: 0.016 },
      lines: [[[0.58, 0.44], [0.72, 0.5], [0.86, 0.6], [0.95, 0.7]], [[0.03, 0.01], [0.07, 0.1], [0.13, 0.2]], [[0.47, 0.3], [0.54, 0.16], [0.57, -0.02]]],
      horns: [[[0.47, 0.41], [0.1, 0.66], 0.075, 0.07], [[0.15, 0.24], [0.12, 0.4], 0.08, 0.12]],
      farHorns: [[[0.5, 0.44], [0.16, 0.72], 0.065, 0.07]],
    },
  },

  brontosaurus: {
    spine: [[1.5, 7.6], [2.2, 7.7], [3.3, 7.3], [4.6, 6.5], [5.9, 5.5], [6.9, 4.62], [8.0, 4.45], [9.5, 4.62], [10.3, 4.6], [11.2, 4.42], [12.8, 3.8], [15.0, 2.85], [17.3, 1.95], [19.5, 1.3], [21.5, 0.95], [22.8, 0.8]],
    ends: [6.8, 10.0, 10.9],
    counts: [15, 10, 5, 52],
    hc: [[1.5, 0.24], [3, 0.42], [6.8, 0.52], [10, 0.45], [11, 0.42], [14, 0.25], [18, 0.1], [22.8, 0.03]],
    hs: [[1.5, 0.1], [4, 0.24], [6.8, 0.4], [7.5, 0.7], [10, 0.95], [10.9, 0.95], [12.5, 0.6], [15, 0.2], [17, 0]],
    lean: [[1.5, 10], [6.8, 5], [8, 0], [10, 5], [11.5, 20], [14, 40]],
    chev: [[10.9, 0], [11.3, 0.55], [14, 0.4], [17, 0.1], [18, 0]],
    rib: [[6.9, 1.4], [7.8, 2.3], [9, 2.2], [9.9, 1.2]],
    sweep: 0.18,
    cervRib: 1.3,
    hind: {
      joints: [[10.4, 3.62], [10.28, 1.78], [10.45, 0.6], [10.36, 0.2]],
      r: [[0.26, 0.22], [0.18, 0.16], [0.12, 0.11]],
      bow: [-0.02, 0.01, 0],
      fan: 3,
      toes: [
        { a: [205, 190], l: [0.18, 0.12], r: 0.07, claw: 0.25, clawBend: 15 },
        { a: [192, 182], l: [0.16, 0.1], r: 0.06, claw: 0.18, clawBend: 15 },
      ],
    },
    fore: {
      joints: [[7.05, 3.2], [7.12, 1.78], [7.0, 0.72], [6.96, 0.06]],
      r: [[0.23, 0.19], [0.15, 0.13], [0.1, 0.1]],
      bow: [0.02, -0.01, 0],
      fan: 3,
      toes: [{ a: [200, 170], l: [0.1, 0.08], r: 0.06, claw: 0.2, clawBend: -60 }],
    },
    farHind: { joints: [[10.4, 3.62], [10.55, 1.8], [10.85, 0.62], [10.78, 0.2]] },
    farFore: { joints: [[7.05, 3.2], [7.4, 1.8], [7.35, 0.74], [7.33, 0.06]] },
    scapula: scapulaPts([6.95, 3.25], [8.25, 4.48], 0.2, 0.5),
    coracoid: [[6.7, 2.95], [7.1, 2.98], [7.2, 3.3], [6.9, 3.5], [6.6, 3.28]],
    ilium: iliumPts([10.4, 3.62], 0.85, 0.95, 1.12, 0.26, 0.22, 1.25),
    pubis: [[[10.25, 3.65], [9.8, 2.7], 0.2, 0.16]],
    ischium: [[[10.62, 3.6], [11.75, 2.95], 0.15, 0.1]],
    skull: {
      L: 0.62,
      deg: 30,
      condyle: [0.94, 0.22],
      outline: [[0.0, 0.05], [0.02, 0.16], [0.25, 0.22], [0.5, 0.3], [0.62, 0.42], [0.75, 0.47], [0.9, 0.43], [1.0, 0.32], [0.98, 0.1], [0.9, 0.0], [0.6, 0.02], [0.3, 0.01], [0.1, 0.0]],
      jaw: [[0.03, -0.0], [0.3, -0.01], [0.6, 0.01], [0.88, -0.01], [0.86, -0.08], [0.5, -0.07], [0.2, -0.07], [0.04, -0.05]],
      joint: [0.88, -0.02],
      open: 3,
      holes: [ell(0.66, 0.38, 0.07, 0.035, 30, 10), ell(0.46, 0.18, 0.08, 0.04, 5, 12), ell(0.8, 0.29, 0.065, 0.075, 0, 14), [[0.88, 0.08], [0.89, 0.22], [0.94, 0.26], [0.96, 0.14], [0.93, 0.06]]],
      teeth: [[[0.02, 0.0], [0.28, 0.01], 7, 0.06]],
      jawTeeth: [[[0.03, -0.01], [0.26, -0.0], 6, 0.05]],
    },
  },

  diplodocus: {
    spine: [[1.0, 5.0], [1.8, 5.12], [3.0, 4.9], [4.4, 4.4], [5.8, 3.68], [6.8, 3.1], [7.4, 2.95], [8.6, 3.25], [10.0, 3.6], [10.9, 3.65], [11.8, 3.5], [13.6, 2.9], [16.2, 2.1], [19.0, 1.42], [22.0, 0.88], [25.4, 0.55]],
    ends: [7.2, 10.5, 11.4],
    counts: [15, 10, 5, 56],
    hc: [[1.0, 0.13], [3, 0.24], [7.2, 0.3], [10.5, 0.34], [11.4, 0.32], [14, 0.18], [18, 0.07], [25.4, 0.025]],
    hs: [[1.0, 0.08], [4, 0.14], [7.2, 0.26], [8, 0.55], [10.5, 0.75], [11.4, 0.78], [13, 0.45], [15.5, 0.1], [17, 0]],
    lean: [[1.0, 10], [7.2, 5], [8.5, 0], [10.5, 5], [12, 25], [14, 40]],
    chev: [[11.4, 0], [11.8, 0.4], [14, 0.3], [16.5, 0.08], [17.5, 0]],
    rib: [[7.4, 1.0], [8.4, 1.75], [9.6, 1.65], [10.4, 0.9]],
    sweep: 0.18,
    cervRib: 1.6,
    hind: {
      joints: [[11.0, 3.02], [10.9, 1.47], [11.02, 0.48], [10.95, 0.15]],
      r: [[0.2, 0.17], [0.14, 0.12], [0.09, 0.085]],
      bow: [-0.02, 0.01, 0],
      fan: 3,
      toes: [
        { a: [205, 190], l: [0.14, 0.1], r: 0.055, claw: 0.2, clawBend: 15 },
        { a: [192, 182], l: [0.12, 0.08], r: 0.05, claw: 0.15, clawBend: 15 },
      ],
    },
    fore: {
      joints: [[7.3, 2.15], [7.36, 1.2], [7.28, 0.55], [7.26, 0.04]],
      r: [[0.16, 0.13], [0.1, 0.09], [0.075, 0.07]],
      bow: [0.02, -0.01, 0],
      fan: 3,
      toes: [{ a: [200, 170], l: [0.08, 0.06], r: 0.045, claw: 0.15, clawBend: -60 }],
    },
    farHind: { joints: [[11.0, 3.02], [11.15, 1.48], [11.42, 0.5], [11.36, 0.15]] },
    farFore: { joints: [[7.3, 2.15], [7.6, 1.22], [7.58, 0.56], [7.56, 0.04]] },
    scapula: scapulaPts([7.22, 2.2], [8.27, 3.12], 0.14, 0.36),
    coracoid: [[7.02, 1.95], [7.35, 1.98], [7.42, 2.25], [7.18, 2.4], [6.95, 2.22]],
    ilium: iliumPts([11.0, 3.02], 0.75, 0.85, 0.92, 0.2, 0.22, 1.25),
    pubis: [[[10.88, 3.0], [10.5, 2.2], 0.14, 0.12]],
    ischium: [[[11.2, 2.96], [12.2, 2.45], 0.13, 0.1]],
    skull: {
      L: 0.6,
      deg: 18,
      condyle: [0.94, 0.22],
      outline: [[0.0, 0.05], [0.02, 0.14], [0.3, 0.2], [0.55, 0.28], [0.66, 0.4], [0.78, 0.45], [0.91, 0.42], [1.0, 0.31], [0.98, 0.1], [0.9, 0.0], [0.6, 0.02], [0.3, 0.01], [0.1, 0.0]],
      jaw: [[0.03, -0.0], [0.3, -0.01], [0.6, 0.01], [0.88, -0.01], [0.86, -0.07], [0.5, -0.06], [0.2, -0.06], [0.04, -0.05]],
      joint: [0.88, -0.02],
      open: 3,
      holes: [ell(0.69, 0.37, 0.07, 0.035, 35, 10), ell(0.5, 0.17, 0.09, 0.035, 5, 12), ell(0.81, 0.28, 0.06, 0.07, 0, 14), [[0.88, 0.08], [0.89, 0.22], [0.94, 0.26], [0.96, 0.14], [0.93, 0.06]]],
      teeth: [[[0.02, 0.0], [0.25, 0.01], 7, 0.07]],
      jawTeeth: [[[0.03, -0.01], [0.22, -0.0], 6, 0.05]],
    },
  },

  pteranodon: {
    // Standing on all fours on folded wings: the long fourth finger tucked up and back along the body, the membrane slack from its tip to the ankle.
    spine: [[0.55, 1.45], [0.62, 1.3], [0.72, 1.16], [0.82, 1.04], [0.95, 0.93], [1.15, 0.8], [1.3, 0.71], [1.42, 0.65], [1.5, 0.62], [1.56, 0.6]],
    ends: [0.84, 1.28, 1.42],
    counts: [7, 10, 6, 8],
    hc: [[0.55, 0.055], [0.84, 0.06], [1.28, 0.05], [1.42, 0.04], [1.6, 0.015]],
    hs: [[0.55, 0.012], [0.84, 0.02], [0.95, 0.05], [1.28, 0.05], [1.42, 0.035], [1.5, 0]],
    lean: [[0.55, 0], [1.2, 10]],
    chev: [[0, 0]],
    rib: [[0.88, 0.16], [1.02, 0.24], [1.26, 0.12]],
    sweep: 0.3,
    hind: {
      joints: [[1.36, 0.62], [1.47, 0.38], [1.35, 0.08], [1.3, 0.03]],
      r: [[0.022, 0.018], [0.017, 0.015], [0.011, 0.011]],
      toes: [
        { a: [195, 180], l: [0.045, 0.032], r: 0.008, claw: 0.028, clawBend: 20 },
        { a: [186, 176], l: [0.04, 0.028], r: 0.007, claw: 0.024, clawBend: 20 },
      ],
    },
    fore: {
      // Humerus back and down, forearm forward, the long wing metacarpal down to the hand on the ground.
      joints: [[0.88, 0.95], [1.12, 0.76], [0.84, 0.56], [0.6, 0.03]],
      r: [[0.034, 0.03], [0.026, 0.025], [0.02, 0.019]],
      toes: [
        { a: [192, 182], l: [0.04, 0.03], r: 0.008, claw: 0.028, clawBend: 25 },
        { a: [200, 186], l: [0.035, 0.028], r: 0.007, claw: 0.025, clawBend: 25 },
      ],
    },
    farHind: { joints: [[1.36, 0.62], [1.36, 0.37], [1.2, 0.08], [1.15, 0.03]] },
    farFore: {
      joints: [[0.9, 0.95], [1.2, 0.8], [1.0, 0.56], [0.82, 0.03]],
      toes: [{ a: [190, 180], l: [0.035, 0.028], r: 0.007, claw: 0.024, clawBend: 20 }],
    },
    scapula: scapulaPts([0.87, 0.95], [1.08, 0.93], 0.016, 0.026),
    coracoid: [[0.8, 0.86], [0.86, 0.88], [0.88, 0.94], [0.84, 0.95], [0.79, 0.91]],
    ilium: iliumPts([1.36, 0.62], 0.09, 0.1, 0.06, 0.022),
    pubis: [[[1.35, 0.6], [1.32, 0.5], 0.018, 0.018]],
    ischium: [[[1.4, 0.6], [1.46, 0.52], 0.018, 0.014]],
    skull: {
      L: 1.3,
      deg: 5,
      condyle: [0.64, 0.05],
      outline: [[0.0, 0.0], [0.0, 0.0], [0.2, 0.035], [0.42, 0.075], [0.54, 0.105], [0.6, 0.13], [0.72, 0.19], [0.86, 0.255], [1.0, 0.3], [1.0, 0.3], [0.99, 0.275], [0.86, 0.21], [0.74, 0.145], [0.68, 0.09], [0.67, 0.03], [0.64, -0.01], [0.55, -0.005], [0.35, -0.0], [0.15, -0.0]],
      jaw: [[0.015, -0.005], [0.015, -0.005], [0.3, -0.005], [0.6, -0.01], [0.65, -0.015], [0.64, -0.035], [0.5, -0.035], [0.25, -0.022], [0.05, -0.012]],
      joint: [0.64, -0.015],
      open: 2,
      holes: [ell(0.44, 0.04, 0.07, 0.016, 6, 12), ell(0.585, 0.065, 0.018, 0.028, 0, 12)],
    },
    back: (s) => {
      // The breastbone under the chest (the far wing's finger is hidden behind the body).
      s.solid([[0.84, 0.8], [0.84, 0.8], [0.92, 0.805], [0.99, 0.785], [0.96, 0.765], [0.89, 0.76], [0.84, 0.775]], W.bone);
    },
    front: (s) => {
      // The folded membrane: slack from the finger's tip down to the ankle, a fold along it.
      s.curve([[1.7, 1.03], [1.66, 0.74], [1.54, 0.42], [1.37, 0.1]], false, W.fine);
      s.curve([[1.56, 0.96], [1.53, 0.7], [1.44, 0.42]], false, 0.45);
      // The near wing's finger: four phalanges from the hand, up and back past the hips.
      const f: P[] = [[0.6, 0.05], [0.98, 0.58], [1.3, 0.9], [1.52, 1.01], [1.7, 1.04]];
      for (let i = 0; i < f.length - 1; i++) s.bone(f[i], f[i + 1], 0.021 - i * 0.004, 0.018 - i * 0.004, { shaft: 0.65 });
    },
  },
};

/** Stegosaurus' plates, alternating: the far row (1) first, the near (0) over the backbone. */
function stegoPlates(s: Sheet, b: Built, row: 0 | 1) {
  const plates: [number, number][] = [[1.4, 0.18], [1.8, 0.24], [2.25, 0.32], [2.7, 0.42], [3.15, 0.55], [3.6, 0.66], [4.05, 0.74], [4.5, 0.8], [4.95, 0.8], [5.4, 0.76], [5.85, 0.68], [6.3, 0.58], [6.75, 0.48], [7.2, 0.38], [7.6, 0.3], [7.95, 0.22]];
  plates.forEach(([x, h], i) => {
    if (i % 2 !== row) return;
    const xx = x + (row ? 0.2 : 0);
    const d = b.track.atX(xx);
    const { p, t } = b.track.at(d);
    const v = b.verts.reduce((a, c) => (Math.abs(c.p[0] - xx) < Math.abs(a.p[0] - xx) ? c : a));
    const n = perp(t);
    const base = add(p, mul(n, v.hc / 2 + v.hs * 0.8));
    const wdt = h * 0.95;
    const up = unit(add(mul(n, 1), mul(t, 0.2)));
    const at = (a: number, c: number): P => add(base, add(mul(t, a), mul(up, c)));
    // A plate: a broad base on the backbone, widest a third of the way up, a blunt point leaning back.
    const tip = at(wdt * 0.06, h);
    const pts: P[] = [at(-wdt * 0.36, -h * 0.04), at(-wdt * 0.5, h * 0.3), at(-wdt * 0.36, h * 0.7), tip, tip, at(wdt * 0.36, h * 0.66), at(wdt * 0.5, h * 0.28), at(wdt * 0.36, -h * 0.04)];
    s.solid(pts, row ? W.far : W.bone);
    // A plate's grain: a few fine lines from its base.
    if (!row && h * s.k > 12) for (const f of [-0.2, 0.05, 0.28]) s.line(at(wdt * f * 0.8, h * 0.12), at(wdt * f * 1.1, h * 0.55), 0.45);
  });
}

// ---------------------------------------------------------------- output

interface Drawn {
  prims: Prim[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function extent(prims: Prim[]): Drawn {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of prims) for (const [x, y] of p.pts) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  return { prims, x0, y0, x1, y1 };
}

/** Where a skeleton lands in a box (x, y, w, h): its scale and extent in print units, standing on the box's floor, centred across. */
export function dinosaurFit(id: Dinosaur, x: number, y: number, w: number, h: number) {
  const sp = SPECIES[id];
  const rough = extent(build(sp, 10).prims);
  const k = Math.min((w - 2) / (rough.x1 - rough.x0), (h - 2) / (rough.y1 - rough.y0));
  const fine = extent(build(sp, k).prims);
  const kk = Math.min((w - 2) / (fine.x1 - fine.x0), (h - 2) / (fine.y1 - fine.y0));
  const dw = (fine.x1 - fine.x0) * kk, dh = (fine.y1 - fine.y0) * kk;
  return { drawn: fine, k: kk, x: x + (w - dw) / 2, y: y + h - 1 - dh, w: dw, h: dh };
}

const drawn = new Map<string, { svg: string; h: number }>();

/**
 * A skeleton fitted into the box (x, y, w, h), standing on its floor: the
 * markup and its height in print units. Remembered by box, since the
 * editor's preview draws the same one at every keystroke.
 */
export function dinosaur(id: Dinosaur, x: number, y: number, w: number, h: number): { svg: string; h: number } {
  const key = `${id} ${x} ${y} ${w} ${h}`;
  const hit = drawn.get(key);
  if (hit) return hit;
  const fit = dinosaurFit(id, x, y, w, h);
  const { k } = fit;
  const X = (v: number) => fit.x + (v - fit.drawn.x0) * k, Y = (v: number) => fit.y + (fit.drawn.y1 - v) * k;
  let out = "";
  for (const p of fit.drawn.prims) {
    let d = "";
    let last = "";
    let n = 0;
    for (const [px, py] of p.pts) {
      const pt = `${f1(X(px))} ${f1(Y(py))}`;
      if (pt === last) continue;
      d += (d ? " " : "M") + pt;
      last = pt;
      n++;
    }
    if (n < 2) continue;
    if (p.closed) d += "Z";
    const fill = p.fill === "ink" ? INK : p.fill === "ground" ? GROUND : "none";
    out += p.w ? `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${p.w}" stroke-linejoin="round" stroke-linecap="round"/>` : `<path d="${d}" fill="${fill}"/>`;
  }
  const res = { svg: out, h: fit.h };
  drawn.set(key, res);
  return res;
}

/** A skeleton fitted into the box (x, y, w, h), standing on its floor. */
export const dinosaurSvg = (id: Dinosaur, x: number, y: number, w: number, h: number) => dinosaur(id, x, y, w, h).svg;
