/**
 * Your Museum Label: a wall label in the serif, large. A hairline frame with
 * wide margins, the name in bold, the years and the place in brackets, the
 * medium, "Dimensions variable", the credit line, and the accession number
 * from the day at the foot, all set flush left as a gallery sets them.
 */
import { INK, STROKE, caption, captionLines, clip, fitSize, fitText, line, rect, text, type Lines, house } from "../kit";
import { dayNumber, parseDate } from "../specKit";
import { LABEL_WIDTH, creditFit, mediumFit, type Params } from "../specs/label";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
const X0 = 34, X1 = 266, Y0 = 44, Y1 = 312;
const LEFT = 58;

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
  let s = rect(X0, Y0, X1 - X0, Y1 - Y0, STROKE.fine);
  s += `<path d="M${X0 + 5} ${Y1 + 1.5}H${X1 + 1.5}V${Y0 + 5}M${X0 + 8} ${Y1 + 3.5}H${X1 + 3.5}V${Y0 + 8}" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}"/>`;
  // The room and the collection: the house mono's tracked capitals, as a register's.
  const tag = 6;
  s += text(LEFT, 66, "GALLERY 3", tag, { anchor: "start", spacing: tag * 0.12 }) + text(X1 - 22, 66, "FAMILY COLLECTION", tag, { anchor: "end", spacing: tag * 0.12 });
  // The name, bold, as large as it fits one line (at most 26); a long name in two lines rather than small, cut only at the floor.
  const NW = X1 - 22 - LEFT;
  let y = 104;
  const one = fitSize(p.n, NW, 26, { family: SERIF, bold: true });
  const two = one < 17 ? fitText(p.n, NW, { size: 22, floor: 15, maxLines: 2, family: SERIF, bold: true }) : null;
  if (two && two.lines.length === 2) {
    y = 96;
    s += text(LEFT, y, two.lines[0], two.size, { family: SERIF, bold: true, anchor: "start" });
    y += two.size * 1.1;
    s += text(LEFT, y, two.lines[1], two.size, { family: SERIF, bold: true, anchor: "start" });
  } else {
    const ns = Math.max(9, one);
    s += text(LEFT, y, clip(p.n, NW, ns, { family: SERIF, bold: true }), ns, { family: SERIF, bold: true, anchor: "start" });
  }
  y += 22;
  const b = born(p);
  if (b) {
    const bs = fitSize(b, NW, 13, { family: SERIF, floor: 7 });
    s += text(LEFT, y, clip(b, NW, bs, { family: SERIF }), bs, { family: SERIF, anchor: "start" });
    y += 18;
  }
  s += line(LEFT, y, LEFT + 40, y, STROKE.fine);
  // The medium and "Dimensions variable" under the rule, the credit on the foot: the air under the rule gives way
  // (30 down to a line's cap), then both step down a size at a time (the medium to 8, the credit to 7) so they never meet.
  const md0 = mediumFit(p.md)!;
  const cr0 = p.cr ? creditFit(p.cr) : null;
  const plan = (k: number) => {
    const md = k ? fitText(p.md, LABEL_WIDTH, { size: Math.max(8, md0.size - k * 0.5), floor: 7, maxLines: 3, family: SERIF }) ?? md0 : md0;
    const cr = cr0 && k ? fitText(p.cr!, LABEL_WIDTH, { size: Math.max(7, cr0.size - k * 0.5), floor: 6, maxLines: 3, family: SERIF }) ?? cr0 : cr0;
    const mdLead = md.size * 1.3;
    const stack = md.lines.length * mdLead + 6;
    const crLead = cr ? cr.size * 1.35 : 0;
    const crTop = cr ? Y1 - 50 - (cr.lines.length - 1) * crLead : Y1 - 36;
    const room = crTop - (cr ? cr.size * 0.8 + 12 : 16) - y - stack;
    return { md, cr, mdLead, stack, crLead, crTop, room, min: md.size * 0.8 + 8 };
  };
  let lay = plan(0);
  for (let k = 1; k <= 12 && lay.room < lay.min; k++) lay = plan(k);
  const { md, cr, mdLead, stack, crLead, crTop } = lay;
  y += Math.max(lay.min, Math.min(30, lay.room));
  md.lines.forEach((l, i) => (s += text(LEFT, y + i * mdLead, l, md.size, { family: SERIF, anchor: "start" })));
  y += stack;
  s += text(LEFT, y, "Dimensions variable", Math.min(12, Math.round(md.size * 8.5) / 10), { family: SERIF, anchor: "start" });
  if (cr) cr.lines.forEach((l, i) => (s += text(LEFT, crTop + i * crLead, l, cr.size, { family: SERIF, anchor: "start" })));
  // The foot: the accession number, set in the mono as a register's.
  s += line(LEFT, Y1 - 36, X1 - 22, Y1 - 36, STROKE.hairline);
  s += (p.d ? text(LEFT, Y1 - 20, accession(p.d), 9, { anchor: "start" }) : text(LEFT, Y1 - 20, "NOT YET ACCESSIONED", tag, { anchor: "start", spacing: tag * 0.12 }));
  s += text(X1 - 22, Y1 - 20, "PERMANENT COLLECTION", tag, { anchor: "end", spacing: tag * 0.12 });
  return s + caption(344, ...captionLines(labelCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => labelCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(labelBody((spec as { p: Params }).p), color));
