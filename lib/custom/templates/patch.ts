/**
 * Your Mission Patch: a round patch. A stitched border (a band of short
 * radial stitches, drawn as a hatch between two rings), the mission round the
 * top and the crew round the foot letter by letter (kit arcText), stars
 * between them, one of ten emblems in the middle (draw/emblems) and the day
 * under it.
 */
import { DEG, INK, arcText, caption, captionLines, circle, f1, longDate, shortMonth, text, textWidth, type Lines } from "../kit";
import { EMBLEM_NAMES, emblem } from "../draw/emblems";
import { parseDate } from "../specKit";
import { crewLine, type Params } from "../specs/patch";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const CX = 150, CY = 170, R = 128;

/** The caption's lines (ours). */
export function patchCaption(p: Params): Lines {
  const d = p.d ? parseDate(p.d) : null;
  return [p.m, `Crew of ${p.x.length}${d ? ` · launched ${longDate(...d)}` : ""}`, `Emblem: ${EMBLEM_NAMES[p.e].toLowerCase()}`];
}

/** The stitched border: short stitches round a band, each a little aslant, between two rings. */
function stitches(): string {
  let d = "";
  const n = 150;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360 * DEG;
    const b = a + 1.2 * DEG;
    d += `M${f1(CX + (R - 9) * Math.sin(a))} ${f1(CY - (R - 9) * Math.cos(a))}L${f1(CX + (R - 1.5) * Math.sin(b))} ${f1(CY - (R - 1.5) * Math.cos(b))}`;
  }
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round"/>` + circle(CX, CY, R, 1.4) + circle(CX, CY, R - 11, 1);
}

/** A size for letters round an arc: to fill at most `share` of the circle at radius r (capped). */
const arcSize = (s: string, r: number, share: number, max: number) => Math.round(Math.min(max, (2 * Math.PI * r * share) / (textWidth(s, 1, { family: COND, bold: true }) + [...s].length * 0.08)) * 10) / 10;

export function patchBody(p: Params): string {
  let s = stitches();
  const rText = R - 27;
  const mission = p.m.toUpperCase();
  s += arcText(mission, CX, CY, rText, 0, arcSize(mission, rText, 0.36, 17), true, { family: COND, bold: true });
  const crew = crewLine(p.x);
  s += arcText(crew, CX, CY, rText, 180, arcSize(crew, rText, 0.36, 12), false, { family: COND, bold: true });
  // Stars where the two lines meet, and the inner ring.
  for (const a of [-90, 90]) {
    const [x, y] = [CX + rText * Math.sin(a * DEG), CY - rText * Math.cos(a * DEG)];
    let d = "";
    for (let i = 0; i < 10; i++) {
      const t = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? 2.4 : 6;
      d += `${i ? "L" : "M"}${f1(x + rr * Math.cos(t))} ${f1(y + rr * Math.sin(t))}`;
    }
    s += `<path d="${d}Z" fill="${INK}"/>`;
  }
  s += circle(CX, CY, R - 43, 1.2);
  s += emblem(p.e, CX, CY - 8, 104, 4.5);
  const d = p.d ? parseDate(p.d) : null;
  if (d) s += text(CX, CY + 66, `${d[2]} ${shortMonth(d[1])} ${d[0]}`, 10, { family: COND, bold: true, spacing: 2 });
  return s + caption(344, ...captionLines(patchCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => patchCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(patchBody((spec as { p: Params }).p), color);
