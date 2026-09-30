/**
 * Where the eight planets stand around the sun on a date: their real orbits
 * (JPL's approximate Keplerian elements, valid 1800–2050) seen from above the
 * solar system: in the catalogue's Planets prints, distances on a
 * square-root scale so Mercury and Neptune share the print; in "Your
 * Planets", the orbits evenly spaced in order, each its own shape, so the
 * inner four's paths don't run together. The same function, different inputs.
 */
import { DEG, caption, circle, dot, norm360, path, polyline, text } from "../kit";

/** JPL's approximate Keplerian elements (Standish, 1800–2050): a (AU), e, L, ϖ (°) at J2000 and per century. */
export const PLANETS: [string, number, number, number, number, number, number, number][] = [
  // name, a, e, e/cy, L, L/cy, ϖ, ϖ/cy
  ["Mercury", 0.38709927, 0.20563593, 0.00001906, 252.2503235, 149472.67411175, 77.45779628, 0.16047689],
  ["Venus", 0.72333566, 0.00677672, -0.00004107, 181.9790995, 58517.81538729, 131.60246718, 0.00268329],
  ["Earth", 1.00000261, 0.01671123, -0.00004392, 100.46457166, 35999.37244981, 102.93768193, 0.32327364],
  ["Mars", 1.52371034, 0.0933941, 0.00007882, -4.55343205, 19140.30268499, -23.94362959, 0.44441088],
  ["Jupiter", 5.202887, 0.04838624, -0.00013253, 34.39644051, 3034.74612775, 14.72847983, 0.21252668],
  ["Saturn", 9.53667594, 0.05386179, -0.00050991, 49.95424423, 1222.49362201, 92.59887831, -0.41897216],
  ["Uranus", 19.18916464, 0.04725744, -0.00004397, 313.23810451, 428.48202785, 170.9542763, 0.40805281],
  ["Neptune", 30.06992276, 0.00859048, 0.00005105, -55.12002969, 218.45945325, 44.96476227, -0.32241464],
];

/** A planet's heliocentric position (AU, in its orbit's plane) at a Julian date. */
export function planetAt(p: (typeof PLANETS)[number], jd: number): { x: number; y: number; a: number; e: number; w: number } {
  const T = (jd - 2451545) / 36525;
  const [, a, e0, de, L0, dL, w0, dw] = p;
  const e = e0 + de * T;
  const w = w0 + dw * T;
  const M = norm360(L0 + dL * T - w) * DEG;
  let E = M;
  for (let i = 0; i < 12; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const r = Math.hypot(xp, yp), v = Math.atan2(yp, xp) + w * DEG;
  return { x: r * Math.cos(v), y: r * Math.sin(v), a, e, w };
}


/** "Your Planets" weights (line widths and dot radius, print units) and its trails' length (days): quality 74–75 against the catalogue's 47–49. */
const RICH = { orbit: 1.2, trail: 3, dot: 4, days: 30 };

export interface PlanetsInput {
  /** The moment, as a Julian date (UT). */
  jd: number;
  caption: { title?: string; sub?: string; sub2?: string };
  /**
   * "Your Planets" (a tee of its own, not a catalogue print): heavier orbits
   * and planets, and each planet's path through the 30 days up to the date
   * drawn bold, so the print carries the weight of a front print.
   */
  rich?: boolean;
}

/** The orbits, the planets on them, and the caption: the print's body (white ink, unwrapped). */
export function planetsBody({ jd, caption: c, rich = false }: PlanetsInput): string {
  const CX = 150, CY = 160, RMAX = 122;
  // The catalogue's prints: distances on a square-root scale, so Mercury and Neptune share the print. Your Planets
  // (rich, its paths drawn bold) spaces the orbits evenly in order, each keeping its own shape: on the root scale
  // the four inner ones sit four units apart, and their paths ran together.
  const root = (r: number) => 10 + (RMAX - 10) * Math.sqrt(r / 30.4);
  let body = circle(CX, CY, 4, 0.9) + dot(CX, CY, 1.4);
  for (const [i, p] of PLANETS.entries()) {
    const { x, y: py, a, e, w } = planetAt(p, jd);
    const ring = 24 + (i * (RMAX - 24)) / (PLANETS.length - 1);
    const sc = rich ? (r: number) => (ring * r) / a : root;
    const orbit: [number, number][] = [];
    for (let k = 0; k <= 180; k++) {
      const E = (k / 180) * Math.PI * 2;
      const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const r = Math.hypot(xp, yp), v = Math.atan2(yp, xp) + w * DEG;
      orbit.push([CX + sc(r) * Math.cos(v), CY - sc(r) * Math.sin(v)]);
    }
    body += path(polyline(orbit, true), rich ? RICH.orbit : 0.55);
    const r = Math.hypot(x, py), v = Math.atan2(py, x);
    const [px, pyy] = [CX + sc(r) * Math.cos(v), CY - sc(r) * Math.sin(v)];
    if (rich) {
      const trail: [number, number][] = [];
      for (let k = 0; k <= 24; k++) {
        const q = planetAt(p, jd - (RICH.days * k) / 24);
        const rq = Math.hypot(q.x, q.y), vq = Math.atan2(q.y, q.x);
        trail.push([CX + sc(rq) * Math.cos(vq), CY - sc(rq) * Math.sin(vq)]);
      }
      body += path(polyline(trail, false), RICH.trail);
    }
    body += dot(px, pyy, rich ? RICH.dot : 2.6);
    const out2 = sc(r) + 9;
    body += text(CX + out2 * Math.cos(v), CY - out2 * Math.sin(v) + 2.2, p[0].slice(0, 2).toUpperCase(), 5.5, { bold: true });
  }
  return body + caption(318, c.title, c.sub, c.sub2);
}
