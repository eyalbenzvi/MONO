/**
 * Your Dinosaur: a plate in a palaeontology monograph. A double rule round
 * the page, FIG. 1 and the plate's number, the skeleton (data/art/dinosaurs,
 * traced; drawn as one even-odd path), a scale bar in the child's own height
 * (or one child, when the height isn't given), the new name set large in the
 * serif with "n. gen., n. sp." under it, and the caption: the child, the
 * facts, whose restoration the skeleton is.
 */
import { caption, captionLines, line, rect, text, textWidth, type Lines } from "../kit";
import { artFit, artSvg } from "../art";
import { loadArt } from "../data";
import { PLATES, PLATE_INFO, scientificName, type Params } from "../specs/dinosaur";
import type { CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;
/** The skeleton's box. */
const BOX = { x: 30, y: 58, w: 240, h: 168 };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export const artKey = (p: Pick<Params, "k">) => `dinosaurs/${p.k}`;

/** The facts line: discovered, height, diet (each only when given). */
export function factsOf(p: Params): string {
  const parts = [p.y ? `Discovered ${p.y}` : "", p.h ? `Height ${p.h} cm` : "", p.d ? `Diet: ${p.d}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Discovered recently";
}

/** The caption's lines (ours): the child, the facts, whose restoration. */
export function dinosaurCaption(p: Params): Lines {
  return [p.n, factsOf(p), PLATE_INFO[p.k].after];
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

export function dinosaurBody(p: Params, data: RenderData = {}): string {
  let s = rect(16, 20, 268, 298, 1.4) + rect(20, 24, 260, 290, 0.5);
  s += text(30, 40, "FIG. 1", 7, { family: SERIF, anchor: "start", spacing: 1.2 }) + text(270, 40, `PL. ${ROMAN[PLATES.indexOf(p.k)]}`, 7, { family: SERIF, anchor: "end", spacing: 1.2 });
  s += line(30, 46, 270, 46, 0.5);
  const art = data.art?.[artKey(p)];
  let drawnHeight = BOX.h * 0.6;
  if (art) {
    const fit = artFit(art, BOX.x, BOX.y, BOX.w, BOX.h, "bottom");
    drawnHeight = fit.h;
    s += artSvg(art, BOX.x, BOX.y, BOX.w, BOX.h, "bottom");
  }
  s += scaleBar(p, drawnHeight, 240);
  // The name, as large as fits the page, and what it is.
  const name = scientificName(p);
  const size = Math.min(22, 236 / textWidth(name, 1, { family: SERIF }));
  s += text(150, 284, name, Math.round(size * 10) / 10, { family: SERIF });
  s += text(150, 300, "n. gen., n. sp.   Restoration of the skeleton", 6.5, { family: SERIF, spacing: 0.4 });
  return s + caption(346, ...captionLines(dinosaurCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => dinosaurCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => wrap(dinosaurBody((spec as { p: Params }).p, data), color);

/** The skeleton's plate, for the index cards and the bag (the editor passes its own). */
export async function prepare(spec: CustomSpec): Promise<RenderData> {
  const key = artKey((spec as { p: Params }).p);
  return { art: { [key]: await loadArt(key) } };
}
