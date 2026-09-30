/**
 * Things They Say, in the serif. The sayings: THINGS SAVTA SAYS across the
 * top, each saying under a large opening quotation mark, a signature line at
 * the foot. First words: one word in a speech balloon, the child's name under
 * it and the day, in a hairline frame.
 */
import { INK, STROKE, caption, clip, dot, captionLines, f1, fitSize, fitText, line, longDate, rect, text, textWidth, type Family, type Fit, type Lines, house } from "../kit";
import { parseDate } from "../specKit";
import { COLUMN, sayingsFit, type Params } from "../specs/sayings";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
const DISPLAY = "display" as const;

/** The caption's lines (ours). */
export function sayingsCaption(p: Params): Lines {
  if (p.k === "first") {
    const d = p.d ? parseDate(p.d) : null;
    return [p.n, `First words${d ? ` · ${longDate(...d)}` : ""}`, `“${p.o}”`];
  }
  return [p.n, `${p.x!.length} sayings, word for word`, "Collected at home over the years"];
}

/** The sayings' column: its top, and the room Playfair has (the spec's COLUMN, less air over the signature). */
const TOP = 86, ROOM = COLUMN.h - 8;
/** The air between two sayings, in their size (a little tighter than the spec's, as the display face sets closer). */
const GAP = 0.75;

/**
 * The sayings as set: in Playfair Display when they fit at its display sizes
 * (17 down to 14), else in the reading serif at the size the spec fitted
 * (its lines are measured in the wider serif, so they always set).
 */
function sayingsSet(x: readonly string[]): { face: Family; size: number; fits: Fit[] } {
  for (let size = 17; size >= 14; size -= 0.5) {
    const fits = x.map((t) => fitText(t, COLUMN.w, { size, floor: size, maxLines: 3, family: DISPLAY }));
    if (fits.some((f) => !f)) continue;
    const lines = fits.reduce((a, f) => a + f!.lines.length, 0);
    if (lines * size * COLUMN.lead + (x.length - 1) * size * (GAP + COLUMN.lead - 1) <= ROOM) return { face: DISPLAY, size, fits: fits as Fit[] };
  }
  const fit = sayingsFit(x)!;
  return { face: SERIF, ...fit };
}

function sayingsList(p: Params): string {
  let s = rect(30, 30, 240, 286, STROKE.regular) + rect(34, 34, 232, 278, STROKE.hairline);
  const { face, size, fits } = sayingsSet(p.x!);
  // The head: "Things Savta says", the name in bold, in the sayings' face (display sizes when it is Playfair).
  const [a, b] = ["Things ", " says"];
  const wOf = (hs: number, name: string) => textWidth(a, hs, { family: face }) + textWidth(name, hs, { family: face, bold: true }) + textWidth(b, hs, { family: face });
  const floor = face === DISPLAY ? 14 : 9;
  const hs = Math.max(floor, Math.floor(Math.min(26, (26 * 204) / wOf(26, p.n)) * 10) / 10);
  const name = clip(p.n, 204 - textWidth(a + b, hs, { family: face }), hs, { family: face, bold: true });
  const hw = wOf(hs, name);
  let hx = 150 - hw / 2;
  const hy = 64;
  s += text(hx, hy, a.trimEnd(), hs, { family: face, anchor: "start" });
  hx += textWidth(a, hs, { family: face });
  s += text(hx, hy, name, hs, { family: face, bold: true, anchor: "start" });
  hx += textWidth(name, hs, { family: face, bold: true });
  s += text(hx + textWidth(" ", hs, { family: face }), hy, b.trim(), hs, { family: face, anchor: "start" });
  s += line(66, 75, 234, 75, STROKE.fine) + line(92, 78.5, 208, 78.5, STROKE.hairline);

  // The sayings, each under an opening mark hung in the margin; the block centred in its room.
  const lead = size * COLUMN.lead;
  const gap = size * ((face === DISPLAY ? GAP : COLUMN.gap) + COLUMN.lead - (face === DISPLAY ? 1 : 0));
  const total = fits.reduce((t, f) => t + f.lines.length, 0) * lead + (fits.length - 1) * gap;
  let y = TOP + ((face === DISPLAY ? ROOM : COLUMN.h) - total) / 2 + size;
  const widest = Math.max(...fits.flatMap((f) => f.lines.map((l) => textWidth(l, size, { family: face }))));
  // Flush left, the column centred on its widest line (the marks hang outside it).
  const x = 150 - widest / 2 + 6;
  for (const f of fits) {
    s += text(x - size * 0.22, y + size * 1.05, "“", size * 2.6, { family: DISPLAY, bold: true, anchor: "end" });
    f.lines.forEach((l, i) => (s += text(x, y + i * lead, l, size, { family: face, anchor: "start" })));
    y += f.lines.length * lead + gap;
  }
  // The signature: the name over a rule, SIGNED under it as a label.
  const ss = face === DISPLAY ? fitSize(p.n, 100, 15, { family: DISPLAY, floor: 14 }) : fitSize(p.n, 100, 11, { family: SERIF, floor: 7 });
  s += line(146, 296, 244, 296, STROKE.hairline) + text(244, 291, clip(p.n, 100, ss, { family: face }), ss, { family: face, anchor: "end" });
  s += text(146, 304.5, "SIGNED", 5, { anchor: "start", spacing: 0.6 });
  return s;
}

/** A frame's corner ornament: nested quarter rings and a dot, facing in. */
function corner(x: number, y: number, sx: number, sy: number): string {
  let d = "";
  for (const r of [6, 10, 14]) d += `M${f1(x + sx * r)} ${f1(y)}A${r} ${r} 0 0 ${sx * sy > 0 ? 1 : 0} ${f1(x)} ${f1(y + sy * r)}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>` + dot(x + sx * 4, y + sy * 4, 1.2);
}

function firstWords(p: Params): string {
  let s = rect(30, 30, 240, 286, STROKE.regular) + rect(34, 34, 232, 278, STROKE.hairline);
  s += corner(38, 38, 1, 1) + corner(262, 38, -1, 1) + corner(38, 308, 1, -1) + corner(262, 308, -1, -1);
  // A row of fine dots between the rules under the name.
  for (let i = 0; i < 21; i++) s += dot(100 + i * 5, 270, 0.6);
  // The balloon: a rounded box as a path, its tail down to the left, the word in Playfair as large as it fits.
  const ws = fitSize(p.o!, 184, 48, { family: DISPLAY, bold: true, floor: 14 });
  const word = clip(p.o!, 184, ws, { family: DISPLAY, bold: true });
  const ww = textWidth(word, ws, { family: DISPLAY, bold: true });
  const bw = Math.max(110, ww + Math.min(46, 226 - ww)), bh = ws * 1.4 + 34;
  const [x0, y0] = [150 - bw / 2, 128 - bh / 2];
  const [x1, y1] = [x0 + bw, y0 + bh];
  const r = 18;
  const d = `M${f1(x0 + r)} ${f1(y0)}H${f1(x1 - r)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + r)}V${f1(y1 - r)}Q${f1(x1)} ${f1(y1)} ${f1(x1 - r)} ${f1(y1)}H${f1(x0 + bw * 0.42)}L${f1(x0 + bw * 0.22)} ${f1(y1 + 24)}L${f1(x0 + bw * 0.28)} ${f1(y1)}H${f1(x0 + r)}Q${f1(x0)} ${f1(y1)} ${f1(x0)} ${f1(y1 - r)}V${f1(y0 + r)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + r)} ${f1(y0)}Z`;
  s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.bold}" stroke-linejoin="round"/>`;
  // A second, finer outline inside the box, as a printer's rule doubles.
  const k = 5, rr = r - k;
  s += `<path d="M${f1(x0 + k + rr)} ${f1(y0 + k)}H${f1(x1 - k - rr)}Q${f1(x1 - k)} ${f1(y0 + k)} ${f1(x1 - k)} ${f1(y0 + k + rr)}V${f1(y1 - k - rr)}Q${f1(x1 - k)} ${f1(y1 - k)} ${f1(x1 - k - rr)} ${f1(y1 - k)}H${f1(x0 + k + rr)}Q${f1(x0 + k)} ${f1(y1 - k)} ${f1(x0 + k)} ${f1(y1 - k - rr)}V${f1(y0 + k + rr)}Q${f1(x0 + k)} ${f1(y0 + k)} ${f1(x0 + k + rr)} ${f1(y0 + k)}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;
  s += text(150, 128 + ws * 0.36, word, ws, { family: DISPLAY, bold: true });
  // Who said it, and when: a tracked label, the name in Playfair, the day as data.
  s += text(150, 222, "FIRST WORDS", 6.5, { spacing: 0.8 });
  const ns = fitSize(p.n, 196, 32, { family: DISPLAY, bold: true, floor: 14 });
  s += text(150, 256, clip(p.n, 196, ns, { family: DISPLAY, bold: true }), ns, { family: DISPLAY, bold: true });
  const d8 = p.d ? parseDate(p.d) : null;
  s += line(96, 266, 204, 266, STROKE.hairline) + line(96, 274, 204, 274, STROKE.hairline);
  if (d8) s += text(150, 288, longDate(...d8).toUpperCase(), 6.5, { spacing: 0.8 });
  return s;
}

export function sayingsBody(p: Params): string {
  return (p.k === "first" ? firstWords(p) : sayingsList(p)) + caption(344, ...captionLines(sayingsCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => sayingsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(sayingsBody((spec as { p: Params }).p), color));
