/**
 * Plants from rules: the phyllotaxis seed head (Vogel's model, each seed
 * turned a fixed angle from the last) and the L-system plant (a few rewriting
 * rules, then a turtle walking the result). The catalogue picks the angles
 * and counts from a seeded generator; a template passes its own.
 */
import { DEG, INK, f1 } from "../kit";
import { fit, polyline, type Box, type Point, type Rng } from "./paths";

export interface SeedHead {
  /** How many seeds. */
  n: number;
  /** The turn between one seed and the next, degrees (137.508 is the golden angle). */
  angle: number;
  /** Seeds grow outwards when true, shrink outwards when false. */
  grow: boolean;
  cx?: number;
  cy?: number;
  /** The head's radius. */
  r?: number;
}

/** A seed head as filled dots: the n-th seed at √n of the radius, so the seeds pack evenly. */
export function phyllotaxis(o: SeedHead): string {
  const { n, angle, grow } = o;
  const cx = o.cx ?? 150, cy = o.cy ?? 180, R = o.r ?? 120;
  let body = "";
  for (let i = 1; i <= n; i++) {
    const r = R * Math.sqrt(i / n);
    const th = i * angle * DEG;
    const size = grow ? 0.6 + 2.6 * Math.sqrt(i / n) : 3.2 - 2.4 * Math.sqrt(i / n);
    body += `<circle cx="${f1(cx + r * Math.cos(th))}" cy="${f1(cy + r * Math.sin(th))}" r="${f1(Math.max(0.5, size))}" fill="${INK}"/>`;
  }
  return body;
}

export interface LSystem {
  axiom: string;
  /** Each symbol's replacement; symbols without a rule are kept. */
  rules: Record<string, string>;
  /** How many times the rules are applied. */
  iter: number;
}

/** The L-system's string after its rewrites. */
export function lsystem({ axiom, rules, iter }: LSystem): string {
  let str = axiom;
  for (let i = 0; i < iter; i++) str = [...str].map((ch) => rules[ch] ?? ch).join("");
  return str;
}

/**
 * The turtle's walk over an L-system string, as polylines: F steps forward,
 * + and − turn by the angle, [ and ] save and restore the position. Every step
 * and turn is stretched by 0.9–1.1 from `jitter` (as a hand would vary it);
 * `() => 0.5` draws the rules exactly.
 */
export function turtle(str: string, angle: number, lean: number, jitter: Rng): Point[][] {
  const lines: Point[][] = [];
  const stack: [number, number, number][] = [];
  let [x, y, a] = [0, 0, -90 + lean];
  for (const ch of str) {
    if (ch === "F") {
      const nx = x + Math.cos(a * DEG) * (0.9 + jitter() * 0.2);
      const ny = y + Math.sin(a * DEG) * (0.9 + jitter() * 0.2);
      lines.push([[x, y], [nx, ny]]);
      [x, y] = [nx, ny];
    } else if (ch === "+") a += angle * (0.9 + jitter() * 0.2);
    else if (ch === "-") a -= angle * (0.9 + jitter() * 0.2);
    else if (ch === "[") stack.push([x, y, a]);
    else if (ch === "]") [x, y, a] = stack.pop()!;
  }
  // Merge consecutive segments into polylines (a lighter file, smoother joins).
  const merged: Point[][] = [];
  for (const seg of lines) {
    const last = merged[merged.length - 1];
    if (last && Math.hypot(last[last.length - 1][0] - seg[0][0], last[last.length - 1][1] - seg[0][1]) < 1e-9) last.push(seg[1]);
    else merged.push([...seg]);
  }
  return merged;
}

/** An L-system plant grown, walked and fitted into a box, as one engraved-looking path. `lean` tilts the stem, degrees. */
export function plant(sys: LSystem, angle: number, lean: number, jitter: Rng, box: Box, width: number | string = ".7"): string {
  const fitted = fit(turtle(lsystem(sys), angle, lean, jitter), box);
  return `<path d="${fitted.map((line) => polyline(line)).join("")}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
