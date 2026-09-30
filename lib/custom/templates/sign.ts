/**
 * Your Sign. The street sign: a rounded plate with a double frame, its bolts
 * and posts, the name in condensed capitals as large as it fits, a small line
 * under it. The round plaque: two rings, the words round its top letter by
 * letter (kit arcText), up to three lines in the serif and a rule. The
 * warning: a triangle drawn as a double band (never a solid ground) holding
 * one of twelve pictograms (draw/pictograms), CAUTION and a line, bare or on
 * a panel.
 */
import { ARC_TRACK, DEG, INK, STROKE, arcText, caption, captionLines, circle, clip, dot, f1, fitSize, line, text, textWidth, type Family, type Lines, house } from "../kit";
import { PICTOGRAM_NAMES, pictogram } from "../draw/pictograms";
import type { Params } from "../specs/sign";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const ROMAN = "roman" as const;

/** The caption's lines (ours). */
export function signCaption(p: Params): Lines {
  if (p.s === "warning") return ["Caution", p.l, `Pictogram: ${PICTOGRAM_NAMES[p.pc!].toLowerCase()}`];
  if (p.s === "plaque") return [p.n, "A round plaque", "Lived here. Still does"];
  return [p.n, p.l ?? "Street sign", "Adopted by no council"];
}

/** A line fitted to a width, tracked `em` of its size: the size (at most `max`, never under `floor`), the tracking, and the line, cut there if it must be. */
function fit(s: string, w: number, max: number, family: Family, bold = false, em = 0, floor = 6) {
  const size = fitSize(s, w, max, { family, bold, track: em, floor });
  const spacing = Math.round(size * em * 100) / 100;
  return { size, spacing, line: clip(s, w, size, { family, bold, spacing }) };
}
/** A fitted line centred on x (nudged by half its tracking, which SVG adds after the last letter too). */
const centred = (x: number, y: number, f: ReturnType<typeof fit>, family: Family, bold = false) =>
  text(x + f.spacing / 2, y, f.line, f.size, { family, bold, spacing: f.spacing || undefined });

/** A rounded rectangle as a path. */
const round = (x0: number, y0: number, x1: number, y1: number, r: number, w: number) =>
  `<path d="M${f1(x0 + r)} ${f1(y0)}H${f1(x1 - r)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + r)}V${f1(y1 - r)}Q${f1(x1)} ${f1(y1)} ${f1(x1 - r)} ${f1(y1)}H${f1(x0 + r)}Q${f1(x0)} ${f1(y1)} ${f1(x0)} ${f1(y1 - r)}V${f1(y0 + r)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + r)} ${f1(y0)}Z" fill="none" stroke="${INK}" stroke-width="${w}"/>`;

function street(p: Params): string {
  const [x0, y0, x1, y1] = [24, 84, 276, 206];
  // The posts behind it, and their feet.
  let s = line(70, y1, 70, 316, 2.2) + line(80, y1, 80, 316, 2.2) + line(220, y1, 220, 316, 2.2) + line(230, y1, 230, 316, 2.2);
  s += line(58, 316, 92, 316, STROKE.regular) + line(208, 316, 242, 316, STROKE.regular);
  s += round(x0, y0, x1, y1, 16, 2.6) + round(x0 + 7, y0 + 7, x1 - 7, y1 - 7, 10, STROKE.regular);
  // Bolts at the ends.
  for (const x of [x0 + 18, x1 - 18]) s += circle(x, (y0 + y1) / 2, 3.4, STROKE.fine) + dot(x, (y0 + y1) / 2, 1);
  const name = fit(p.n!.toUpperCase(), 186, 50, COND, true, 0.03, 9);
  // The name centred optically in its part of the plate (its capitals' middle on cy).
  const cy = p.l ? 146 : 145;
  s += centred(150, cy + (0.81 * name.size) / 2, name, COND, true);
  if (p.l) s += line(96, 172, 204, 172, STROKE.fine) + centred(150, 190, fit(p.l.toUpperCase(), 170, 12, COND, false, 0.08, 6), COND);
  return s;
}

/** The round plaque, as a museum's or a council's: inscriptional capitals (Cinzel) round the top and in the middle. */
function plaque(p: Params): string {
  const [cx, cy, R] = [150, 164, 124];
  let s = circle(cx, cy, R, 2.4) + circle(cx, cy, R - 6, STROKE.fine) + circle(cx, cy, R - 34, STROKE.hairline);
  // The words round the top, as large as the band holds (22), along at most half the ring.
  const arc = p.n!.toUpperCase();
  const r = R - 20;
  const per = textWidth(arc, 1, { family: ROMAN, bold: true }) + [...arc].length * ARC_TRACK;
  const size = Math.max(7, Math.min(20, Math.floor(((Math.PI * r * 0.95) / per) * 10) / 10));
  s += arcText(arc, cx, cy, r, 0, size, true, { family: ROMAN, bold: true });
  // A dot either side, just past where the words end.
  const half = (per * size) / 2 / r / DEG + 7;
  for (const a of [-half, half]) s += dot(cx + r * Math.sin(a * DEG), cy - r * Math.cos(a * DEG), 2.2);
  // The lines in the middle, one size for all (as large as the longest allows, at most 19), between two rules.
  const lines = p.x!.map((l) => l.toUpperCase());
  const fits = lines.map((l) => fit(l, 146, 19, ROMAN, false, 0.04, 7));
  const ls = Math.min(...fits.map((f) => f.size));
  const sets = lines.map((l) => fit(l, 146, ls, ROMAN, false, 0.04, 7));
  const lead = ls * 1.4;
  const top = cy + 8 - ((lines.length - 1) * lead) / 2;
  const capMid = (0.7 * ls) / 2;
  s += line(cx - 40, top - capMid - ls * 1.1, cx + 40, top - capMid - ls * 1.1, STROKE.fine);
  sets.forEach((f, i) => (s += centred(cx, top + i * lead + capMid, f, ROMAN)));
  const foot = top + (lines.length - 1) * lead + capMid + ls * 1.1;
  s += line(cx - 24, foot, cx + 24, foot, STROKE.hairline);
  return s;
}

/** The triangle, point up: centre x, top y, side; as a double band. */
function triangle(cx: number, top: number, side: number): string {
  const h = (side * Math.sqrt(3)) / 2;
  const tri = (inset: number) => {
    // An inset triangle: the incentre is at 2/3 of the height from the top.
    const k = 1 - inset / (h / 3);
    const [ax, ay] = [cx, top + (h * 2) / 3 - ((h * 2) / 3) * k];
    const by = top + (h * 2) / 3 + (h / 3) * k;
    return `M${f1(ax)} ${f1(ay)}L${f1(cx + (side / 2) * k)} ${f1(by)}L${f1(cx - (side / 2) * k)} ${f1(by)}Z`;
  };
  return `<path d="${tri(0)}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/><path d="${tri(11)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
}

function warning(p: Params): string {
  let s = "";
  const panel = p.pn === 1;
  const side = panel ? 172 : 214;
  const top = panel ? 44 : 28;
  if (panel) s += round(34, 24, 266, 318, 14, 2.4) + round(40, 30, 260, 312, 9, STROKE.fine);
  s += triangle(150, top, side);
  const h = (side * Math.sqrt(3)) / 2;
  s += pictogram(p.pc!, 150, top + h * 0.64, side * 0.36, 6);
  const cy = top + h + (panel ? 38 : 44);
  const cs = panel ? 30 : 34;
  s += centred(150, cy, { size: cs, spacing: cs * 0.06, line: "CAUTION" }, COND, true);
  s += centred(150, cy + (panel ? 30 : 34), fit(p.l!.toUpperCase(), panel ? 196 : 230, 16, COND, false, 0.06, 7), COND);
  return s;
}

export function signBody(p: Params): string {
  const body = p.s === "street" ? street(p) : p.s === "plaque" ? plaque(p) : warning(p);
  return body + caption(344, ...captionLines(signCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => signCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(signBody((spec as { p: Params }).p), color));
