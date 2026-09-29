/**
 * Your Snowflake: a snow crystal grown from your name. The name seeds the
 * numbers of Reiter's growth model (lib/custom/draw/snowflake: α diffusion,
 * β the vapour's background level, γ how much settles each step) within the
 * regime of plates, sectored plates and branched stars, and the crystal
 * grows from a small hexagonal plate at the centre, its arms from the
 * plate's corners, until they reach the grid's edge. Numbers that would grow
 * narrow arms tapering to a point (they read as leaves, not as snow) are
 * refused and the name's next numbers tried (RANGE, broadArms). Drawn like
 * the catalogue's star rosettes (the nearest radial, n-fold design; the
 * khatam tiles' stars the next): the outline traced where the water freezes
 * (marching triangles on the grid's own triangles, so exactly six-fold), the
 * ridges inside as finer contours of the ice's thickness, the centre plate
 * drawn with its edge and a ridge. Every name gives its own numbers (a
 * 32-bit hash spread over continuous ranges), so no two names give the same
 * flake in practice.
 */
import { INK, caption, f1 } from "../kit";
import { broadArms, growCrystal, type Crystal } from "../draw/snowflake";
import { mulberry32 } from "../rng";
import type { CustomSpec } from "../spec";
import type { Params as SnowflakeParams } from "../specs/snowflake";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** Grid radius in cells: fine enough for the arms' side branches, small enough to grow in a live preview. */
export const GRID = 50;
const CX = 150, CY = 164, RADIUS = 124;
const SQ3 = Math.sqrt(3) / 2;

/** FNV-1a of the name, as printed. */
const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return h;
};

/**
 * The model's range: high β (the regime of plates, sectored plates and
 * branched stars), any α and γ in it, and a hexagonal plate at the centre
 * (6–10 cells) that the arms grow from its corners, as a real snowflake's do.
 * Within it some numbers still grow narrow arms that taper to a point, like
 * leaves; those are refused (draw/snowflake broadArms) and the name's next
 * numbers tried.
 */
export const RANGE = { alpha: [0.4, 2.6], beta: [0.7, 0.92], logGamma: [-4.5, -2.5], plate: [6, 10] } as const;
/** Tries before the fallback (each passes with even odds or so: the fallback's chance is about one in a hundred thousand). */
const TRIES = 20;
/** A crystal known to read well, if every try fails. */
const FALLBACK = { alpha: 0.59, beta: 0.83, gamma: 10 ** -3.1, plate: 8 };
export interface Flake {
  alpha: number;
  beta: number;
  gamma: number;
  plate: number;
}
export const growFlake = (f: Flake) => growCrystal(f.alpha, f.beta, f.gamma, GRID, 20000, 3, f.plate);

const cache = new Map<string, { flake: Flake; crystal: Crystal }>();
/** A name's flake: the first of its numbers (seeded by the name) that grows broad arms. The last few kept (the preview draws each spec once per colour). */
export function flakeFor(name: string): { flake: Flake; crystal: Crystal } {
  const hit = cache.get(name);
  if (hit) return hit;
  const rnd = mulberry32(fnv(name));
  const pick = ([lo, hi]: readonly [number, number]) => lo + rnd() * (hi - lo);
  let out: { flake: Flake; crystal: Crystal } | null = null;
  for (let t = 0; t < TRIES && !out; t++) {
    const flake = { alpha: pick(RANGE.alpha), beta: pick(RANGE.beta), gamma: 10 ** pick(RANGE.logGamma), plate: Math.floor(pick([RANGE.plate[0], RANGE.plate[1] + 1])) };
    const crystal = growFlake(flake);
    if (broadArms(crystal)) out = { flake, crystal };
  }
  out ??= { flake: FALLBACK, crystal: growFlake(FALLBACK) };
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(name, out);
  return out;
}

/** Segments where the field crosses `level`, on the grid's triangles (marching triangles), in print units. */
function contour(c: Crystal, level: number, pos: (q: number, r: number) => [number, number]): string {
  const { n, s } = c;
  const side = 2 * n + 1;
  const reach = Math.min(n - 1, c.radius + 2);
  const at = (q: number, r: number) => (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > n ? 0 : s[(r + n) * side + (q + n)]);
  // Segments as pairs of points (formatted, so ends that meet match exactly), chained into runs afterwards.
  const segs: [string, string][] = [];
  const cut = (qa: number, ra: number, va: number, qb: number, rb: number, vb: number) => {
    const t = (level - va) / (vb - va);
    const [x, y] = pos(qa + (qb - qa) * t, ra + (rb - ra) * t);
    return `${f1(x)} ${f1(y)}`;
  };
  const tri = (q1: number, r1: number, q2: number, r2: number, q3: number, r3: number) => {
    const [v1, v2, v3] = [at(q1, r1), at(q2, r2), at(q3, r3)];
    const [i1, i2, i3] = [v1 >= level, v2 >= level, v3 >= level];
    if (i1 === i2 && i2 === i3) return;
    // The odd one out: the line cuts its two edges.
    if (i2 === i3) segs.push([cut(q1, r1, v1, q2, r2, v2), cut(q1, r1, v1, q3, r3, v3)]);
    else if (i1 === i3) segs.push([cut(q2, r2, v2, q1, r1, v1), cut(q2, r2, v2, q3, r3, v3)]);
    else segs.push([cut(q3, r3, v3, q1, r1, v1), cut(q3, r3, v3, q2, r2, v2)]);
  };
  for (let r = -reach; r < reach; r++)
    for (let q = -reach; q < reach; q++) {
      tri(q, r, q + 1, r, q, r + 1);
      tri(q + 1, r, q + 1, r + 1, q, r + 1);
    }
  return chain(segs);
}

/** Segments joined end to end into runs (one M, then L after L), as path data. */
function chain(segs: [string, string][]): string {
  const ends = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    if (a === b) return;
    for (const k of [a, b]) ends.set(k, [...(ends.get(k) ?? []), i]);
  });
  const used = new Uint8Array(segs.length);
  let d = "";
  const next = (at: string) => (ends.get(at) ?? []).find((j) => !used[j]);
  segs.forEach(([a, b], i) => {
    if (used[i] || a === b) return;
    used[i] = 1;
    // Walk back from a to the run's start, then forward from there.
    const back: string[] = [];
    let at = a;
    for (let j = next(at); j !== undefined; j = next(at)) {
      used[j] = 1;
      at = segs[j][0] === at ? segs[j][1] : segs[j][0];
      back.push(at);
    }
    const run = [...back.reverse(), a, b];
    at = b;
    for (let j = next(at); j !== undefined; j = next(at)) {
      used[j] = 1;
      at = segs[j][0] === at ? segs[j][1] : segs[j][0];
      run.push(at);
    }
    // Straight runs (the ridges of a sectored plate are long straight lines) kept as their two ends.
    const pts = run.map((k) => k.split(" ").map(Number));
    const kept = pts.filter((q, i) => {
      if (i === 0 || i === pts.length - 1) return true;
      const [a, b] = [pts[i - 1], pts[i + 1]];
      return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 0.07 * Math.hypot(b[0] - a[0], b[1] - a[1]);
    });
    d += `M${kept.map((q) => `${q[0]} ${q[1]}`).join("L")}`;
  });
  return d;
}

/** A grown crystal drawn, the name under it. */
export function crystalBody(c: Crystal, name: string, sub2?: string, plate = 0): string {
  const h = RADIUS / Math.max(c.radius + 1, 20);
  // Axial (q, r) to the print, turned so an arm points up.
  const pos = (q: number, r: number): [number, number] => [CX + r * SQ3 * h, CY - (q + r / 2) * h];
  let s = `<path d="${contour(c, 1, pos)}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
  s += `<path d="${contour(c, 1.08, pos)}" fill="none" stroke="${INK}" stroke-width=".5" stroke-linecap="round"/>`;
  s += `<path d="${contour(c, 1.3, pos)}" fill="none" stroke="${INK}" stroke-width=".5" stroke-linecap="round"/>`;
  if (plate) {
    // The centre plate the arms grew from: its edge, and a ridge inside it.
    const hex = (k: number) => [[k, 0], [0, k], [-k, k], [-k, 0], [0, -k], [k, -k]].map(([q, r], i) => `${i ? "L" : "M"}${pos(q, r).map(f1).join(" ")}`).join("") + "Z";
    s += `<path d="${hex(plate + 0.5)}" fill="${GROUND}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`;
    s += `<path d="${hex((plate + 0.5) * 0.55)}" fill="none" stroke="${INK}" stroke-width=".6" stroke-linejoin="round"/>`;
  }
  return s + caption(338, name, "A snow crystal grown from a name", sub2);
}

export function snowflakeBody(p: SnowflakeParams): string {
  const { flake, crystal } = flakeFor(p.n);
  return crystalBody(crystal, p.n, `Reiter's model · alpha ${flake.alpha.toFixed(2)} · beta ${flake.beta.toFixed(3)} · gamma ${flake.gamma.toPrecision(2)}`, flake.plate);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(snowflakeBody((spec as { p: SnowflakeParams }).p), color);
