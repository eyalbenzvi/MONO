/**
 * Curves traced from their equations: the harmonograph (damped pendulums, two
 * per axis) and the Lissajous figure drawn as a ribbon of shrinking copies.
 * The catalogue draws its parameters from a seeded generator; a template can
 * pass a customer's own ratio, phases and damping and get the same kind of
 * line.
 */
import { INK } from "../kit";
import { fit, polyline, type Box, type Point } from "./paths";

type Four = [number, number, number, number];

export interface Harmonograph {
  /** The frequency ratio, x : y (3 : 2 is a fifth). */
  a: number;
  b: number;
  /** Each pendulum's frequency multiplier, near 1 (x₁, x₂, y₁, y₂): a slight mistuning makes the figure drift. */
  detune: Four;
  /** Each pendulum's phase, radians (x₁, x₂, y₁, y₂). */
  phases: Four;
  /** Each pendulum's damping per unit time (x₁, x₂, y₁, y₂): larger comes to rest sooner. */
  damping: Four;
  /** How many points to trace (the catalogue's 4,000 keeps the file light). */
  steps?: number;
  /** How long the pen runs, in radians of the slower swing. */
  duration?: number;
}

/** The harmonograph's trace in its own units (each axis within ±2). */
export function harmonographPoints(h: Harmonograph): Point[] {
  const { a, b, detune: det, phases: p, damping: d } = h;
  const N = h.steps ?? 4000, duration = h.duration ?? 150;
  const m = Math.max(a, b);
  const pts: Point[] = [];
  for (let i = 0; i < N; i++) {
    // Written as the catalogue always wrote it (× m ÷ m), so its floating point, and its prints, stay the same.
    const t = ((i / N) * duration * m) / m;
    pts.push([
      Math.sin(a * det[0] * t + p[0]) * Math.exp(-d[0] * t) + Math.sin(a * det[1] * t + p[1]) * Math.exp(-d[1] * t),
      Math.sin(b * det[2] * t + p[2]) * Math.exp(-d[2] * t) + Math.sin(b * det[3] * t + p[3]) * Math.exp(-d[3] * t),
    ]);
  }
  return pts;
}

/** A trace fitted into a box, as one hairline path. */
export function tracePath(points: Point[], box: Box, width: number | string = ".45"): string {
  const [line] = fit([points], box);
  return `<path d="${polyline(line)}" fill="none" stroke="${INK}" stroke-width="${width}"/>`;
}

export interface Lissajous {
  /** The frequencies: x = sin(a·t + δ), y = sin(b·t). */
  a: number;
  b: number;
  /** The phase δ, radians. */
  delta: number;
  /** How many copies make the ribbon. */
  copies: number;
  /** How much smaller each copy is than the last (a fraction of the first). */
  shrink?: number;
  /** How much each copy's phase moves on, radians. */
  drift?: number;
}

/** The ribbon's copies in their own units (within ±1), largest first. */
export function lissajousLines(l: Lissajous): Point[][] {
  const { a, b, delta, copies } = l;
  const shrink = l.shrink ?? 0.035, drift = l.drift ?? 0.02;
  const lines: Point[][] = [];
  for (let c = 0; c < copies; c++) {
    const s = 1 - c * shrink;
    const pts: Point[] = [];
    // Enough points for a smooth curve, few enough for a light file.
    const steps = Math.min(900, 100 * Math.max(a, b));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push([s * Math.sin(a * t + delta + c * drift), s * Math.sin(b * t)]);
    }
    lines.push(pts);
  }
  return lines;
}

/** The Lissajous ribbon fitted into a box, as one path. */
export function lissajousPath(l: Lissajous, box: Box, width: number | string = ".5"): string {
  return `<path d="${fit(lissajousLines(l), box).map((line) => polyline(line)).join("")}" fill="none" stroke="${INK}" stroke-width="${width}"/>`;
}
