/**
 * Your Route from what the editor holds (on the device, never sent): a track
 * read from a GPX file, or a line drawn on the pad, to the spec's route.
 * A track is measured, its first and last HIDE_M metres cut off (unless the
 * switch is off), projected (a local equirectangular projection about its
 * own middle), simplified (Ramer–Douglas–Peucker, harder until it fits),
 * fitted to its own box on the grid and packed; its heights, when it has
 * them, sampled at ELEV_N points evenly along the way.
 */
import { simplify } from "../stroke";
import { ELEV_N, ELEV_Q, HIDE_M, ROUTE_AIM_BYTES, ROUTE_GRID, ROUTE_MAX_BYTES, ROUTE_MAX_KM, ROUTE_MAX_POINTS, packElevation, packRoute } from "../specs/route";

export interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
}
type Pt = readonly [number, number];

const R = 6_371_000;
const DEG = Math.PI / 180;
/** Metres between two points (haversine). */
export function metres(a: TrackPoint, b: TrackPoint): number {
  const dLat = (b.lat - a.lat) * DEG, dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Points as grid points, fitted (lowest corner 0, 0; the longer side ROUTE_GRID), simplified until packed within `aim` bytes (at worst ROUTE_MAX_BYTES). Returns the packed route and the span (input units) of the longer side. */
function fitRoute(pts: Pt[]): { r: string; span: number } | null {
  if (pts.length < 2) return null;
  const pass = (eps: number, limit: number) => {
    const s = simplify(pts, eps);
    const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
    const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
    const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
    if (!(span > 0)) return null;
    const grid: [number, number][] = [];
    for (const [x, y] of s) {
      const g: [number, number] = [Math.round(((x - x0) / span) * ROUTE_GRID), Math.round(((y - y0) / span) * ROUTE_GRID)];
      const last = grid[grid.length - 1];
      if (!last || last[0] !== g[0] || last[1] !== g[1]) grid.push(g);
    }
    if (grid.length < 2 || grid.length > ROUTE_MAX_POINTS) return undefined;
    const r = packRoute(grid);
    return (r.length * 3) / 4 <= limit ? { r, span } : undefined;
  };
  // ε in the route's own units, starting at a third of a grid step.
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (!(span > 0)) return null;
  for (const limit of [ROUTE_AIM_BYTES, ROUTE_MAX_BYTES])
    for (let eps = span / ROUTE_GRID / 3; eps < span / 4; eps *= 1.25) {
      const got = pass(eps, limit);
      if (got === null) return null;
      if (got) return got;
    }
  return null;
}

export interface RouteParts {
  r: string;
  m: number;
  k: number;
  e?: string;
}

/** Why a track can't make a route (one line), or its parts. */
export function routeFromTrack(track: readonly TrackPoint[], hide: boolean): RouteParts | string {
  const pts = track.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (pts.length < 2) return "That file has no track in it.";
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + metres(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  if (total < 100) return "That track is too short.";
  const k = Math.min(ROUTE_MAX_KM, Math.max(0.1, Math.round(total / 100) / 10));
  // The point at a distance along the way (interpolated).
  const at = (d: number): TrackPoint => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = cum[i] > cum[i - 1] ? (d - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
    const [a, b] = [pts[i - 1], pts[i]];
    const ele = a.ele !== undefined && b.ele !== undefined ? a.ele + (b.ele - a.ele) * t : (a.ele ?? b.ele);
    return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele };
  };
  let [from, to] = [0, total];
  if (hide) {
    if (total < HIDE_M * 3) return "Too short to hide the start and end. Turn that off, or try a longer route.";
    [from, to] = [HIDE_M, total - HIDE_M];
  }
  const kept: TrackPoint[] = [at(from), ...pts.filter((_, i) => cum[i] > from && cum[i] < to), at(to)];
  // Projected about the track's own middle, metres, y down the page (north up).
  const lat0 = (Math.min(...kept.map((p) => p.lat)) + Math.max(...kept.map((p) => p.lat))) / 2;
  const lon0 = kept[0].lon;
  const unwrap = (lon: number) => ((((lon - lon0 + 540) % 360) + 360) % 360) - 180;
  const xy: Pt[] = kept.map((p) => [unwrap(p.lon) * DEG * R * Math.cos(lat0 * DEG), -(p.lat - lat0) * DEG * R]);
  const fitted = fitRoute(xy);
  if (!fitted) return "That track is too short.";
  const m = Math.min(4000, Math.max(1, Math.round(fitted.span / ROUTE_GRID)));
  if (fitted.span / ROUTE_GRID > 4000) return "That route is too long to draw.";
  // Heights, if at least half the kept points have one.
  let e: string | undefined;
  if (kept.filter((p) => p.ele !== undefined && Number.isFinite(p.ele)).length * 2 >= kept.length) {
    const hs = Array.from({ length: ELEV_N }, (_, i) => at(from + ((to - from) * i) / (ELEV_N - 1)).ele ?? NaN);
    const known = hs.filter(Number.isFinite);
    if (known.length) {
      const lo = Math.max(-500, Math.min(8999, Math.round(Math.min(...known))));
      const hi = Math.min(9000, Math.max(lo + 1, Math.round(Math.max(...known))));
      const q = hs.map((h) => (Number.isFinite(h) ? Math.min(ELEV_Q, Math.max(0, Math.round(((h - lo) / (hi - lo)) * ELEV_Q))) : 0));
      e = packElevation(lo, hi, q);
    }
  }
  return { r: fitted.r, m, k, ...(e ? { e } : {}) };
}

/** A line drawn on the pad (any units, y down) as the spec's route, or null when it's only a dot. */
export function routeFromDrawing(points: readonly Pt[]): string | null {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  if (points.length < 2) return null;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const pad = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), 1);
  if (span < pad * 0.02) return null;
  return fitRoute([...points])?.r ?? null;
}
