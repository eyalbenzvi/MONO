/**
 * Things They Say, in the serif. The sayings: THINGS SAVTA SAYS across the
 * top, each saying under a large opening quotation mark, a signature line at
 * the foot. First words: one word in a speech balloon, the child's name under
 * it and the day, in a hairline frame.
 */
import { INK, caption, dot, captionLines, f1, line, longDate, rect, text, textWidth, type Lines } from "../kit";
import { parseDate } from "../specKit";
import { COLUMN, sayingsFit, type Params } from "../specs/sayings";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;

/** The caption's lines (ours). */
export function sayingsCaption(p: Params): Lines {
  if (p.k === "first") {
    const d = p.d ? parseDate(p.d) : null;
    return [p.n, `First words${d ? ` · ${longDate(...d)}` : ""}`, `“${p.o}”`];
  }
  return [p.n, `${p.x!.length} sayings, word for word`, "Collected at home over the years"];
}

/** The largest size a line sets at to fill a width (capped). */
const sizeFor = (s: string, w: number, max: number, bold = true) => Math.round(Math.min(max, (max * w) / textWidth(s, max, { family: SERIF, bold })) * 10) / 10;

function sayingsList(p: Params): string {
  const head = `THINGS ${p.n.toUpperCase()} SAYS`;
  const hs = sizeFor(head, 222, 20);
  let s = rect(30, 30, 240, 286, 1) + rect(34, 34, 232, 278, 0.4);
  s += text(150, 58, head, hs, { family: SERIF, bold: true, spacing: 0.6 });
  s += line(60, 70, 240, 70, 0.8) + line(84, 73.5, 216, 73.5, 0.4);
  const fit = sayingsFit(p.x!)!;
  const { size } = fit;
  const lead = size * COLUMN.lead;
  const total = fit.fits.reduce((a, f) => a + f.lines.length, 0) * lead + (fit.fits.length - 1) * size * (COLUMN.gap + COLUMN.lead);
  let y = 86 + (COLUMN.h - total) / 2 + size;
  const x = 150 - COLUMN.w / 2 + 16;
  for (const f of fit.fits) {
    // The opening mark hangs in the margin, as large as three lines.
    s += text(x - 10, y + size * 1.3, "“", size * 3.2, { family: SERIF, bold: true, anchor: "end" });
    f.lines.forEach((l, i) => (s += text(x, y + i * lead, l, size, { family: SERIF, anchor: "start" })));
    y += f.lines.length * lead + size * (COLUMN.gap + COLUMN.lead);
  }
  // The signature line.
  s += line(146, 296, 244, 296, 0.6) + text(244, 290, `${p.n}`, 11, { family: SERIF, anchor: "end" }) + text(146, 305, "SIGNED", 5.5, { family: SERIF, anchor: "start", spacing: 1 });
  return s;
}

/** A frame's corner ornament: nested quarter rings and a dot, facing in. */
function corner(x: number, y: number, sx: number, sy: number): string {
  let d = "";
  for (const r of [6, 10, 14]) d += `M${f1(x + sx * r)} ${f1(y)}A${r} ${r} 0 0 ${sx * sy > 0 ? 1 : 0} ${f1(x)} ${f1(y + sy * r)}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".5"/>` + dot(x + sx * 4, y + sy * 4, 1.2);
}

function firstWords(p: Params): string {
  let s = rect(30, 30, 240, 286, 1) + rect(34, 34, 232, 278, 0.4);
  s += corner(38, 38, 1, 1) + corner(262, 38, -1, 1) + corner(38, 308, 1, -1) + corner(262, 308, -1, -1);
  // A row of fine dots between the rules under the name.
  for (let i = 0; i < 21; i++) s += dot(100 + i * 5, 270, 0.6);
  // The balloon: a rounded box as a path, its tail down to the left, the word as large as it fits.
  const word = p.o!;
  const ws = sizeFor(word, 170, 46);
  const bw = Math.max(110, textWidth(word, ws, { family: SERIF, bold: true }) + 44), bh = ws * 1.4 + 34;
  const [x0, y0] = [150 - bw / 2, 132 - bh / 2];
  const [x1, y1] = [x0 + bw, y0 + bh];
  const r = 18;
  const d = `M${f1(x0 + r)} ${f1(y0)}H${f1(x1 - r)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + r)}V${f1(y1 - r)}Q${f1(x1)} ${f1(y1)} ${f1(x1 - r)} ${f1(y1)}H${f1(x0 + bw * 0.42)}L${f1(x0 + bw * 0.22)} ${f1(y1 + 26)}L${f1(x0 + bw * 0.28)} ${f1(y1)}H${f1(x0 + r)}Q${f1(x0)} ${f1(y1)} ${f1(x0)} ${f1(y1 - r)}V${f1(y0 + r)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + r)} ${f1(y0)}Z`;
  s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
  // A second, finer outline inside the box, as a printer's rule doubles.
  const k = 5, rr = r - k;
  s += `<path d="M${f1(x0 + k + rr)} ${f1(y0 + k)}H${f1(x1 - k - rr)}Q${f1(x1 - k)} ${f1(y0 + k)} ${f1(x1 - k)} ${f1(y0 + k + rr)}V${f1(y1 - k - rr)}Q${f1(x1 - k)} ${f1(y1 - k)} ${f1(x1 - k - rr)} ${f1(y1 - k)}H${f1(x0 + k + rr)}Q${f1(x0 + k)} ${f1(y1 - k)} ${f1(x0 + k)} ${f1(y1 - k - rr)}V${f1(y0 + k + rr)}Q${f1(x0 + k)} ${f1(y0 + k)} ${f1(x0 + k + rr)} ${f1(y0 + k)}Z" fill="none" stroke="${INK}" stroke-width=".5"/>`;
  s += text(150, 132 + ws * 0.35, word, ws, { family: SERIF, bold: true });
  // Who said it, and when.
  s += text(150, 222, "FIRST WORDS", 8, { family: SERIF, spacing: 3 });
  const ns = sizeFor(p.n, 200, 30);
  s += text(150, 256, p.n, ns, { family: SERIF, bold: true });
  const d8 = p.d ? parseDate(p.d) : null;
  s += line(96, 266, 204, 266, 0.4) + line(96, 274, 204, 274, 0.4);
  if (d8) s += text(150, 286, longDate(...d8), 9, { family: SERIF });
  return s;
}

export function sayingsBody(p: Params): string {
  return (p.k === "first" ? firstWords(p) : sayingsList(p)) + caption(344, ...captionLines(sayingsCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => sayingsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(sayingsBody((spec as { p: Params }).p), color);
