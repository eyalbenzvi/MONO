/**
 * Path helpers the computed drawings share: a run of points as path data, and
 * a set of point runs scaled into a box. Pure, so the generator and a
 * template in the browser trace the same line from the same numbers.
 */
import { polyline } from "../kit";

export type Point = [number, number];
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/**
 * A source of numbers in [0, 1). The catalogue passes its seeded generator
 * (so its prints stay as they are); a template may pass its own, or
 * `() => 0.5` for no jitter at all.
 */
export type Rng = () => number;

export { polyline };

/** Fit point runs into a box (keeping proportions), centred: curves are computed in their own units and drawn at print size. */
export function fit(points: Point[][], box: Box): Point[][] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of points) for (const [x, y] of line) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  const s = Math.min(box.w / (x1 - x0 || 1), box.h / (y1 - y0 || 1));
  const ox = box.x + (box.w - (x1 - x0) * s) / 2 - x0 * s;
  const oy = box.y + (box.h - (y1 - y0) * s) / 2 - y0 * s;
  return points.map((line) => line.map(([x, y]) => [x * s + ox, y * s + oy] as Point));
}
