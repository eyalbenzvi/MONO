/**
 * Your Life in Weeks: 52 weeks across, a year of life a row, 80 or 90 rows,
 * drawn like the catalogue's dot-matrix prints (the Matrix designs' LED
 * grid): a week lived is a dot, a week to come a small ring, so even ninety
 * full years stay a screen of dots and never a slab of ink. A row runs from
 * one birthday to the next (its last week takes the odd day or two). A
 * little air every ten rows marks the decades, numbered down the left;
 * milestones are ringed on their week and named in the margin, their
 * labels pushed apart so they never touch.
 */
import { GROUND } from "../svg";
import { INK, caption, dot, f1, line, text, captionLines, type Lines } from "../kit";
import { titleWords } from "../specKit";
import { parseDate, type CustomSpec } from "../spec";
import { weeksDay, type Params } from "../specs/weeks";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const DAY = 86_400_000;
const TOP = 30, BOTTOM = 318;
/** Extra space after every ten rows, and the label margin a milestone needs. */
const DECADE = 2.6, HALF = 1, QUARTER = 2.6, MARGIN = 54;
const LABEL = 5, LABEL_GAP = 7;

/** A date's cell: the year of life (row) and the week in it (column, the last one taking the odd days). */
export function weekCell(b: string, s: string): [row: number, col: number] {
  const [y, mo, d] = parseDate(b)!;
  const t = Date.UTC(...(parseDate(s)!.map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]));
  let row = Math.floor((t - Date.UTC(y, mo - 1, d)) / (365.2425 * DAY));
  while (row > 0 && Date.UTC(y + row, mo - 1, d) > t) row--;
  while (Date.UTC(y + row + 1, mo - 1, d) <= t) row++;
  return [row, Math.min(51, Math.floor((t - Date.UTC(y + row, mo - 1, d)) / (7 * DAY)))];
}

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The drawing, the caption's lines as ours, and where the caption sits. */
function weeksDraw(p: Params): [string, Lines, number] {
  const rows = p.n;
  const gaps = rows / 10 - 1;
  const pitch = (BOTTOM - TOP - gaps * DECADE - (rows / 10) * HALF) / rows;
  const gridW = 52 * pitch + 3 * QUARTER;
  const marks = p.m ?? [];
  const total = 16 + gridW + (marks.length ? MARGIN : 0);
  const x0 = 150 - total / 2 + 16;
  const cx = (c: number) => x0 + (c + 0.5) * pitch + Math.floor(c / 13) * QUARTER;
  const cy = (r: number) => TOP + (r + 0.5) * pitch + Math.floor(r / 10) * DECADE + Math.floor((r + 5) / 10) * HALF;
  const rDot = pitch * 0.34, rRing = pitch * 0.3, ringW = Math.max(0.4, pitch * 0.14);

  const [nowRow, nowCol] = weekCell(p.b, p.a);
  const lived = nowRow * 52 + nowCol + 1;
  // Dots and rings each as one path of arcs (a 90-year grid is 4,680 marks; the canvas reads arcs in path data as SVG does).
  const disc = (x: number, y: number, r: number) => {
    const d = Math.round(r * 20) / 10;
    return `M${f1(x - d / 2)} ${f1(y)}a${d / 2} ${d / 2} 0 1 0 ${d} 0a${d / 2} ${d / 2} 0 1 0 ${-d} 0`;
  };
  let dots = "", rings = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < 52; c++) {
      if (r * 52 + c < lived) dots += disc(cx(c), cy(r), rDot);
      else rings += disc(cx(c), cy(r), rRing);
    }
  let s = (dots ? `<path d="${dots}" fill="${INK}"/>` : "") + (rings ? `<path d="${rings}" fill="none" stroke="${INK}" stroke-width="${f1(ringW)}"/>` : "");

  // Decades down the left, the weeks along the top.
  for (let k = 10; k < rows; k += 10) s += text(x0 - 3.5, cy(k) + 1.6, String(k), 4.6, { anchor: "end" });
  s += text(x0 - 3.5, cy(0) + 1.6, "0", 4.6, { anchor: "end" });
  for (const c of [1, 13, 26, 39, 52]) s += text(cx(c - 1), TOP - 3.5, String(c), 4.2);
  s += text(x0 - 3.5, TOP - 3.5, "AGE", 3.6, { anchor: "end" });
  s += line(x0, TOP - 1.2, x0 + gridW, TOP - 1.2, 0.4);

  // Milestones: ringed on their week, named in the margin (in date order, pushed apart, kept inside the grid's height).
  if (marks.length) {
    const cells = marks.map(([d]) => weekCell(p.b, d));
    const ys = cells.map(([r]) => cy(r) + 1.7);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + LABEL_GAP);
    const over = ys[ys.length - 1] - (BOTTOM + 1);
    if (over > 0) for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i] - (i === ys.length - 1 ? over : 0), i < ys.length - 1 ? ys[i + 1] - LABEL_GAP : Infinity);
    const edge = x0 + gridW + 2, lx = edge + 12;
    marks.forEach(([, name], i) => {
      const [r, c] = cells[i];
      const [x, y] = [cx(c), cy(r)];
      const ring = pitch * 0.72;
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(ring)}" fill="${GROUND}" stroke="${INK}" stroke-width=".6"/>` + dot(x, y, pitch * 0.24);
      // The row's end, then an elbow out to the label.
      s += `<path d="M${f1(edge)} ${f1(y)}H${f1(edge + 4)}L${f1(lx - 2)} ${f1(ys[i] - 1.7)}" fill="none" stroke="${INK}" stroke-width=".45" stroke-linejoin="round"/>`;
      s += text(lx, ys[i], name, LABEL, { anchor: "start" });
    });
  }

  const span = `${weeksDay(p.b)} – ${weeksDay(p.a)}`;
  return [s, [titleWords(p) ?? "A life in weeks", span, `${thousands(lived)} of ${thousands(rows * 52)} weeks`], 340];
}
/** The caption's lines (ours). */
export const weeksCaption = (p: Params): Lines => weeksDraw(p)[1];

export function weeksBody(p: Params): string {
  const [s, lines, y] = weeksDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => weeksCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(weeksBody((spec as { p: Params }).p), color);
