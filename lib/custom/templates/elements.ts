/**
 * Your Name in Elements: the word spelled in symbols (lib/custom/draw/
 * elementsSpell), set like the catalogue's Type prints and its Periodic
 * Table: the whole table small at the top with the word's elements drawn
 * bold in their places, then the word itself as a row of the table's own
 * tiles (atomic number, symbol, name), wrapping to a second row past six.
 * A letter no symbol covers (the editor never offers such a word) is drawn
 * as a dashed empty tile, so the print still says plainly what's missing.
 */
import { INK, caption, f1, line, rect, text, captionLines, type Lines } from "../kit";
import { ELEMENTS, type Element } from "../draw/elements";
import { spell, type Tile } from "../draw/elementsSpell";
import type { Params } from "../specs/elements";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";
import type { CustomSpec } from "../spec";

/** The table's cell for an element: [row, column]; the lanthanides and actinides in two rows below, as printed tables set them. */
function cell([z, , , group, period]: Element): [number, number] {
  if (group > 0) return [period - 1, group - 1];
  return [period === 6 ? 7.4 : 8.4, 2 + z - (period === 6 ? 57 : 89)];
}

function miniTable(used: Set<number>): string {
  const cw = 12.4, ch = 11, x0 = 150 - (18 * cw) / 2, y0 = 34;
  let s = "";
  for (const e of ELEMENTS) {
    const [r, c] = cell(e);
    const x = x0 + c * cw, y = y0 + r * ch;
    if (used.has(e[0])) s += rect(x + 0.9, y + 0.9, cw - 1.8, ch - 1.8, 1.2) + text(x + cw / 2, y + ch / 2 + 1.8, e[1], 5.2, { bold: true });
    else s += rect(x + 1.2, y + 1.2, cw - 2.4, ch - 2.4, 0.5);
  }
  return s;
}

const dashed = (x: number, y: number, w: number, h: number, width: number) =>
  `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-dasharray="4 3"/>`;

/** PubChem writes the American spellings; the print takes IUPAC's own (and the shop's British). */
const IUPAC: Record<string, string> = { Aluminum: "Aluminium", Cesium: "Caesium" };

function tile(t: Tile, x: number, y: number, w: number, h: number): string {
  const nameSize = (name: string) => Math.min(w * 0.13, (w - 8) / (0.602 * name.length));
  if ("miss" in t) return dashed(x, y, w, h, 1) + text(x + w / 2, y + h * 0.58, t.miss, w * 0.4) + text(x + w / 2, y + h - h * 0.12, "no element", nameSize("no element"));
  const [z, sym, us] = t.el;
  const name = IUPAC[us] ?? us;
  let s = rect(x, y, w, h, 1.3);
  s += text(x + w * 0.09, y + w * 0.2, String(z), w * 0.15, { anchor: "start" });
  s += text(x + w / 2, y + h * 0.62, sym, w * 0.44, { bold: true });
  s += text(x + w / 2, y + h - h * 0.12, name, nameSize(name));
  return s;
}

/** The drawing, the caption's lines as ours, and where the caption sits. */
function elementsDraw(p: Params): [string, Lines, number] {
  const tiles = spell(p.x);
  const els = tiles.flatMap((t) => ("el" in t ? [t.el] : []));
  let s = miniTable(new Set(els.map((e) => e[0])));
  // A rule between the table and the word, as the Type prints rule under a head.
  s += line(40, 152, 260, 152, 0.8);
  const rows = tiles.length > 6 ? 2 : 1;
  const per = Math.ceil(tiles.length / rows);
  const gap = 4;
  const w = Math.min(78, (252 - (per - 1) * gap) / per);
  const h = w * 1.18;
  const top = 164, bottom = 314;
  const y0 = top + (bottom - top - (rows * h + (rows - 1) * gap * 2)) / 2;
  for (let r = 0; r < rows; r++) {
    const row = tiles.slice(r * per, (r + 1) * per);
    const x0 = 150 - (row.length * w + (row.length - 1) * gap) / 2;
    row.forEach((t, i) => (s += tile(t, x0 + i * (w + gap), y0 + r * (h + gap * 2), w, h)));
  }
  const symbols = tiles.map((t) => ("el" in t ? t.el[1] : "?")).join(" · ");
  const gaps = tiles.filter((t) => "miss" in t).map((t) => (t as { miss: string }).miss);
  const sub2 = gaps.length ? `No element for ${[...new Set(gaps)].join(", ")}` : `${els.length} elements · ${els.reduce((a, e) => a + e[0], 0)} protons`;
  return [s, [p.x, symbols, sub2], 338];
}
/** The caption's lines (ours). */
export const elementsCaption = (p: Params): Lines => elementsDraw(p)[1];

/** The print's body (white ink, unwrapped). */
export function elementsBody(p: Params): string {
  const [s, lines, y] = elementsDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => elementsCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(elementsBody((spec as { p: Params }).p), color);
