/**
 * Limited Editions: a collector's label in the serif. A guilloche border
 * round the whole, LIMITED EDITIONS across the top, the editions numbered
 * one to a row (No., the name, the year after a dotted leader), and a round
 * seal under them with the maker round its top and the year the series began
 * round its foot.
 */
import { INK, arcText, f1, caption, captionLines, circle, line, text, textWidth, type Lines } from "../kit";
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
  // The head.
  s += text(150, 66, "LIMITED EDITIONS", 17.5, { family: SERIF, bold: true, spacing: 2.2 });
  s += line(70, 78, 230, 78, 0.5) + line(92, 81, 208, 81, 0.5);
  s += text(150, 94, "A numbered series, from one maker", 8, { family: SERIF });

  // The editions: pitch by how many, centred in the room above the seal.
  const n = p.x.length;
  const pitch = n > 6 ? 17 : 20;
  const size = n > 6 ? 11 : 12.5;
  const room = [108, 236];
  const top = room[0] + (room[1] - room[0] - (n - 1) * pitch) / 2 + size * 0.35;
  p.x.forEach(([name, year], i) => {
    const y = top + i * pitch;
    s += text(52, y, `No. ${i + 1}`, size * 0.72, { family: SERIF, anchor: "start" });
    const yx = year ? 248 - textWidth(String(year), size * 0.85, { family: SERIF }) - 6 : 248;
    // A long name set smaller, to end before the year.
    const w = textWidth(name, size, { family: SERIF, bold: true });
    const ns = Math.round(Math.min(size, (size * (yx - 96)) / w) * 10) / 10;
    s += text(92, y, name, ns, { family: SERIF, anchor: "start", bold: true });
    const end = 92 + textWidth(name, ns, { family: SERIF, bold: true }) + 6;
    if (yx - end > 8) s += `<path d="M${f1(end)} ${f1(y)}H${f1(yx)}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round" stroke-dasharray="0 3.2"/>`;
    if (year) s += text(248, y, String(year), size * 0.85, { family: SERIF, anchor: "end" });
  });

  // The seal: two rings, the maker along the top, the year along the foot, a star between.
  const cx = 150, cy = 280, R = 30;
  s += circle(cx, cy, R, 1.1) + circle(cx, cy, R - 3, 0.4) + circle(cx, cy, R - 15, 0.6);
  const role = p.r.toUpperCase();
  // The maker along at most a third of the ring.
  const rSize = Math.round(Math.min(7, (Math.PI * (R - 9) * 0.75) / (textWidth(role, 1, { family: SERIF, bold: true }) + role.length * 0.08)) * 10) / 10;
  s += arcText(role, cx, cy, R - 9, 0, rSize, true, { family: SERIF, bold: true });
  s += arcText(p.e ? `EST. ${p.e}` : "THE ORIGINAL", cx, cy, R - 9, 180, 6, false, { family: SERIF });
  s += text(cx, cy + 4, String(n), 12, { family: SERIF, bold: true });
  return s + caption(344, ...captionLines(editionsCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => editionsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(editionsBody((spec as { p: Params }).p), color);
