/**
 * Your Family Orbits: a family as a solar system, drawn like the catalogue's
 * Galilean moons (the orbit-moons variant): the sun at the centre (the
 * eldest, or whoever was chosen), everyone else on a circular orbit, the
 * elder nearer the sun, each planet at the angle of their birthday on a
 * calendar dial round the outside (1 January at the top, clockwise, a tick
 * a day). Each name runs along its own orbit, letter by letter, the orbit
 * broken under it as a chart breaks a line for its label; on the lower half
 * the letters turn to read left to right. Orbits are concentric and at
 * least a label's height apart, so no two names can meet.
 */
import { INK, caption, circle, dot, f1, line, text, captionLines, type Lines } from "../kit";
import { titleWords } from "../specKit";
import { dateOf, eldest, unpackDays, type Params } from "../specs/orbits";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const CX = 150, CY = 170;
/** The orbits span these radii; the sun's own label runs at SUN_LABEL; the calendar dial sits at DIAL. */
const R0 = 40, R1 = 106, SUN_LABEL = 27, DIAL = 118;
/** Letter size and spacing of the names; the planet's dot and ring. A small family draws larger (its orbits are further apart). */
const SIZE = 5.8, SPACING = 0.7;
const PLANET = 2.6, RING = 4.4;
const LANES = 8;
const lane = (j: number) => R0 + ((R1 - R0) * j) / (LANES - 1);
const scaleFor = (orbits: number) => (orbits <= 1 ? 1.45 : orbits <= 3 ? 1.25 : orbits <= 5 ? 1.1 : 1);
const DEG = Math.PI / 180;
/** Days before each month in a common year. */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const INITIALS = "JFMAMJJASOND";

/** A birthday's angle on the dial (degrees from the top, clockwise); 29 February between the 28th and 1 March. */
const birthdayAngle = (mo: number, d: number) => ((MONTH_START[mo - 1] + d - 1 + (mo === 2 && d === 29 ? -0.5 : 0)) / 365) * 360;
const at = (r: number, a: number): [number, number] => [CX + r * Math.sin(a * DEG), CY - r * Math.cos(a * DEG)];

/**
 * A label along a circle, a letter at a time, over the arc that starts at
 * `from` (degrees, clockwise): read clockwise on the circle's upper half,
 * anticlockwise on the lower (`lower`), so it always reads left to right.
 * Returns the letters and the arc [from, to] it covers.
 */
const adv = (size: number) => 0.602 * size + SPACING * (size / SIZE);
function arcLabel(s: string, r: number, from: number, lower: boolean, size = SIZE, bold = false): { svg: string; arc: [number, number] } {
  const ADV = adv(size);
  const span = (s.length * ADV) / r / DEG;
  let svg = "";
  [...s].forEach((ch, i) => {
    if (ch === " ") return;
    const off = ((i + 0.5) * ADV) / r / DEG;
    const a = lower ? from + span - off : from + off;
    // The baseline sits off the orbit by a third of the letter's size, so the letters straddle the line.
    const [x, y] = at(r + (lower ? 1 : -1) * size * 0.36, a);
    svg += `<g transform="rotate(${f1(lower ? a + 180 : a)} ${f1(x)} ${f1(y)})">${text(x, y, ch, Math.round(size * 10) / 10, { bold })}</g>`;
  });
  return { svg, arc: [from, from + span] };
}

/** A circle as arcs, left open over the given gaps (clockwise degrees). */
function brokenCircle(r: number, gaps: [number, number][], width: number): string {
  if (!gaps.length) return circle(CX, CY, r, width);
  // Merge the gaps round the circle, then draw what's between them.
  const g = gaps.map(([a, b]) => [((a % 360) + 360) % 360, ((a % 360) + 360) % 360 + (b - a)] as [number, number]).sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of g) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  let d = "";
  merged.forEach(([, b], i) => {
    const next = i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + 360;
    if (next - b < 0.5) return;
    const [x0, y0] = at(r, b), [x1, y1] = at(r, next);
    d += `M${f1(x0)} ${f1(y0)}A${f1(r)} ${f1(r)} 0 ${next - b > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
  });
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}"/>`;
}

/** The drawing, the caption's lines as ours, and where the caption sits. */
function orbitsDraw(p: Params): [string, Lines, number] {
  const days = unpackDays(p.b)!;
  const sun = p.s ?? eldest(days);
  const people = p.n.map((name, i) => ({ name, i, day: days[i], date: dateOf(days[i]) }));
  // Everyone but the sun, elder nearer: by birth date, ties in the order given.
  const planets = people.filter((q) => q.i !== sun).sort((a, b) => a.day - b.day || a.i - b.i);
  const m = planets.length;
  const sc = scaleFor(m);
  let s = "";
  // Eight lanes; the planets spread over them, the lanes left empty dotted (room for more).
  const lanes = planets.map((_, k) => (m === 1 ? 5 : Math.round((k * (LANES - 1)) / (m - 1))));
  for (let j = 0; j < LANES; j++)
    if (!lanes.includes(j)) s += `<circle cx="${CX}" cy="${CY}" r="${f1(lane(j))}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round" stroke-dasharray="0 3.4"/>`;

  // The calendar dial: a tick a day, longer at each month, the months' initials outside.
  let ticks = "";
  for (let d = 0; d < 365; d++) {
    const a = (d / 365) * 360;
    const month = MONTH_START.includes(d);
    const [x0, y0] = at(DIAL, a), [x1, y1] = at(DIAL + (month ? 10 : d % 7 === 0 ? 6 : 3.5), a);
    ticks += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
  }
  s += circle(CX, CY, DIAL, 0.7) + `<path d="${ticks}" fill="none" stroke="${INK}" stroke-width=".45"/>`;
  MONTH_START.forEach((d0, k) => {
    const next = k < 11 ? MONTH_START[k + 1] : 365;
    const [x, y] = at(DIAL + 16, (((d0 + next) / 2) / 365) * 360);
    s += text(x, y + 2.2, INITIALS[k], 6.2, { bold: true });
  });

  // The sun: rings, rays, the initial; its name on a ring of its own above it.
  const S = people[sun];
  s += circle(CX, CY, 12, 1.3) + circle(CX, CY, 8.6, 0.6) + text(CX, CY + 3.6, S.name.toUpperCase()[0], 10, { bold: true });
  for (let k = 0; k < 16; k++) {
    const a = k * 22.5 + 11.25;
    const [x0, y0] = at(15.5, a), [x1, y1] = at(k % 2 ? 18.5 : 20.5, a);
    s += line(x0, y0, x1, y1, 0.7);
  }
  const sunText = `${S.name.toUpperCase()} · ${S.date[0]}`;
  s += arcLabel(sunText, SUN_LABEL, -((sunText.length * adv(SIZE)) / SUN_LABEL / DEG) / 2, false, SIZE, true).svg;

  // The planets: each on its orbit at its birthday, its name running on from it along the orbit.
  planets.forEach((q, k) => {
    const r = lane(lanes[k]);
    const a = birthdayAngle(q.date[1], q.date[2]);
    const [x, y] = at(r, a);
    const lbl = `${q.name.toUpperCase()} · ${q.date[0]}`;
    const clear = (RING * sc + 3) / r / DEG;
    const span = (lbl.length * adv(SIZE * sc)) / r / DEG;
    // The label on the planet's side away from the horizon (towards the top on the upper half, the bottom on the
    // lower), so it never runs over into the half where it would read upside down.
    const lower = Math.cos(a * DEG) < 0;
    const towardsLarger = lower ? a < 180 : a >= 180;
    const L = arcLabel(lbl, r, towardsLarger ? a + clear : a - clear - span, lower, SIZE * sc);
    const pad = 1.6 / r / DEG;
    s += brokenCircle(r, [[a - clear + 1.2 / r / DEG, a + clear - 1.2 / r / DEG], [L.arc[0] - pad, L.arc[1] + pad]], Math.round(7 * sc) / 10);
    s += dot(x, y, PLANET * sc) + circle(x, y, RING * sc, 0.6 * sc) + L.svg;
  });

  const years = people.map((q) => q.date[0]);
  const title = titleWords(p) ?? "Family Orbits";
  const [y0, y1] = [Math.min(...years), Math.max(...years)];
  const sub = `${people.length} people · ${y0 === y1 ? `all born ${y0}` : `${y0}–${y1}`}`;
  return [s, [title, sub, `${S.name} at the centre · the elder nearer · each at their birthday`], 338];
}
/** The caption's lines (ours). */
export const orbitsCaption = (p: Params): Lines => orbitsDraw(p)[1];

export function orbitsBody(p: Params): string {
  const [s, lines, y] = orbitsDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => orbitsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(orbitsBody((spec as { p: Params }).p), color);
