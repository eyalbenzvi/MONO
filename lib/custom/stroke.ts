/**
 * Your Line's stroke, from the pad to the spec: simplified (Ramer–Douglas–
 * Peucker, ε = 0.004 of the pad), fitted to the unit square, put on the
 * 256-step grid and encoded (lib/custom/spec encodeStroke). At most 256
 * points; a longer line is simplified harder until it fits.
 */
import { STROKE_MAX_BYTES, STROKE_MAX_POINTS, encodeStroke } from "./spec";

type Pt = readonly [number, number];

/** Ramer–Douglas–Peucker: the fewest points within ε of the line. */
export function simplify(points: readonly Pt[], eps: number): Pt[] {
  if (points.length < 3) return [...points];
  const [a, b] = [points[0], points[points.length - 1]];
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  let [far, at] = [-1, 0];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dist = len ? Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (dist > far) (far = dist), (at = i);
  }
  if (far <= eps) return [a, b];
  return [...simplify(points.slice(0, at + 1), eps).slice(0, -1), ...simplify(points.slice(at), eps)];
}

/**
 * A drawn stroke (pad pixels, pad side `size`) as the spec's `s`, or null
 * when there's nothing to go round (a dot). The line keeps its place on the
 * pad: the pad is the unit square, so where it was drawn is where it sits in
 * each sector.
 */
export function strokeSpec(points: readonly Pt[], size: number): string | null {
  const unit = points.map(([x, y]) => [Math.min(1, Math.max(0, x / size)), Math.min(1, Math.max(0, y / size))] as const);
  // Harder and harder until it fits (at worst the line from end to end).
  for (let eps = 0.004; eps < 2; eps *= 1.5) {
    const grid: [number, number][] = [];
    for (const [x, y] of simplify(unit, eps)) {
      const g: [number, number] = [Math.round(x * 255), Math.round(y * 255)];
      const last = grid[grid.length - 1];
      if (!last || last[0] !== g[0] || last[1] !== g[1]) grid.push(g);
    }
    if (grid.length < 2) return null;
    if (grid.length > STROKE_MAX_POINTS) continue;
    const s = encodeStroke(grid);
    if (atob(s.replace(/-/g, "+").replace(/_/g, "/")).length <= STROKE_MAX_BYTES) return s;
  }
  return null;
}

/** Five lines for a page without a pointer ("Example lines"): a wave, a leaf, a hook, a zigzag, a loop (unit square). */
export const EXAMPLE_LINES: Pt[][] = [
  Array.from({ length: 40 }, (_, i) => [0.5 + (i / 39) * 0.45, 0.5 + Math.sin((i / 39) * Math.PI * 2) * 0.08] as const),
  Array.from({ length: 30 }, (_, i) => {
    const t = (i / 29) * Math.PI;
    return [0.52 + (i / 29) * 0.4, 0.5 - Math.sin(t) * 0.12] as const;
  }),
  Array.from({ length: 30 }, (_, i) => {
    const t = (i / 29) * Math.PI * 1.4;
    return [0.55 + 0.25 * (i / 29) + 0.08 * Math.sin(t), 0.45 + 0.1 * Math.cos(t)] as const;
  }),
  [
    [0.52, 0.5],
    [0.6, 0.42],
    [0.68, 0.55],
    [0.76, 0.42],
    [0.84, 0.55],
    [0.92, 0.47],
  ],
  Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * Math.PI * 2;
    return [0.72 + 0.14 * Math.cos(t) - 0.14, 0.5 + 0.1 * Math.sin(t)] as const;
  }),
];

/** An example line as the spec's `s` (the same encoding as a drawn one). */
export const exampleStroke = (i: number) => strokeSpec(EXAMPLE_LINES[i % EXAMPLE_LINES.length].map(([x, y]) => [x * 1000, y * 1000]), 1000)!;
