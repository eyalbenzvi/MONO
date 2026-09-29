/**
 * Your Museum Label: a wall label in the serif, large. A hairline frame with
 * wide margins, the name in bold, the years and the place in brackets, the
 * medium, "Dimensions variable", the credit line, and the accession number
 * from the day at the foot, all set flush left as a gallery sets them.
 */
import { INK, caption, captionLines, line, rect, text, textWidth, type Lines } from "../kit";
import { dayNumber, parseDate } from "../specKit";
import { LABEL_WIDTH, creditFit, mediumFit, type Params } from "../specs/label";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
const X0 = 34, X1 = 266, Y0 = 44, Y1 = 312;
const LEFT = 58, WIDTH = LABEL_WIDTH;

/** The years in brackets: "(b. 1990, Tel Aviv)", "(b. 1990)", "(Tel Aviv)", or none. */
const born = (p: Params) => (p.b || p.pl ? `(${[p.b ? `b. ${p.b}` : "", p.pl ?? ""].filter(Boolean).join(", ")})` : "");

/** The accession number: the year acquired and the day of that year. */
export function accession(d: string): string {
  const [y] = parseDate(d)!;
  const day = dayNumber(d) - dayNumber(`${y}-01-01`) + 1;
  return `${y}.${String(day).padStart(3, "0")}`;
}

/** The caption's lines (ours): the name, what the label is, the accession. */
export function labelCaption(p: Params): Lines {
  return [p.n, "Wall label, permanent collection", p.d ? `Accession no. ${accession(p.d)}` : "Not yet accessioned"];
}

export function labelBody(p: Params): string {
  // The card, and the edge of its mount behind it (a shadow drawn as two rules).
  let s = rect(X0, Y0, X1 - X0, Y1 - Y0, 0.7);
  s += `<path d="M${X0 + 5} ${Y1 + 1.5}H${X1 + 1.5}V${Y0 + 5}M${X0 + 8} ${Y1 + 3.5}H${X1 + 3.5}V${Y0 + 8}" fill="none" stroke="${INK}" stroke-width="1.1"/>`;
  s += text(LEFT, 66, "GALLERY 3", 7.5, { family: SERIF, anchor: "start", spacing: 2 }) + text(X1 - 22, 66, "FAMILY COLLECTION", 7.5, { family: SERIF, anchor: "end", spacing: 1 });
  // The name, as large as it fits one line (at most 26), bold.
  const ns = Math.round(Math.min(26, (26 * WIDTH) / textWidth(p.n, 26, { family: SERIF, bold: true })) * 10) / 10;
  let y = 104;
  s += text(LEFT, y, p.n, ns, { family: SERIF, bold: true, anchor: "start" });
  y += 22;
  const b = born(p);
  if (b) {
    s += text(LEFT, y, b, Math.round(Math.min(13, (13 * WIDTH) / textWidth(b, 13, { family: SERIF }))* 10) / 10, { family: SERIF, anchor: "start" });
    y += 18;
  }
  s += line(LEFT, y, LEFT + 40, y, 0.8);
  y += 30;
  // The medium and the credit: wrapped, at most two lines each.
  const md = mediumFit(p.md)!;
  md.lines.forEach((l, i) => (s += text(LEFT, y + i * md.size * 1.3, l, md.size, { family: SERIF, anchor: "start" })));
  y += md.lines.length * md.size * 1.3 + 4;
  s += text(LEFT, y, "Dimensions variable", 12, { family: SERIF, anchor: "start" });
  // The credit sits on the foot, its last line a rule's height above it.
  if (p.cr) {
    const cr = creditFit(p.cr)!;
    const lead = cr.size * 1.35;
    const top = Y1 - 50 - (cr.lines.length - 1) * lead;
    cr.lines.forEach((l, i) => (s += text(LEFT, top + i * lead, l, cr.size, { family: SERIF, anchor: "start" })));
  }
  // The foot: the accession number, set in the mono as a register's.
  s += line(LEFT, Y1 - 36, X1 - 22, Y1 - 36, 0.4);
  s += text(LEFT, Y1 - 20, p.d ? accession(p.d) : "NOT YET ACCESSIONED", 9, { anchor: "start" }) + text(X1 - 22, Y1 - 20, "PERMANENT COLLECTION", 7, { anchor: "end" });
  return s + caption(344, ...captionLines(labelCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => labelCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(labelBody((spec as { p: Params }).p), color);
