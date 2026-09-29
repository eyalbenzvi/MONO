/**
 * A constructed alphabet for monograms, and the interlace. Each capital A–Z
 * is a few strokes on a centre line (straight runs and arcs of circles and
 * ellipses, geometric, as a draughtsman lays out letters with rule and
 * compass): no font's outlines are read, so nothing depends on a font's
 * licence. A letter is drawn as a ribbon: a wide stroke of ink, a narrower
 * one of ground on it (lib/custom/svg GROUND), so what prints is the
 * ribbon's two edges, closed round at its ends, and a hairline down its
 * middle; all of a letter's strokes are laid in ink before any in ground,
 * so where they meet the ribbons join as one. Letters drawn later pass
 * over earlier ones (the ground hides what's beneath); where two letters
 * cross, over and under alternate along the first letter, the "over"
 * crossings re-laid as a short piece of ribbon on top.
 */
import { INK, f1 } from "../kit";
import { GROUND } from "../svg";
import type { Point } from "./paths";

export interface Glyph {
  /** Advance width at cap height 100. */
  w: number;
  /** The strokes, centre lines as point runs (y down, 0 at the cap line, 100 at the baseline). */
  strokes: Point[][];
}

/** An arc of an ellipse centred (cx, cy), from a0 to a1 degrees (0 = right, clockwise on screen), as points. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Point[] {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 6));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Point;
  });
}
const P = (...xy: number[]): Point[] => Array.from({ length: xy.length / 2 }, (_, i) => [xy[2 * i], xy[2 * i + 1]] as Point);
/** Runs joined end to start into one stroke. */
const join = (...runs: Point[][]): Point[] => runs.flatMap((r, i) => (i ? r.slice(1) : r));

/** The alphabet: cap height 100; bowls are arcs, the rest straight. */
export const GLYPHS: Record<string, Glyph> = {
  A: { w: 80, strokes: [P(0, 100, 40, 0, 80, 100), P(15, 62, 65, 62)] },
  B: { w: 66, strokes: [P(0, 0, 0, 100), join(P(0, 0, 34, 0), arc(34, 24, 24, 24, -90, 90), P(34, 48, 0, 48)), join(P(0, 48, 38, 48), arc(38, 74, 26, 26, -90, 90), P(38, 100, 0, 100))] },
  C: { w: 92, strokes: [arc(50, 50, 48, 50, -40, -320)] },
  D: { w: 88, strokes: [P(0, 0, 0, 100), join(P(0, 0, 38, 0), arc(38, 50, 50, 50, -90, 90), P(38, 100, 0, 100))] },
  E: { w: 62, strokes: [P(62, 0, 0, 0, 0, 100, 62, 100), P(0, 50, 50, 50)] },
  F: { w: 62, strokes: [P(62, 0, 0, 0, 0, 100), P(0, 50, 50, 50)] },
  G: { w: 96, strokes: [join(arc(50, 50, 48, 50, -40, -360), P(98, 50, 58, 50))] },
  H: { w: 72, strokes: [P(0, 0, 0, 100), P(72, 0, 72, 100), P(0, 50, 72, 50)] },
  I: { w: 28, strokes: [P(0, 0, 28, 0), P(14, 0, 14, 100), P(0, 100, 28, 100)] },
  J: { w: 58, strokes: [join(P(58, 0, 58, 70), arc(30, 70, 28, 30, 0, 180))] },
  K: { w: 68, strokes: [P(0, 0, 0, 100), P(66, 0, 0, 64), P(22, 46, 68, 100)] },
  L: { w: 60, strokes: [P(0, 0, 0, 100, 60, 100)] },
  M: { w: 88, strokes: [P(0, 100, 0, 0, 44, 72, 88, 0, 88, 100)] },
  N: { w: 72, strokes: [P(0, 100, 0, 0, 72, 100, 72, 0)] },
  O: { w: 100, strokes: [arc(50, 50, 50, 50, -90, 270)] },
  P: { w: 64, strokes: [join(P(0, 100, 0, 0, 38, 0), arc(38, 26, 26, 26, -90, 90), P(38, 52, 0, 52))] },
  Q: { w: 100, strokes: [arc(50, 50, 50, 50, -90, 270), P(58, 66, 100, 106)] },
  R: { w: 68, strokes: [join(P(0, 100, 0, 0, 38, 0), arc(38, 26, 26, 26, -90, 90), P(38, 52, 0, 52)), P(30, 52, 68, 100)] },
  S: { w: 68, strokes: [join(arc(34, 25, 32, 25, -25, -270), arc(34, 75, 34, 25, -90, 155))] },
  T: { w: 76, strokes: [P(0, 0, 76, 0), P(38, 0, 38, 100)] },
  U: { w: 72, strokes: [join(P(0, 0, 0, 64), arc(36, 64, 36, 36, 180, 0), P(72, 64, 72, 0))] },
  V: { w: 80, strokes: [P(0, 0, 40, 100, 80, 0)] },
  W: { w: 108, strokes: [P(0, 0, 25, 100, 54, 22, 83, 100, 108, 0)] },
  X: { w: 74, strokes: [P(0, 0, 74, 100), P(74, 0, 0, 100)] },
  Y: { w: 76, strokes: [P(0, 0, 38, 50, 76, 0), P(38, 50, 38, 100)] },
  Z: { w: 72, strokes: [P(0, 0, 72, 0, 0, 100, 72, 100)] },
};

/** A letter placed on the print: its glyph scaled to `h` (cap height) with its top left at (x, y). */
export interface Placed {
  ch: string;
  x: number;
  y: number;
  h: number;
}

/** The letter's strokes in print units. */
export function placedStrokes(p: Placed): Point[][] {
  const k = p.h / 100;
  return GLYPHS[p.ch].strokes.map((s) => s.map(([x, y]) => [p.x + x * k, p.y + y * k] as Point));
}

const d = (run: Point[]) => run.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y)}`).join("");

/** Where two point runs cross: the point, the run positions (index + fraction) along each, and the angle between them. */
function crossings(a: Point[], b: Point[]): { at: Point; ta: number; tb: number; sin: number }[] {
  const out: { at: Point; ta: number; tb: number; sin: number }[] = [];
  for (let i = 0; i + 1 < a.length; i++)
    for (let j = 0; j + 1 < b.length; j++) {
      const [p, q, r, s] = [a[i], a[i + 1], b[j], b[j + 1]];
      const [ux, uy, vx, vy] = [q[0] - p[0], q[1] - p[1], s[0] - r[0], s[1] - r[1]];
      const den = ux * vy - uy * vx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((r[0] - p[0]) * vy - (r[1] - p[1]) * vx) / den;
      const u = ((r[0] - p[0]) * uy - (r[1] - p[1]) * ux) / den;
      if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
      out.push({ at: [p[0] + ux * t, p[1] + uy * t], ta: i + t, tb: j + u, sin: Math.abs(den) / (Math.hypot(ux, uy) * Math.hypot(vx, vy)) });
    }
  return out;
}

/** The part of a run within `len` (along it) of position t, as points. */
function piece(run: Point[], t: number, len: number): Point[] {
  const cum = [0];
  for (let i = 1; i < run.length; i++) cum.push(cum[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]));
  const i0 = Math.floor(t);
  const at = cum[Math.min(i0, run.length - 1)] + (i0 + 1 < run.length ? (t - i0) * (cum[i0 + 1] - cum[i0]) : 0);
  const [lo, hi] = [Math.max(0, at - len), Math.min(cum[cum.length - 1], at + len)];
  const pointAt = (s: number): Point => {
    let k = 1;
    while (k < run.length - 1 && cum[k] < s) k++;
    const f = cum[k] === cum[k - 1] ? 0 : (s - cum[k - 1]) / (cum[k] - cum[k - 1]);
    return [run[k - 1][0] + (run[k][0] - run[k - 1][0]) * f, run[k - 1][1] + (run[k][1] - run[k - 1][1]) * f];
  };
  return [pointAt(lo), ...run.filter((_, k) => cum[k] > lo && cum[k] < hi), pointAt(hi)];
}

export interface Ribbon {
  /** The ribbon's width (edge to edge), and the width of each edge's line. */
  width: number;
  edge: number;
  /** The gap cut either side of a ribbon where it passes over another (a margin of ground laid first). */
  gap: number;
  /** An inline: a narrower ribbon of this width inside, drawn in hairlines of `hair` (0: a single hairline down the middle instead). */
  inner: number;
  hair: number;
}

/**
 * The letters as interlaced ribbons: each letter over the ones before it,
 * except at alternate crossings with each earlier letter (counted along that
 * earlier letter's strokes), where the earlier one passes over.
 */
export function interlace(letters: Placed[], rb: Ribbon): string {
  const runs = letters.map(placedStrokes);
  const stroke = (strokes: Point[][], colour: string, width: number, cap: string) =>
    `<path d="${strokes.map(d).join("")}" fill="none" stroke="${colour}" stroke-width="${f1(width)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
  /** A letter's ribbon: every stroke in ink, then every stroke in ground (so its strokes join as one), then the inline. `edgeRuns`: the runs for the outer ink, when they differ. */
  const layer = (strokes: Point[][], cap: "round" | "butt", edgeRuns = strokes) =>
    stroke(edgeRuns, GROUND, rb.width + 2 * rb.gap, cap) +
    stroke(edgeRuns, INK, rb.width, cap) +
    stroke(strokes, GROUND, rb.width - 2 * rb.edge, cap) +
    (rb.inner ? stroke(strokes, INK, rb.inner, cap) + stroke(strokes, GROUND, rb.inner - 2 * rb.hair, cap) : stroke(strokes, INK, rb.hair, cap));
  let s = runs.map((strokes) => layer(strokes, "round")).join("");
  // The crossings where the earlier letter goes over: every other one along it, starting with the second.
  const over: Point[][] = [];
  const overInk: Point[][] = [];
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const xs = runs[i].flatMap((a, si) => runs[j].flatMap((b) => crossings(a, b).map((c) => ({ ...c, si }))));
      xs.sort((p, q) => p.si - q.si || p.ta - q.ta);
      xs.forEach((c, k) => {
        if (k % 2 === 0) return;
        const len = rb.width / Math.max(c.sin, 0.35) + rb.width * 0.6;
        over.push(piece(runs[i][c.si], c.ta, len));
        // The piece's outer ink stops just short of its ground, so its cut ends leave no seam across the ribbon.
        overInk.push(piece(runs[i][c.si], c.ta, len - 0.4));
      });
    }
  if (over.length) s += layer(over, "butt", overInk);
  return s;
}

interface Seg {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  box: [number, number, number, number];
}
const segsOf = (runs: Point[][]): Seg[] =>
  runs.flatMap((run) =>
    run.slice(1).map((q, k) => {
      const p = run[k];
      return { x: p[0], y: p[1], dx: q[0] - p[0], dy: q[1] - p[1], len: Math.hypot(q[0] - p[0], q[1] - p[1]) || 1e-9, box: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])] as [number, number, number, number] };
    }),
  );

/**
 * How two placed letters meet: how many times their strokes cross cleanly
 * (steep, away from both strokes' ends) and how many glancingly or at an end
 * (those read as collisions), how much of either runs alongside the other
 * (near parallel, within 2.2 ribbons), and how much passes close to the
 * other without crossing it (an end, a corner or a bowl touching the other
 * letter), in print units of stroke. Sampled every half ribbon.
 */
export function meeting(a: Placed, b: Placed, width: number): { crossings: number; poor: number; parallel: number; touch: number } {
  const sa = placedStrokes(a), sb = placedStrokes(b);
  const ga = segsOf(sa), gb = segsOf(sb);
  const reach = width * 2.2;
  const boxOf = (g: Seg[]) => g.reduce((m, s) => [Math.min(m[0], s.box[0]), Math.min(m[1], s.box[1]), Math.max(m[2], s.box[2]), Math.max(m[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const [ba, bb] = [boxOf(ga), boxOf(gb)];
  if (ba[0] - reach > bb[2] || bb[0] - reach > ba[2] || ba[1] - reach > bb[3] || bb[1] - reach > ba[3]) return { crossings: 0, poor: 0, parallel: 0, touch: 0 };
  const xs: Point[] = [];
  const ends = [...sa, ...sb].flatMap((r) => [r[0], r[r.length - 1]]);
  let poor = 0;
  for (const p of sa)
    for (const q of sb)
      for (const c of crossings(p, q)) {
        xs.push(c.at);
        if (c.sin < 0.45 || ends.some((e) => Math.hypot(e[0] - c.at[0], e[1] - c.at[1]) < width * 1.6)) poor++;
      }
  let parallel = 0, touch = 0;
  const step = Math.max(1, width * 0.5);
  for (const [mine, other] of [[ga, gb], [gb, ga]] as const)
    for (const sg of mine) {
      const n = Math.max(1, Math.round(sg.len / step));
      const [ux, uy] = [sg.dx / sg.len, sg.dy / sg.len];
      for (let t = 0; t < n; t++) {
        const [x, y] = [sg.x + (sg.dx * (t + 0.5)) / n, sg.y + (sg.dy * (t + 0.5)) / n];
        let [near, side] = [Infinity, false];
        for (const o of other) {
          if (x < o.box[0] - reach || x > o.box[2] + reach || y < o.box[1] - reach || y > o.box[3] + reach) continue;
          const f = Math.max(0, Math.min(1, ((x - o.x) * o.dx + (y - o.y) * o.dy) / (o.len * o.len)));
          const d = Math.hypot(o.x + o.dx * f - x, o.y + o.dy * f - y);
          near = Math.min(near, d);
          if (d < reach && Math.abs(ux * o.dy - uy * o.dx) / o.len < 0.4) side = true;
        }
        if (side) parallel += sg.len / n;
        if (near < width * 1.25 && !xs.some((c) => Math.hypot(c[0] - x, c[1] - y) < width * 1.9)) touch += sg.len / n;
      }
    }
  return { crossings: xs.length - poor, poor, parallel, touch };
}

/** A word's letters that the alphabet has (A–Z), in capitals. */
export const monogramLetters = (s: string) => [...s.toUpperCase()].filter((c) => GLYPHS[c]);
