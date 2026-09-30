/**
 * Your Birth Announcement: a 1950s card in the serif. A fine double border
 * with stars at its corners, IT'S A GIRL between two rules of dots, the name
 * as large as it fits, a table of the day, the time, the weight, the length
 * and the place with dot leaders, and that night's moon (lib/custom/astro)
 * when wanted.
 */
import { moonPhase } from "../astro";
import { INK, caption, captionLines, dot, f1, julian, line, longDate, rect, text, textWidth, type Lines } from "../kit";
import { parseDate, parseTime } from "../specKit";
import { lengthText, weightText, type Params } from "../specs/birth";
import { loadCities } from "../data";
import type { City, CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { moonShape } from "./moon";
import { rosette } from "../draw/ornament";
import { phaseName } from "./night";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
const HEAD: Record<Params["h"], string> = { girl: "IT’S A GIRL", boy: "IT’S A BOY", hello: "HELLO, WORLD" };

/** That night's moon: its phase at the time given (else the evening), as the dated products take it. */
function moonOf(p: Params) {
  const [y, mo, d] = parseDate(p.d)!;
  const [h, mi] = p.t ? parseTime(p.t)! : [20, 0];
  return moonPhase(julian(y, mo, d, h + mi / 60, 0));
}

/** The caption's lines (ours). */
export function birthCaption(p: Params, city?: City): Lines {
  const d = parseDate(p.d)!;
  const facts = [weightText(p), lengthText(p)].filter(Boolean).join(" · ");
  return [p.n, [longDate(...d), city?.name].filter(Boolean).join(" · "), facts || (p.mo ? `Born under a ${phaseName(moonOf(p).k, moonOf(p).waxing).toLowerCase()}` : "Announced with some pride")];
}

/** A small star, as one path (the corners). */
function star(cx: number, cy: number, r: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? "L" : "M"}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`;
  }
  return `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>`;
}

export function birthBody(p: Params, city?: City): string {
  let s = rect(28, 24, 244, 296, 1.2) + rect(33, 29, 234, 286, 0.4);
  for (const [x, y] of [[42, 38], [258, 38], [42, 306], [258, 306]]) s += star(x, y, 7) + star(x, y, 3);
  // The head between rules of dots.
  const head = HEAD[p.h];
  s += text(150, 66, head, 15, { family: SERIF, bold: true, spacing: 2.5 });
  for (let i = 0; i < 27; i++) s += dot(98 + i * 4, 50, 0.8) + dot(98 + i * 4, 76, 0.8);
  // The name, as large as it fits.
  const ns = Math.round(Math.min(44, (44 * 210) / textWidth(p.n, 44, { family: SERIF, bold: true })) * 10) / 10;
  s += text(150, 124, p.n, ns, { family: SERIF, bold: true });
  s += line(110, 140, 190, 140, 0.6);
  // The table.
  const [y, mo, d] = parseDate(p.d)!;
  // Every row, as a printed card has them: a blank one left to the rule.
  const rows: [string, string][] = [["Born", longDate(y, mo, d)], ["At", p.t ?? ""], ["Weighing", weightText(p)], ["Length", lengthText(p)], ["In", city?.name ?? ""]];
  const withMoon = p.mo === 1;
  const room: [number, number] = [158, 246];
  const pitch = Math.min(20, (room[1] - room[0]) / rows.length);
  const top = room[0] + (room[1] - room[0] - pitch * (rows.length - 1)) / 2;
  rows.forEach(([k, v], i) => {
    const ry = top + i * pitch;
    const vs = v ? Math.round(Math.min(12, (12 * 110) / textWidth(v, 12, { family: SERIF })) * 10) / 10 : 12;
    s += text(62, ry, k.toUpperCase(), 7.5, { family: SERIF, anchor: "start", spacing: 1.5 });
    if (v) s += text(238, ry, v, vs, { family: SERIF, anchor: "end" });
    const x0 = 62 + textWidth(k.toUpperCase(), 7.5, { family: SERIF }) + k.length * 1.5 + 6;
    const x1 = v ? 238 - textWidth(v, vs, { family: SERIF }) - 6 : 238;
    if (x1 - x0 > 6) s += `<path d="M${f1(x0)} ${f1(ry)}H${f1(x1)}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="0 3"/>`;
  });
  if (withMoon) {
    const { k, waxing } = moonOf(p);
    s += moonShape(150, 272, 13, k, waxing) + text(150, 298, `The moon that night: ${phaseName(k, waxing).toLowerCase()}`, 7, { family: SERIF });
  } else {
    // No moon: a star rosette in its place, as the card's printer would set one.
    s += rosette({ n: 9, circles: [true, false], cx: 150, cy: 274, r: 20, depth: 12 });
  }
  return s + caption(344, ...captionLines(birthCaption(p, city), p.cap));
}

export const captionOf = (spec: CustomSpec, data: RenderData = {}) => birthCaption((spec as { p: Params }).p, data.city);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => wrap(birthBody((spec as { p: Params }).p, data.city), color);

/** The place, for the index cards and the bag (the editor passes its own). */
export async function prepare(spec: CustomSpec): Promise<RenderData> {
  const c = (spec.p as Params).c;
  return c === undefined ? {} : { city: (await loadCities()).byId(c) };
}
