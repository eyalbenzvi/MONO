/**
 * Your Route: a run, a ride or a hike, from its GPX file (read on the device;
 * the file itself never leaves it and isn't kept) or a line drawn on a blank
 * grid. The route travels as its shape only: simplified, fitted to its own
 * box (the lowest corner is 0, 0; the longer side spans ROUTE_GRID steps),
 * each step delta-encoded (`packInts`), with the metres one step stands for.
 * No place: nothing in the spec says where on earth it was.
 */
import { int, num, packInts, parseDate, unpackInts, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The route: packInts of [x0, y0, dx1, dy1, …] on the ROUTE_GRID. */
  r: string;
  /** Metres a grid step stands for (a file's route; a drawn line has no scale). */
  m?: number;
  /** The distance, km, one decimal. */
  k?: number;
  /** The elevation profile: packInts of [lowest m, highest m, then ELEV_N heights on 0–ELEV_Q, each as the step from the one before]. */
  e?: string;
  /** The day ("YYYY-MM-DD"). */
  d?: string;
  w?: string;
}

export const NAME = "Your Route";
export const ROUTE_GRID = 255;
export const ROUTE_MAX_POINTS = 400;
/** The route's bytes, at most (the editor aims for ROUTE_AIM_BYTES; the longest link stays well under the ceiling). */
export const ROUTE_MAX_BYTES = 360;
export const ROUTE_AIM_BYTES = 160;
export const ELEV_N = 48;
export const ELEV_Q = 63;
export const ROUTE_MAX_KM = 9999.9;
/** A file's start and end are hidden by this much (m) unless the switch is off. */
export const HIDE_M = 200;

/** The route's points on the grid, or null when it isn't a canonical one. */
export function routePoints(r: unknown): [number, number][] | null {
  const v = unpackInts(r, ROUTE_MAX_BYTES);
  if (!v || v.length % 2 || v.length < 4 || v.length > ROUTE_MAX_POINTS * 2) return null;
  const pts: [number, number][] = [[v[0], v[1]]];
  for (let i = 2; i < v.length; i += 2) {
    if (v[i] === 0 && v[i + 1] === 0) return null;
    const [x, y] = pts[pts.length - 1];
    pts.push([x + v[i], y + v[i + 1]]);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return x0 === 0 && y0 === 0 && x1 <= ROUTE_GRID && y1 <= ROUTE_GRID && Math.max(x1, y1) === ROUTE_GRID ? pts : null;
}
/** Grid points as the spec's `r` (no check: the caller has fitted them). */
export const packRoute = (pts: readonly (readonly [number, number])[]) => packInts(pts.flatMap(([x, y], i) => (i ? [x - pts[i - 1][0], y - pts[i - 1][1]] : [x, y])));

/** The profile, or null when it isn't one. */
export function routeElevation(e: unknown): { lo: number; hi: number; q: number[] } | null {
  const v = unpackInts(e, 2 * 3 + ELEV_N * 2);
  if (!v || v.length !== 2 + ELEV_N) return null;
  const [lo, hi] = v;
  if (!int(lo, -500, 9000) || !int(hi, lo + 1, 9000)) return null;
  const q: number[] = [];
  for (let i = 2, h = 0; i < v.length; i++) {
    h = i === 2 ? v[i] : h + v[i];
    if (!int(h, 0, ELEV_Q)) return null;
    q.push(h);
  }
  return { lo, hi, q };
}
export const packElevation = (lo: number, hi: number, q: readonly number[]) => packInts([lo, hi, ...q.map((h, i) => (i ? h - q[i - 1] : h))]);

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  const words = wordsOf(p);
  if (!words || !routePoints(p.r)) return null;
  if (p.m !== undefined && !int(p.m, 1, 4000)) return null;
  if (p.k !== undefined && !num(p.k, 0.1, ROUTE_MAX_KM, 1)) return null;
  // A profile belongs to a file's route (one with a scale).
  if (p.e !== undefined && (p.m === undefined || !routeElevation(p.e))) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  return {
    r: p.r as string,
    ...(p.m !== undefined ? { m: p.m as number } : {}),
    ...(p.k !== undefined ? { k: p.k as number } : {}),
    ...(p.e !== undefined ? { e: p.e as string } : {}),
    ...(p.d !== undefined ? { d: p.d as string } : {}),
    ...words,
  };
}

/** The distance as printed ("12.4 km"). */
export const km = (k: number) => `${k.toFixed(1).replace(/\.0$/, "")} km`;
export const detail = (p: Params) => p.w ?? (p.k !== undefined ? km(p.k) : "A drawn route");

export const PRODUCT: ProductMeta<Params> = {
  line: "Your run, ride or hike, drawn as a map of its own.",
  from: "A GPX file or a line",
  group: "place",
  base: "contours",
  wordsHint: "Sunday long run",
  hints: { dense: "Try a simpler route.", faint: "Try a longer route." },
  // A 14 km loop through streets, a climb after the first third (a track made in code, through lib/custom/draw/route routeFromTrack, written out).
  example: {
    r: "hAPeAQMNMCMGDQgBAAtJERcfRxEXHQ0FAQcZBwULHQMBBykMBwwpGAAIIxgAKAYWCgICHBEEAAodBA0QICICHBgGBAhABAMQCQIFGgkEARwMCBgqCAAYIi4MAgcaAyARCAt6AxYbHgUCBywFBg0IAQALBwETHQ8FAQcbBwAHEwcBCQ",
    m: 15,
    k: 14,
    e: "LLABHAUHCwAKEAQDAQQKDg4WDggDAwAOCAcjIQMABQcVBwYICgYABw0HAgwMBAMJBwUB",
    d: "2024-04-21",
    w: "Sunday long run",
  },
};
