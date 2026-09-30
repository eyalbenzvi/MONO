/**
 * Your Credits: end credits in the condensed face. A strip of film down each
 * edge (its sprocket holes), A COHEN FAMILY PRODUCTION at the head, the roles
 * set right of the centre line's gap and the names left of it, as credits
 * roll, and the copyright line at the foot.
 */
import { INK, caption, dot, captionLines, f1, line, text, textWidth, type Lines } from "../kit";
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

/** A strip of film's holes down one edge: small rounded boxes, as one path. */
function sprockets(x: number): string {
  let d = "";
  for (let y = 26; y <= 314; y += 11) d += `M${f1(x + 1.2)} ${y}h3.6a1.2 1.2 0 0 1 1.2 1.2v3.6a1.2 1.2 0 0 1-1.2 1.2h-3.6a1.2 1.2 0 0 1-1.2-1.2v-3.6a1.2 1.2 0 0 1 1.2-1.2z`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".7"/>` + line(x - 4, 22, x - 4, 322, 0.5) + line(x + 10, 22, x + 10, 322, 0.5);
}

/** A size that fits a line in a width (capped). */
const fitSize = (s: string, w: number, max: number, bold = false) => Math.round(Math.min(max, (max * w) / textWidth(s, max, { family: COND, bold })) * 10) / 10;

export function creditsBody(p: Params): string {
  let s = sprockets(20) + sprockets(274);
  const head = `A ${p.f.toUpperCase()} FAMILY PRODUCTION`;
  s += text(150, 64, head, fitSize(head, 214, 14, false), { family: COND, spacing: 1.5 });
  // A rule of fine dots under the head, and another over the foot, as a title card's.
  for (let i = 0; i < 25; i++) s += dot(102 + i * 4, 76, 0.55) + dot(102 + i * 4, 306, 0.55);
  s += text(150, 90, "IN ASSOCIATION WITH THE NEIGHBOURS", 6.5, { family: COND, spacing: 1.2 });
  // The credits: pitch by how many, centred in their room.
  const n = p.x.length;
  const pitch = Math.min(28, 172 / Math.max(1, n));
  const size = Math.min(12.5, pitch * 0.62);
  const top = 98 + (172 - pitch * n) / 2 + pitch / 2 + size * 0.35;
  p.x.forEach(([role, name], i) => {
    const y = top + i * pitch;
    const rs = fitSize(role.toUpperCase(), 150 - GAP - 44, size * 0.72);
    const ns = fitSize(name, 150 - GAP - 44, size, true);
    s += text(150 - GAP, y, role.toUpperCase(), rs, { family: COND, anchor: "end", spacing: 0.6 });
    s += text(150 + GAP, y, name, ns, { family: COND, anchor: "start", bold: true });
  });
  s += text(150, 288, "THE END", 15, { family: COND, bold: true, spacing: 4 });
  s += text(150, 298, "FILMED ON LOCATION AT HOME", 6.5, { family: COND, spacing: 1.2 });
  const foot = `© ${p.y ? `${p.y} ` : ""}THE ${p.f.toUpperCase()} FAMILY. ALL RIGHTS RESERVED`;
  s += text(150, 318, foot, fitSize(foot, 214, 7), { family: COND, spacing: 0.8 });
  return s + caption(344, ...captionLines(creditsCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => creditsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(creditsBody((spec as { p: Params }).p), color);
