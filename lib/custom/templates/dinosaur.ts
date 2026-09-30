/**
 * Your Dinosaur: a plate in a palaeontology monograph. A double rule round
 * the page, FIG. 1 and the plate's number, the skeleton (drawn in code,
 * lib/custom/draw/dinosaurs, standing on the box's floor), a scale bar in the
 * child's own height (or one child, when the height isn't given), the new
 * name set large in the serif with "n. gen., n. sp." under it, and the
 * caption: the child, the facts, when the animal lived and a remark on it.
 */
import { caption, captionLines, line, rect, text, textWidth, type Lines } from "../kit";
import { dinosaur } from "../draw/dinosaurs";
import { PLATES, PLATE_INFO, scientificName, type Params } from "../specs/dinosaur";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
/** The skeleton's box. */
const BOX = { x: 30, y: 58, w: 240, h: 168 };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** The facts line: discovered, height, diet (each only when given). */
export function factsOf(p: Params): string {
  const parts = [p.y ? `Discovered ${p.y}` : "", p.h ? `Height ${p.h} cm` : "", p.d ? `Diet: ${p.d}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Discovered recently";
}

/** The caption's lines (ours): the child, the facts, when the animal lived and a remark on it. */
export function dinosaurCaption(p: Params): Lines {
  const info = PLATE_INFO[p.k];
  return [p.n, factsOf(p), `${info.period}. ${info.note}`];
}

/**
 * The scale bar under the skeleton: the drawing's height is the child's, so
 * 50 cm is (50 / height) of it, in ticks of 10; without a height, the bar is
 * the drawing's own height and reads one child.
 */
function scaleBar(p: Params, drawnHeight: number, y: number): string {
  const x0 = 34;
  if (!p.h) {
    const len = Math.min(120, drawnHeight);
    return line(x0, y, x0 + len, y, 1.2) + line(x0, y - 3, x0, y + 3, 1) + line(x0 + len, y - 3, x0 + len, y + 3, 1) + text(x0 + len + 5, y + 2.2, "1 CHILD", 6, { anchor: "start", spacing: 1 });
  }
  const unit = drawnHeight / p.h;
  // 50 cm, or 25 when 50 would run wider than the page allows.
  const span = 50 * unit <= 150 ? 50 : 25;
  let s = "";
  const len = span * unit;
  for (let i = 0; i <= span / 10 + 1e-9; i++) {
    const x = x0 + i * 10 * unit;
    s += line(x, y - (i % (span / 10) === 0 ? 3.5 : 2), x, y + (i % (span / 10) === 0 ? 3.5 : 2), 0.9);
    // Alternate tens filled as a thick rule: a surveyor's bar in line work.
    if (i < span / 10) s += line(x, y, x + 10 * unit, y, i % 2 ? 0.6 : 2.2);
  }
  s += text(x0, y + 12, "0", 5.5, { anchor: "middle" }) + text(x0 + len, y + 12, `${span} CM`, 5.5, { anchor: "middle", spacing: 0.6 });
  return s;
}

export function dinosaurBody(p: Params): string {
  let s = rect(16, 20, 268, 298, 1.4) + rect(20, 24, 260, 290, 0.5);
  s += text(30, 40, "FIG. 1", 7, { family: SERIF, anchor: "start", spacing: 1.2 }) + text(270, 40, `PL. ${ROMAN[PLATES.indexOf(p.k)]}`, 7, { family: SERIF, anchor: "end", spacing: 1.2 });
  s += line(30, 46, 270, 46, 0.5);
  const skeleton = dinosaur(p.k, BOX.x, BOX.y, BOX.w, BOX.h);
  s += skeleton.svg + scaleBar(p, skeleton.h, 240);
  // The name, as large as fits the page, and what it is.
  const name = scientificName(p);
  const size = Math.min(22, 236 / textWidth(name, 1, { family: SERIF }));
  s += text(150, 284, name, Math.round(size * 10) / 10, { family: SERIF });
  s += text(150, 300, "n. gen., n. sp.   Restoration of the skeleton", 6.5, { family: SERIF, spacing: 0.4 });
  return s + caption(346, ...captionLines(dinosaurCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => dinosaurCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(dinosaurBody((spec as { p: Params }).p), color);
