/**
 * Your Journey: the places you've been, joined in order on a globe, drawn
 * like Your Place and the catalogue's Daylight prints (an orthographic globe,
 * a graticule, the world's cities of 200,000 people or more as its only land:
 * data/cities, GeoNames). The globe is turned to the middle of the journey
 * (the centre of the smallest cap that holds every stop, so as many stops as
 * can be face us) and, when the journey is small, seen closer through a round
 * lens, so a weekend in two cities still reads. Each leg is the great circle
 * between two stops (the way a plane flies), cut exactly where it meets the
 * lens or goes round the back; the far side of an antipodal leg is chosen
 * through the side that faces us. Stops are numbered; the list and the total
 * distance sit under the globe.
 */
import { INK, caption, f1, text } from "../kit";
import { loadCities } from "../data";
import type { City, CustomSpec } from "../spec";
import type { Params as JourneyParams } from "../specs/journey";
import { GROUND, wrap } from "../svg";
import type { RenderData } from "../renderers";
import type { BaseColor } from "@/types/shirt";

type V3 = [number, number, number];
const DEG = Math.PI / 180;
const CX = 150, CY = 138, R = 110;
const EARTH_KM = 6371;

const vec = (lat: number, lon: number): V3 => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l < 1e-12 ? [0, 0, 1] : [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const latLon = (v: V3): [number, number] => [Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG, Math.atan2(v[1], v[0]) / DEG];
const angle = (a: V3, b: V3) => Math.atan2(Math.hypot(...cross(a, b)), dot3(a, b));

/** The point a fraction t along the great circle from a to b (the shorter way; b = −a goes through `via`). */
function slerp(a: V3, b: V3, t: number, via: V3): V3 {
  const om = angle(a, b);
  if (om < 1e-9) return a;
  // Nearly antipodal: the plane of the circle is undefined, so it goes through `via` (perpendicular to a).
  if (Math.PI - om < 1e-3) {
    const th = t * Math.PI;
    return norm([a[0] * Math.cos(th) + via[0] * Math.sin(th), a[1] * Math.cos(th) + via[1] * Math.sin(th), a[2] * Math.cos(th) + via[2] * Math.sin(th)]);
  }
  const s = Math.sin(om);
  const [p, q] = [Math.sin((1 - t) * om) / s, Math.sin(t * om) / s];
  return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
}

/**
 * The globe's centre: the centre of the smallest cap holding every stop
 * (the most distant stop as near as it can be), found on a Fibonacci sphere
 * then refined; deterministic. Ties go to the stops' mean direction.
 */
function centreOf(stops: V3[]): V3 {
  const mean = norm(stops.reduce<V3>((m, v) => [m[0] + v[0], m[1] + v[1], m[2] + v[2]], [0, 0, 0]));
  const score = (c: V3) => Math.min(...stops.map((v) => dot3(c, v))) + 1e-4 * dot3(c, mean);
  let best = mean;
  let bs = score(mean);
  const N = 1200;
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - z * z), th = i * 2.399963229728653;
    const c: V3 = [r * Math.cos(th), r * Math.sin(th), z];
    const s = score(c);
    if (s > bs) (bs = s), (best = c);
  }
  // Refine: step towards the direction that helps, shrinking the step.
  for (let step = 0.05; step > 1e-4; step *= 0.6) {
    let moved = true;
    while (moved) {
      moved = false;
      const [e1, e2] = basis(best);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const c = norm([best[0] + step * (Math.cos(a) * e1[0] + Math.sin(a) * e2[0]), best[1] + step * (Math.cos(a) * e1[1] + Math.sin(a) * e2[1]), best[2] + step * (Math.cos(a) * e1[2] + Math.sin(a) * e2[2])]);
        const s = score(c);
        if (s > bs + 1e-12) (bs = s), (best = c), (moved = true);
      }
    }
  }
  return best;
}
/** Two unit vectors perpendicular to v and to each other. */
function basis(v: V3): [V3, V3] {
  const e1 = norm(Math.abs(v[2]) < 0.9 ? cross([0, 0, 1], v) : cross([1, 0, 0], v));
  return [e1, cross(v, e1)];
}

const km = (n: number) => String(Math.round(n / 10) * 10).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function journeyBody(p: JourneyParams, places: City[] = []): string {
  const byId = new Map(places.map((c) => [c.id, c]));
  const cities = p.c.map((id) => byId.get(id));
  const known = cities.filter((c): c is City => !!c);
  const stops = known.map((c) => vec(c.lat, c.lon));
  const centre = stops.length ? centreOf(stops) : vec(20, 0);
  const [la0, lo0] = latLon(centre);
  const phi0 = la0 * DEG, lam0 = lo0 * DEG;
  const [s0, c0] = [Math.sin(phi0), Math.cos(phi0)];
  // Closer when the journey is small: the farthest stop lands about two thirds of the way out (at most twelve times).
  const spread = Math.max(0, ...stops.map((v) => Math.sin(Math.min(Math.PI / 2, angle(centre, v)))));
  const zoom = Math.max(1, Math.min(12, 0.66 / Math.max(spread, 1e-6)));
  const RK = R * zoom;
  /** Screen position, and whether it shows (facing us, inside the lens). */
  const project = (v: V3): [number, number, boolean] => {
    const [lat, lon] = latLon(v);
    const phi = lat * DEG, dl = lon * DEG - lam0;
    const cosc = s0 * Math.sin(phi) + c0 * Math.cos(phi) * Math.cos(dl);
    const x = RK * Math.cos(phi) * Math.sin(dl), y = -RK * (c0 * Math.sin(phi) - s0 * Math.cos(phi) * Math.cos(dl));
    return [CX + x, CY + y, cosc >= 0 && x * x + y * y <= R * R];
  };
  /** Stops further than this from the centre can't show (the lens's half-angle; the horizon on the whole globe). */
  const capR = zoom > 1 ? Math.asin(1 / zoom) : Math.PI / 2;
  /**
   * A curve on the sphere as path data, broken where it doesn't show, each
   * break found exactly (bisection). Sampled in n coarse steps, each split
   * finer as the globe comes closer; a step whose ends are both well out of
   * sight is skipped whole (no point of it can be nearer the centre than an
   * end less half its length).
   */
  const trace = (f: (t: number) => V3, n: number): string => {
    const sub = Math.ceil(zoom);
    const ts: number[] = [];
    for (let i = 0; i < n; i++) {
      const [a, b] = [f(i / n), f((i + 1) / n)];
      const seg = angle(a, b);
      if (angle(centre, a) > capR + seg + 0.01 && angle(centre, b) > capR + seg + 0.01) ts.push(NaN);
      else for (let k = 0; k < sub; k++) ts.push((i + k / sub) / n);
    }
    ts.push(1);
    let d = "";
    let prev: { t: number; pt: [number, number, boolean] } | null = null;
    const edge = (ta: number, tb: number, showA: boolean) => {
      let [a, b] = [ta, tb];
      for (let i = 0; i < 24; i++) {
        const m = (a + b) / 2;
        if (project(f(m))[2] === showA) a = m;
        else b = m;
      }
      return project(f(showA ? a : b));
    };
    for (const t of ts) {
      if (Number.isNaN(t)) {
        prev = null;
        continue;
      }
      const pt = project(f(t));
      if (prev && prev.pt[2] !== pt[2]) {
        const e = edge(prev.t, t, prev.pt[2]);
        d += `${prev.pt[2] ? "L" : "M"}${f1(e[0])} ${f1(e[1])}`;
        if (pt[2]) d += `L${f1(pt[0])} ${f1(pt[1])}`;
      } else if (pt[2]) d += `${prev ? "L" : "M"}${f1(pt[0])} ${f1(pt[1])}`;
      prev = { t, pt };
    }
    return d;
  };

  // The graticule, finer as the globe comes closer.
  const g = zoom < 2.5 ? 15 : zoom < 5 ? 10 : zoom < 9 ? 5 : 2;
  let grat = "";
  for (let lat = -90 + g; lat < 90; lat += g) grat += trace((t) => vec(lat, -180 + 360 * t), 144);
  for (let lon = -180; lon < 180; lon += g) grat += trace((t) => vec(-89.9 + 179.8 * t, lon), 72);
  let s = `<path d="${grat}" fill="none" stroke="${INK}" stroke-width=".45"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  if (zoom > 1.05) s += `<circle cx="${CX}" cy="${CY}" r="${R + 3.5}" fill="none" stroke="${INK}" stroke-width=".6"/>`;

  // The stops on screen, and the legs between them (sampled, for the labels to keep clear of).
  const screen = stops.map(project);
  const legSamples: [number, number][] = [];
  const legs: string[] = [];
  const arrows: string[] = [];
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const [a, b] = [stops[i - 1], stops[i]];
    const om = angle(a, b);
    total += om * EARTH_KM;
    // An antipodal leg goes round by the side that faces us.
    const ca = dot3(centre, a);
    const perp: V3 = [centre[0] - ca * a[0], centre[1] - ca * a[1], centre[2] - ca * a[2]];
    const via = Math.hypot(...perp) < 1e-6 ? basis(a)[0] : norm(perp);
    const f = (t: number) => slerp(a, b, t, via);
    const n = Math.max(24, Math.ceil((om / DEG) * 2));
    legs.push(trace(f, n));
    for (let k = 0; k <= 60; k++) {
      const q = project(f(k / 60));
      if (q[2]) legSamples.push([q[0], q[1]]);
    }
    // Which way it goes: a chevron at the middle of the leg, when that shows and the leg is long enough.
    const [m, m2] = [project(f(0.5)), project(f(0.5 + 0.02))];
    const len = Math.hypot(screen[i][0] - screen[i - 1][0], screen[i][1] - screen[i - 1][1]);
    if (m[2] && m2[2] && len > 30) {
      const ang = Math.atan2(m2[1] - m[1], m2[0] - m[0]);
      const pt = (da: number, r: number) => `${f1(m[0] + r * Math.cos(ang + da))} ${f1(m[1] + r * Math.sin(ang + da))}`;
      arrows.push(`M${pt(Math.PI - 0.55, 5)}L${f1(m[0])} ${f1(m[1])}L${pt(Math.PI + 0.55, 5)}`);
    }
  }

  // The land: every city facing us, clear of the stops and of the legs' casing.
  const near = (x: number, y: number, r: number) => screen.some(([sx, sy, v]) => v && Math.hypot(sx - x, sy - y) < r);
  let dots = "";
  for (const c of places) {
    const [x, y, v] = project(vec(c.lat, c.lon));
    if (!v || near(x, y, 7) || Math.hypot(x - CX, y - CY) > R - 1.5) continue;
    dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.min(1.6, 0.7 + 0.3 * Math.log10(Math.max(1, c.pop / 2e5))))}" fill="${INK}"/>`;
  }
  s += dots;
  const legPath = legs.join("");
  if (legPath) s += `<path d="${legPath}" fill="none" stroke="${GROUND}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><path d="${legPath}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (arrows.length) s += `<path d="${arrows.join("")}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Each place once (a place visited twice carries both numbers), numbered where there's room.
  const seen = new Map<number, number[]>();
  known.forEach((c, i) => seen.set(c.id, [...(seen.get(c.id) ?? []), i]));
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  let marks = "", labels = "";
  for (const [, idx] of seen) {
    const [x, y, v] = screen[idx[0]];
    if (!v) continue;
    marks += `<circle cx="${f1(x)}" cy="${f1(y)}" r="4.2" fill="${GROUND}" stroke="${INK}" stroke-width="1.2"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1.7" fill="${INK}"/>`;
    const label = idx.map((i) => i + 1).join(",");
    const w = label.length * 0.602 * 8, h = 7;
    let best: { x: number; y: number; score: number } | null = null;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 - Math.PI / 4;
      const lx = x + Math.cos(a) * (8 + w / 2), ly = y + Math.sin(a) * 10 + 2.8;
      const box = { x: lx - w / 2, y: ly - h, w, h };
      const inside = Math.hypot(lx - CX, ly - 3 - CY) < R - 6 ? 0 : 50;
      const hitLeg = legSamples.filter(([px, py]) => px > box.x - 1.5 && px < box.x + w + 1.5 && py > box.y - 1.5 && py < box.y + h + 1.5).length;
      const hitStop = screen.filter(([sx, sy, sv]) => sv && sx > box.x - 5 && sx < box.x + w + 5 && sy > box.y - 5 && sy < box.y + h + 5).length;
      const hitLabel = taken.filter((t) => t.x < box.x + w + 1 && box.x < t.x + t.w + 1 && t.y < box.y + h + 1 && box.y < t.y + t.h + 1).length;
      const score = inside + hitLeg * 3 + hitStop * 20 + hitLabel * 40 + k * 0.01;
      if (!best || score < best.score) best = { x: lx, y: ly, score };
    }
    taken.push({ x: best!.x - w / 2, y: best!.y - h, w, h });
    // A knockout behind the number so no dot or line runs through it.
    labels += `<rect x="${f1(best!.x - w / 2 - 1)}" y="${f1(best!.y - h - 0.6)}" width="${f1(w + 2)}" height="${f1(h + 2)}" fill="${GROUND}"/>`;
    labels += text(best!.x, best!.y, label, 8, { bold: true });
  }
  s += marks + labels;

  // The list: two columns under the globe, a place that's round the back said so.
  const rows = Math.ceil(cities.length / 2);
  const LH = 10.5, Y0 = 276 + ((4 - rows) * LH) / 2;
  cities.forEach((c, i) => {
    const col = i < rows ? 0 : 1, row = col ? i - rows : i;
    const x = col ? 160 : 34, y = Y0 + row * LH;
    const hidden = c && !screen[known.indexOf(c)]?.[2];
    let name = c ? c.name : "?";
    const room = hidden ? 16 : 22;
    if (name.length > room) name = `${name.slice(0, room - 1).trimEnd()}…`;
    s += text(x, y, String(i + 1), 7, { anchor: "end", bold: true }) + text(x + 5, y, `${name}${hidden ? " (far side)" : ""}`, 7, { anchor: "start" });
  });
  s += `<path d="M34 ${f1(Y0 - 13)}H266" fill="none" stroke="${INK}" stroke-width=".6"/>`;

  const first = known[0]?.name, last = known[known.length - 1]?.name;
  const route = first && last ? (first === last ? `${first} and back` : `${first} to ${last}`) : "Your Journey";
  const title = p.w ?? (route.length <= 34 ? route : "Your Journey");
  const sub = `${cities.length} stops · ${km(total)} km`;
  return s + caption(338, title, sub, p.w && route.length <= 44 ? route : undefined);
}

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => wrap(journeyBody((spec as { p: JourneyParams }).p, data.places ?? []), color);

/** The place list, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { places: (await loadCities()).list };
}
