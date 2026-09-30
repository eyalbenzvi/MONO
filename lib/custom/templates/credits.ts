/**
 * Your Credits: end credits in the condensed face. A strip of film down each
 * edge (its sprocket holes), A COHEN FAMILY PRODUCTION at the head, the roles
 * set right of the centre line's gap and the names left of it, as credits
 * roll, and the copyright line at the foot.
 */
import { INK, STROKE, caption, clip, dot, captionLines, f1, fitSize as fit, line, text, type Lines, house } from "../kit";
import type { Params } from "../specs/credits";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const GAP = 7;

/** The caption's lines (ours). */
export function creditsCaption(p: Params): Lines {
  const n = p.x.length;
  return [`The ${p.f} family`, `${n} ${n === 1 ? "credit" : "credits"}${p.y ? ` · ${p.y}` : ""}`, "No animals were harmed. The dog disputes this"];
}

/** A strip of film's holes down one edge (its outer edge at x, inward by `dir`): small rounded boxes, as one path, between two rules. */
function sprockets(x: number, dir: 1 | -1): string {
  const hx = dir > 0 ? x + 3.5 : x - 9.5;
  let d = "";
  for (let y = 27; y <= 313; y += 11) d += `M${f1(hx + 1.2)} ${y}h3.6a1.2 1.2 0 0 1 1.2 1.2v3.6a1.2 1.2 0 0 1-1.2 1.2h-3.6a1.2 1.2 0 0 1-1.2-1.2v-3.6a1.2 1.2 0 0 1 1.2-1.2z`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}"/>` + line(x, 22, x, 322, STROKE.hairline) + line(x + dir * 13, 22, x + dir * 13, 322, STROKE.hairline);
}

/** A line of the condensed face fitted to a width: its size (tracked `em`, at most `max`, never under `floor`) and the line, cut there if it must be. */
function fitLine(s: string, w: number, max: number, em: number, bold = false, floor = 5) {
  const size = fit(s, w, max, { family: COND, bold, track: em, floor });
  const spacing = Math.round(size * em * 100) / 100;
  return { size, spacing, line: clip(s, w, size, { family: COND, bold, spacing }) };
}

export function creditsBody(p: Params): string {
  // The film's edges inside the live area (x 22–278), the credits between them.
  let s = sprockets(22, 1) + sprockets(278, -1);
  const head = fitLine(`A ${p.f.toUpperCase()} FAMILY PRODUCTION`, 206, 15, 0.08);
  s += text(150 + head.spacing / 2, 64, head.line, head.size, { family: COND, spacing: head.spacing });
  // A rule of fine dots under the head, and another over the foot, as a title card's.
  for (let i = 0; i < 25; i++) s += dot(102 + i * 4, 76, 0.55) + dot(102 + i * 4, 306, 0.55);
  s += text(150 + 0.39, 90, "IN ASSOCIATION WITH THE NEIGHBOURS", 6.5, { family: COND, spacing: 0.78 });
  // The credits: pitch by how many, centred in their room; the role in light capitals right of the axis, the name bold left of it.
  const n = p.x.length;
  const pitch = Math.min(30, 166 / Math.max(1, n));
  const size = Math.min(14, pitch * 0.62);
  const top = 97 + (166 - pitch * n) / 2 + pitch / 2 + size * 0.35;
  const half = 150 - GAP - 42;
  p.x.forEach(([role, name], i) => {
    const y = top + i * pitch;
    const r = fitLine(role.toUpperCase(), half, size * 0.66, 0.1, false, 5);
    const nm = fitLine(name, half, size, 0.01, true, 5);
    s += text(150 - GAP, y, r.line, r.size, { family: COND, anchor: "end", spacing: r.spacing });
    s += text(150 + GAP, y, nm.line, nm.size, { family: COND, anchor: "start", bold: true, spacing: nm.spacing });
  });
  s += text(150 + 0.75, 288, "THE END", 16, { family: COND, bold: true, spacing: 1.5 });
  s += text(150 + 0.39, 298, "FILMED ON LOCATION AT HOME", 6.5, { family: COND, spacing: 0.78 });
  const foot = fitLine(`© ${p.y ? `${p.y} ` : ""}THE ${p.f.toUpperCase()} FAMILY. ALL RIGHTS RESERVED`, 206, 6.5, 0.1);
  s += text(150 + foot.spacing / 2, 318, foot.line, foot.size, { family: COND, spacing: foot.spacing });
  return s + caption(344, ...captionLines(creditsCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => creditsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(creditsBody((spec as { p: Params }).p), color));
