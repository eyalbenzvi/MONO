/**
 * Where the eight planets stand around the sun on a date: their real orbits
 * (JPL's approximate Keplerian elements, valid 1800–2050) seen from above the
 * solar system: in the catalogue's Planets prints, distances on a
 * square-root scale so Mercury and Neptune share the print; in "Your
 * Planets", the orbits evenly spaced in order, each its own shape, so the
 * inner four's paths don't run together. The same function, different inputs.
 */
import { DEG, STROKE, arcText, caption, circle, dot, line, norm360, path, polyline, text, textWidth } from "../kit";

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
  if (rich) return richBody(jd, c);
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

/** Your Planets' sizes: each planet's dot (print units), in the order of its real size, never to scale. */
const SIZE = [2.2, 3, 3.1, 2.5, 5, 4.2, 3.5, 3.4];
/** Your Planets' drawing: the orbits in order, the bezel, and the planets named round it. */
const RICH_R = { first: 22, last: 96, bezel: 105, label: 116 };
/** The label face: Plex bold capitals, tracked. */
const LABEL = { size: 5, track: 0.14 };
/** The least arc between neighbouring names on the bezel, em: more than a word space. */
const LABEL_GAP_EM = 2;
/** Leaders whose longitudes are closer than this (degrees) share one spoke. */
const LEAD_MERGE = 3;

/**
 * "Your Planets": each orbit in its own shape, evenly spaced in order (fine
 * lines), each planet's path over the 30 days up to the date drawn bold, its
 * dot sized in the order of the planets' real sizes (Saturn with its ring,
 * Earth ringed). Round them a bezel of heliocentric longitude (a tick every
 * 5°, 0° the vernal equinox, on the right), and each planet named on it at
 * its longitude, a hairline leading out from the planet; names that would
 * touch are eased apart along the ring.
 */
function richBody(jd: number, c: PlanetsInput["caption"]): string {
  const CX = 150, CY = 165;
  const { first, last, bezel, label } = RICH_R;
  let body = circle(CX, CY, 4, STROKE.fine) + dot(CX, CY, 1.6);
  // The bezel: a hairline ring, ticks inward every 5°, longer every 30°.
  body += circle(CX, CY, bezel, STROKE.hairline);
  for (let k = 0; k < 360; k += 5) {
    const a = k * DEG, r1 = bezel - (k % 30 === 0 ? 4 : k % 10 === 0 ? 2.4 : 1.4);
    body += line(CX + bezel * Math.cos(a), CY - bezel * Math.sin(a), CX + r1 * Math.cos(a), CY - r1 * Math.sin(a), STROKE.hairline);
  }
  const labels: { name: string; at: number; want: number; w: number; i: number; lead: number }[] = [];
  const placed: { x: number; y: number; v: number; from: number; clear: number }[] = [];
  for (const [i, p] of PLANETS.entries()) {
    const { x, y: py, a, e, w } = planetAt(p, jd);
    const ring = first + (i * (last - first)) / (PLANETS.length - 1);
    const sc = (r: number) => (ring * r) / a;
    const orbit: [number, number][] = [];
    for (let k = 0; k <= 180; k++) {
      const E = (k / 180) * Math.PI * 2;
      const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const r = Math.hypot(xp, yp), v = Math.atan2(yp, xp) + w * DEG;
      orbit.push([CX + sc(r) * Math.cos(v), CY - sc(r) * Math.sin(v)]);
    }
    body += path(polyline(orbit, true), STROKE.fine);
    const trail: [number, number][] = [];
    for (let k = 0; k <= 24; k++) {
      const q = planetAt(p, jd - (RICH.days * k) / 24);
      const rq = Math.hypot(q.x, q.y), vq = Math.atan2(q.y, q.x);
      trail.push([CX + sc(rq) * Math.cos(vq), CY - sc(rq) * Math.sin(vq)]);
    }
    body += path(polyline(trail, false), STROKE.bold);
    const r = Math.hypot(x, py), v = Math.atan2(py, x);
    const [px, pyy] = [CX + sc(r) * Math.cos(v), CY - sc(r) * Math.sin(v)];
    body += dot(px, pyy, SIZE[i]);
    if (p[0] === "Saturn") {
      // The ring: a flat oval through the planet, tilted.
      const ring: [number, number][] = [];
      const [t, rx, ry] = [-22 * DEG, SIZE[i] * 2.1, SIZE[i] * 0.62];
      for (let k = 0; k <= 48; k++) {
        const u = (k / 48) * Math.PI * 2;
        const [ex, ey] = [rx * Math.cos(u), ry * Math.sin(u)];
        ring.push([px + ex * Math.cos(t) - ey * Math.sin(t), pyy + ex * Math.sin(t) + ey * Math.cos(t)]);
      }
      body += path(polyline(ring, true), STROKE.fine);
    }
    if (p[0] === "Earth") body += circle(px, pyy, SIZE[i] + 2.2, STROKE.hairline);
    // The leader, from beyond the planet out to the bezel, at its longitude (drawn once every planet is placed).
    const rp = Math.hypot(px - CX, pyy - CY);
    placed.push({ x: px, y: pyy, v, from: rp + SIZE[i] + (p[0] === "Saturn" ? 7 : p[0] === "Earth" ? 4.2 : 2), clear: SIZE[i] + (p[0] === "Saturn" ? 6 : p[0] === "Earth" ? 4.2 : 2) });
    const name = p[0].toUpperCase();
    const deg = norm360(90 - v / DEG);
    labels.push({ name, i: placed.length - 1, at: deg, want: deg, lead: deg, w: (textWidth(name, LABEL.size, { bold: true }) + [...name].length * LABEL.track * LABEL.size) / label / DEG });
  }
  // Ease names apart along the ring, keeping their order round it (so no two leaders cross), with at least
  // GAP_EM of arc between neighbours: more than a word space, so two names never read as one phrase.
  labels.sort((a, b) => a.want - b.want);
  const n = labels.length;
  const pad = (LABEL_GAP_EM * LABEL.size) / label / DEG;
  const need = (i: number) => (labels[i].w + labels[(i + 1) % n].w) / 2 + pad;
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // Angles unwrapped in order: the last's neighbour is the first, a turn on.
      const gap = labels[j].at + (j === 0 ? 360 : 0) - labels[i].at - need(i);
      if (gap < -1e-6) {
        labels[i].at += gap / 2;
        labels[j].at -= gap / 2;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // Leaders at nearly the same longitude share one line (planets in a row read as one spoke, not a comb of hairlines
  // a unit apart): runs of longitudes within LEAD_MERGE degrees take their mean.
  for (let k = 0; k < n; ) {
    let e = k;
    while (e + 1 < n && labels[e + 1].want - labels[e].want < LEAD_MERGE) e++;
    const mean = labels.slice(k, e + 1).reduce((t, l) => t + l.want, 0) / (e - k + 1);
    for (let q = k; q <= e; q++) labels[q].lead = mean;
    k = e + 1;
  }
  const pt = (r: number, deg: number): [number, number] => [CX + r * Math.sin(deg * DEG), CY - r * Math.cos(deg * DEG)];
  const spokes = new Map<number, number>();
  // A shared spoke is drawn once, from just beyond its innermost planet.
  for (const l of labels) spokes.set(l.lead, Math.min(placed[l.i].from, spokes.get(l.lead) ?? Infinity));
  // Each spoke radial to the bezel, broken round any planet on the way.
  for (const [lead, from] of spokes) {
    const [ux, uy] = [Math.sin(lead * DEG), -Math.cos(lead * DEG)];
    const cuts: [number, number][] = [];
    for (const o of placed) {
      const t = (o.x - CX) * ux + (o.y - CY) * uy;
      const off = Math.abs((o.x - CX) * uy - (o.y - CY) * ux);
      if (t > from && off < o.clear) {
        const half = Math.sqrt(o.clear * o.clear - off * off);
        cuts.push([t - half, t + half]);
      }
    }
    cuts.sort((a, b) => a[0] - b[0]);
    let t0 = from;
    for (const [c0, c1] of [...cuts, [bezel, bezel] as [number, number]]) {
      if (c1 <= t0) continue;
      const end = Math.min(c0, bezel);
      if (end - t0 > 1.5) body += line(CX + t0 * ux, CY + t0 * uy, CX + end * ux, CY + end * uy, STROKE.hairline);
      t0 = Math.max(t0, c1);
      if (t0 >= bezel) break;
    }
  }
  // Then a fan from the spoke's foot at the bezel to each name: the names keep the spokes' order round the ring, so
  // no two fan lines cross.
  for (const l of labels) {
    const at = norm360(l.at);
    const up = at <= 90 || at >= 270;
    const inner = up ? label - 1.4 : label - 5.2;
    const d = ((at - l.lead + 540) % 360) - 180;
    // A short radial stub past the bezel's ticks first, so a long fan line never runs along the ticks.
    const stub = bezel + 3;
    body += Math.abs(d) > 0.5 ? path(polyline([pt(bezel, l.lead), pt(stub, l.lead), pt(inner, at)], false), STROKE.hairline) : line(...pt(bezel, l.lead), ...pt(inner, l.lead), STROKE.hairline);
    body += arcText(l.name, CX, CY, label, at, LABEL.size, up, { bold: true, track: LABEL.track });
  }
  return body + caption(318, c.title, c.sub, c.sub2);
}
