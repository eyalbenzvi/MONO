/**
 * Your Line: one stroke drawn on a square pad, turned into an ornament. The
 * stroke (normalised to the unit square, lib/custom/stroke) fills one
 * sector, from the ring's inner edge to its rim, and is turned `n` times
 * round the centre (and, mirrored, reflected in each
 * sector's axis), in the catalogue rosette's line weight. Three offset
 * rings of the same line, smaller and turned part of a sector each, go
 * round it at the guilloche's hairline, as a rose engine's strands do; a
 * double border holds it.
 *
 * So every line prints: the disc is drawn as a ring (the copies never pile
 * up at the centre, where they all meet); a line long enough to flood the
 * disc once turned 24 times keeps the rosette weight but loses the offset
 * rings first, then thins (never under the catalogue's hairline); a line that
 * never moved becomes a ring of beads.
 */
import { caption, f1, INK } from "../kit";
import { decodeStroke, type CustomSpec, type LineParams } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const CX = 150, CY = 172, R = 112;
/** The catalogue rosette's outer ring weight, and its guilloche's hairline. */
const WEIGHT = 1.4, HAIR = 0.55;
/** The three offset rings: scale, and turn as a share of a sector. */
const RINGS: [number, number][] = [
  [0.9, 1 / 4],
  [0.78, 2 / 4],
  [0.66, 3 / 4],
];
/** The empty middle, as a share of the radius. */
const HOLE = 0.16;
/** Ink the disc takes before the rings go and the line thins (line length × weight, px²). */
const INK_BUDGET = 7200;

/** The stroke fitted to the unit square (0–1 both ways, its shape kept): a link's stroke draws as a drawn one does. */
function normalised(pts: [number, number][]): [number, number][] {
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const [ox, oy] = [(span - (Math.max(...xs) - x0)) / 2, (span - (Math.max(...ys) - y0)) / 2];
  return pts.map(([x, y]) => [(x - x0 + ox) / span, (y - y0 + oy) / span]);
}

/**
 * Path data for the stroke in every sector: across the unit square is out
 * from the ring's inner edge to the rim, down it is across the sector (a
 * wedge, so no copy strays into the next). Mirrored: reflected in the
 * sector's axis. `scale` and `turn` place an offset ring.
 */
function copies(unit: [number, number][], n: number, mirror: boolean, scale: number, turn: number): string {
  let d = "";
  const wedge = ((Math.PI * 2) / n) * 0.92;
  for (let k = 0; k < n; k++)
    for (const flip of mirror ? [1, -1] : [1]) {
      const axis = ((k + turn) / n) * Math.PI * 2 - Math.PI / 2;
      let seg = "";
      let last = "";
      unit.forEach(([x, y], i) => {
        const r = R * scale * (HOLE + (1 - HOLE) * x);
        const a = axis + flip * (y - 0.5) * wedge;
        const q = `${f1(CX + r * Math.cos(a))} ${f1(CY + r * Math.sin(a))}`;
        if (q === last && i > 0) return;
        seg += (i === 0 ? "M" : "L") + q;
        last = q;
      });
      // A stroke that never moved still leaves a mark (round caps draw a dot).
      if (!seg.includes("L")) seg += `L${last}`;
      d += seg;
    }
  return d;
}

export function lineBody(p: LineParams): string {
  const raw = decodeStroke(p.s) ?? [
    [0, 128],
    [255, 128],
  ];
  const mirror = p.m === 1;
  const stroke = (d: string, w: number) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const reach = raw.reduce((m, q) => Math.max(m, Math.hypot(q[0] - raw[0][0], q[1] - raw[0][1])), 0);
  let body = "";
  if (reach < 4) {
    // A line that never moved: a bead in every sector and ring.
    const beads = (scale: number, turn: number, r: number, w: number) => {
      let out = "";
      for (let k = 0; k < p.n; k++) {
        const a = ((k + turn) / p.n) * Math.PI * 2 - Math.PI / 2;
        const rr = R * scale * (HOLE + (1 - HOLE) * 0.6);
        out += `<circle cx="${f1(CX + rr * Math.cos(a))}" cy="${f1(CY + rr * Math.sin(a))}" r="${r}" fill="none" stroke="${INK}" stroke-width="${w}"/>`;
      }
      return out;
    };
    body += beads(1, 0, 9, WEIGHT) + beads(1, 0, 4.5, WEIGHT);
    RINGS.forEach(([scale, turn], i) => (body += beads(scale, turn, 6 - i, WEIGHT * 0.6) + beads(scale, turn, 3 - i * 0.5, HAIR)));
  } else {
    const unit = normalised(raw);
    // Ink the line takes (length × weight), to keep the disc from flooding.
    const length = (sc: number) => {
      let sum = 0;
      for (let i = 1; i < unit.length; i++) {
        const [r0, r1] = [HOLE + (1 - HOLE) * unit[i - 1][0], HOLE + (1 - HOLE) * unit[i][0]];
        const arc = ((unit[i][1] - unit[i - 1][1]) * ((Math.PI * 2) / p.n) * 0.92 * (r0 + r1)) / 2;
        sum += Math.hypot((r1 - r0) * R * sc, arc * R * sc);
      }
      return sum * p.n * (mirror ? 2 : 1);
    };
    const main = length(1);
    const weight = Math.max(HAIR, Math.min(WEIGHT, INK_BUDGET / main));
    body += stroke(copies(unit, p.n, mirror, 1, 0), weight);
    // The offset rings: as many strands each as the ink left allows (a rose engine's phase-shifted cuts), none when the line fills the disc.
    const ringInk = RINGS.reduce((sum, [sc]) => sum + length(sc), 0) * HAIR;
    const strands = Math.min(3, Math.floor((INK_BUDGET - main * weight) / Math.max(1, ringInk)));
    for (const [scale, turn] of RINGS) for (let st = 0; st < strands; st++) body += stroke(copies(unit, p.n, mirror, scale, turn + st * 0.08), HAIR);
  }
  body += `<circle cx="${CX}" cy="${CY}" r="${R + 10}" fill="none" stroke="${INK}" stroke-width="${WEIGHT}"/>`;
  body += `<circle cx="${CX}" cy="${CY}" r="${R + 14}" fill="none" stroke="${INK}" stroke-width="${HAIR}"/>`;
  const title = p.w ?? `${p.n}-fold`;
  return body + caption(338, title, p.w ? `${p.n}-fold${mirror ? ", mirrored" : ""} · one line, turned` : `One line, turned${mirror ? " and mirrored" : ""}`);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(lineBody((spec as { p: LineParams }).p), color);
