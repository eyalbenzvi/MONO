/**
 * Your Sign. The street sign: a rounded plate with a double frame, its bolts
 * and posts, the name in condensed capitals as large as it fits, a small line
 * under it. The round plaque: two rings, the words round its top letter by
 * letter (kit arcText), up to three lines in the serif and a rule. The
 * warning: a triangle drawn as a double band (never a solid ground) holding
 * one of twelve pictograms (draw/pictograms), CAUTION and a line, bare or on
 * a panel.
 */
import { INK, arcText, caption, captionLines, circle, dot, f1, line, text, textWidth, type Family, type Lines } from "../kit";
import { PICTOGRAM_NAMES, pictogram } from "../draw/pictograms";
import type { Params } from "../specs/sign";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const SERIF = "serif" as const;

/** The caption's lines (ours). */
export function signCaption(p: Params): Lines {
  if (p.s === "warning") return ["Caution", p.l, `Pictogram: ${PICTOGRAM_NAMES[p.pc!].toLowerCase()}`];
  if (p.s === "plaque") return [p.n, "A round plaque", "Lived here. Still does"];
  return [p.n, p.l ?? "Street sign", "Adopted by no council"];
}

const fit = (s: string, w: number, max: number, family: Family, bold = false, spacing = 0) =>
  Math.round(Math.min(max, (max * w) / (textWidth(s, max, { family, bold }) + [...s].length * spacing)) * 10) / 10;

/** A rounded rectangle as a path. */
const round = (x0: number, y0: number, x1: number, y1: number, r: number, w: number) =>
  `<path d="M${f1(x0 + r)} ${f1(y0)}H${f1(x1 - r)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + r)}V${f1(y1 - r)}Q${f1(x1)} ${f1(y1)} ${f1(x1 - r)} ${f1(y1)}H${f1(x0 + r)}Q${f1(x0)} ${f1(y1)} ${f1(x0)} ${f1(y1 - r)}V${f1(y0 + r)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + r)} ${f1(y0)}Z" fill="none" stroke="${INK}" stroke-width="${w}"/>`;

function street(p: Params): string {
  const [x0, y0, x1, y1] = [24, 84, 276, 206];
  // The posts behind it, and their feet.
  let s = line(70, y1, 70, 316, 2.2) + line(80, y1, 80, 316, 2.2) + line(220, y1, 220, 316, 2.2) + line(230, y1, 230, 316, 2.2);
  s += line(58, 316, 92, 316, 1.4) + line(208, 316, 242, 316, 1.4);
  s += round(x0, y0, x1, y1, 16, 2.6) + round(x0 + 7, y0 + 7, x1 - 7, y1 - 7, 10, 1.2);
  // Bolts at the ends.
  for (const x of [x0 + 18, x1 - 18]) s += circle(x, (y0 + y1) / 2, 3.4, 1) + dot(x, (y0 + y1) / 2, 1);
  const name = p.n!.toUpperCase();
  const size = fit(name, 186, 50, COND, true, 1.5);
  const cy = p.l ? 150 : 158;
  s += text(150, cy + size * 0.36, name, size, { family: COND, bold: true, spacing: 1.5 });
  if (p.l) s += line(96, 172, 204, 172, 0.8) + text(150, 190, p.l.toUpperCase(), fit(p.l.toUpperCase(), 170, 12, COND, false, 1.2), { family: COND, spacing: 1.2 });
  return s;
}

function plaque(p: Params): string {
  const [cx, cy, R] = [150, 164, 124];
  let s = circle(cx, cy, R, 2.4) + circle(cx, cy, R - 6, 0.8) + circle(cx, cy, R - 34, 0.6);
  // The words round the top, sized to at most half the ring.
  const arc = p.n!.toUpperCase();
  const size = Math.round(Math.min(15, (Math.PI * (R - 20) * 0.95) / (textWidth(arc, 1, { family: SERIF, bold: true }) + arc.length * 0.08)) * 10) / 10;
  s += arcText(arc, cx, cy, R - 20, 0, size, true, { family: SERIF, bold: true });
  // A star either side, where the words end.
  for (const a of [-118, 118]) s += dot(cx + (R - 20) * Math.sin((a * Math.PI) / 180), cy - (R - 20) * Math.cos((a * Math.PI) / 180), 2.4);
  // The lines, and a rule over them.
  const lines = p.x!;
  const ls = Math.min(...lines.map((l) => fit(l, 160, 18, SERIF)));
  const lead = ls * 1.35;
  const top = cy + 10 - ((lines.length - 1) * lead) / 2;
  s += line(cx - 40, top - ls * 1.4, cx + 40, top - ls * 1.4, 1);
  lines.forEach((l, i) => (s += text(cx, top + i * lead + ls * 0.35, l, ls, { family: SERIF })));
  s += line(cx - 24, top + (lines.length - 1) * lead + ls * 1.4, cx + 24, top + (lines.length - 1) * lead + ls * 1.4, 0.6);
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
  if (panel) s += round(34, 24, 266, 318, 14, 2.4) + round(40, 30, 260, 312, 9, 0.8);
  s += triangle(150, top, side);
  const h = (side * Math.sqrt(3)) / 2;
  s += pictogram(p.pc!, 150, top + h * 0.64, side * 0.36, 6);
  const cy = top + h + (panel ? 38 : 44);
  s += text(150, cy, "CAUTION", panel ? 30 : 34, { family: COND, bold: true, spacing: 5 });
  const l = p.l!.toUpperCase();
  s += text(150, cy + (panel ? 30 : 34), l, fit(l, panel ? 196 : 230, 16, COND, false, 1), { family: COND, spacing: 1 });
  return s;
}

export function signBody(p: Params): string {
  const body = p.s === "street" ? street(p) : p.s === "plaque" ? plaque(p) : warning(p);
  return body + caption(344, ...captionLines(signCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => signCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(signBody((spec as { p: Params }).p), color);
