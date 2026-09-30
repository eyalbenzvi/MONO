/**
 * Limited Editions: a collector's label in the serif. A guilloche border
 * round the whole, LIMITED EDITIONS across the top, the editions numbered
 * one to a row (No., the name, the year after a dotted leader), and a round
 * seal under them with the maker round its top and the year the series began
 * round its foot.
 */
import { INK, STROKE, arcText, clip, f1, fitSize, caption, captionLines, circle, line, text, textWidth, type Lines, house } from "../kit";
import { guillocheFrame } from "../draw/ornament";
import type { Params } from "../specs/editions";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
const X0 = 24, X1 = 276, Y0 = 22, Y1 = 322;

/** The caption's lines (ours): the maker and the year, how many and over what years, the house line. */
export function editionsCaption(p: Params): Lines {
  const ys = p.x.flatMap((e) => (e[1] ? [e[1]] : []));
  const n = p.x.length;
  const span = ys.length ? (Math.min(...ys) === Math.max(...ys) ? ` · ${ys[0]}` : ` · ${Math.min(...ys)}–${Math.max(...ys)}`) : "";
  return [p.e ? `${p.r}, est. ${p.e}` : p.r, `${n} ${n === 1 ? "edition" : "editions"}${span}`, "Each one of a kind. None to be reprinted"];
}

export function editionsBody(p: Params): string {
  let s = guillocheFrame({ x0: X0, y0: Y0, x1: X1, y1: Y1, r: 14, band: 9, wave: 9, strands: 3 });
  // The head: the serif's capitals, lightly tracked, over a double rule.
  const head = "LIMITED EDITIONS";
  const hs = fitSize(head, 204, 19, { family: SERIF, track: 0.05 });
  s += text(150, 66, head, hs, { family: SERIF, spacing: Math.round(hs * 0.5) / 10 });
  s += line(70, 78, 230, 78, STROKE.hairline) + line(92, 81, 208, 81, STROKE.hairline);
  s += text(150, 94, "A numbered series, from one maker", 8, { family: SERIF });

  // The editions: the name in the serif, its number and year as data in the house mono; pitch by how many, centred in the room above the seal.
  const n = p.x.length;
  const pitch = n > 6 ? 17 : n > 3 ? 21 : 26;
  const size = n > 6 ? 11.5 : n > 3 ? 13 : 16;
  const label = 6.5, ys = 8;
  const room = [108, 236];
  const top = room[0] + (room[1] - room[0] - (n - 1) * pitch) / 2 + size * 0.35;
  // Each row as set: its name's size and cut, and its year's column.
  const rows = p.x.map(([name, year]) => {
    const yx = year ? 250 - textWidth(String(year), ys) - 8 : 250;
    // A long name set smaller, down to the serif's floor, to end before the year; cut there if it must.
    const ns = fitSize(name, yx - 88, size, { family: SERIF, bold: true, floor: 7 });
    const nm = clip(name, yx - 88, ns, { family: SERIF, bold: true });
    return { nm, ns, year, yx, w: textWidth(nm, ns, { family: SERIF, bold: true }) };
  });
  // Rows with no year end at their names: the block is centred on what it sets, not on the column.
  const right = Math.max(...rows.map((r) => (r.year ? 250 : 88 + r.w)));
  const dx = (250 - right) / 2;
  const [nx, x0, x1] = [50 + dx, 88 + dx, 250 + dx];
  rows.forEach(({ nm, ns, year, yx, w }, i) => {
    const y = top + i * pitch;
    s += text(nx, y, `NO. ${i + 1}`, label, { anchor: "start", spacing: label * 0.12 });
    s += text(x0, y, nm, ns, { family: SERIF, anchor: "start", bold: true });
    const [end, lead] = [x0 + w + 5, yx + dx];
    if (year && lead - end > 8) s += `<path d="M${f1(end)} ${f1(y)}H${f1(lead)}" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linecap="round" stroke-dasharray="0 3.2"/>`;
    if (year) s += text(x1, y, String(year), ys, { anchor: "end" });
  });

  // The seal: two rings, the maker along the top, the year along the foot, the count at its heart.
  const cx = 150, cy = 280, R = 30;
  s += circle(cx, cy, R, STROKE.regular) + circle(cx, cy, R - 3, STROKE.hairline) + circle(cx, cy, R - 15, STROKE.hairline);
  const role = p.r.toUpperCase();
  // The maker along at most a third of the ring, never under the serif's floor (cut there).
  const arc = Math.PI * (R - 9) * 0.8;
  const rSize = fitSize(role, arc, 7, { family: SERIF, bold: true, track: 0.08, floor: 5 });
  const rTxt = clip(role, arc - role.length * 0.08 * rSize, rSize, { family: SERIF, bold: true });
  s += arcText(rTxt, cx, cy, R - 9, 0, rSize, true, { family: SERIF, bold: true });
  s += arcText(p.e ? `EST. ${p.e}` : "THE ORIGINAL", cx, cy, R - 9, 180, 6, false, { family: SERIF });
  s += text(cx, cy + 4.5, String(n), 13, { family: SERIF, bold: true });
  return s + caption(344, ...captionLines(editionsCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => editionsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(editionsBody((spec as { p: Params }).p), color));
