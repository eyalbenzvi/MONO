/**
 * Your Sampler: a Victorian cross-stitch sampler, every stitch an X of two
 * short diagonal strokes on a grid. A border repeated round the edge (turned
 * for the sides, a knot at each corner), the alphabet and the figures in the
 * pixel font, a row of stitches between, the name (twice the size when it
 * fits) and the year, a line of words, and motifs at the foot.
 */
import { INK, STROKE, caption, captionLines, f1, type Lines, house } from "../kit";
import { BORDER_NAMES, BORDER_TILES, MOTIF_GRIDS, MOTIF_NAMES } from "../draw/sampler";
import { pixelTextCells, pixelTextRows } from "../draw/pixelFont";
import { wordRows, type Params } from "../specs/sampler";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const C = 2.8;
const COLS = 90, ROWS = 106;
const X0 = 150 - (COLS * C) / 2, Y0 = 22;

/** The caption's lines (ours). */
export function samplerCaption(p: Params): Lines {
  return [p.n, p.y ? `Worked in ${p.y}` : "Worked by hand, in a manner of speaking", `${BORDER_NAMES[p.b]} border · ${p.mo.map((m) => MOTIF_NAMES[m].toLowerCase()).join(", ")}`];
}

/** The grid of stitches: set cells, then each drawn as an X. */
class Cloth {
  on = new Set<number>();
  set(c: number, r: number) {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) this.on.add(r * COLS + c);
  }
  /** Rows of X and dots, at a cell, each pattern cell `scale` cells square. */
  put(rows: readonly string[], c0: number, r0: number, scale = 1) {
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== "X") return;
      for (let i = 0; i < scale; i++) for (let j = 0; j < scale; j++) this.set(c0 + c * scale + i, r0 + r * scale + j);
    }));
  }
  stitches(): string {
    let d = "";
    const k = C * 0.82, m = (C - k) / 2;
    for (const i of [...this.on].sort((a, b) => a - b)) {
      const [c, r] = [i % COLS, Math.floor(i / COLS)];
      const [x, y] = [X0 + c * C + m, Y0 + r * C + m];
      d += `M${f1(x)} ${f1(y)}l${f1(k)} ${f1(k)}M${f1(x + k)} ${f1(y)}l${f1(-k)} ${f1(k)}`;
    }
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline + 0.1}" stroke-linecap="round"/>`;
  }
}

/** A text row centred on the cloth. */
const centred = (cloth: Cloth, s: string, r0: number, scale = 1) => cloth.put(pixelTextRows(s), Math.floor((COLS - pixelTextCells(s) * scale) / 2), r0, scale);

export function samplerBody(p: Params): string {
  const cloth = new Cloth();
  // The border: the tile along the top and the bottom (mirrored), turned down the sides.
  const tile = BORDER_TILES[p.b];
  const tw = tile[0].length;
  for (let c = 3; c < COLS - 3; c++) for (let r = 0; r < 3; r++) {
    if (tile[r][(c - 3) % tw] === "X") {
      cloth.set(c, r);
      cloth.set(c, ROWS - 1 - r);
    }
  }
  for (let r = 3; r < ROWS - 3; r++) for (let c = 0; c < 3; c++) {
    if (tile[c][(r - 3) % tw] === "X") {
      cloth.set(c, r);
      cloth.set(COLS - 1 - c, r);
    }
  }
  const knot = ["X.X", ".X.", "X.X"];
  for (const [c, r] of [[0, 0], [COLS - 3, 0], [0, ROWS - 3], [COLS - 3, ROWS - 3]]) cloth.put(knot, c, r);
  // The alphabet and the figures.
  centred(cloth, "ABCDEFGHIJKLM", 6);
  centred(cloth, "NOPQRSTUVWXYZ", 15);
  centred(cloth, "1234567890", 24);
  // A row of stitches between, every other cell.
  for (let c = 8; c < COLS - 8; c += 2) cloth.set(c, 34);
  // The name (twice the size when it fits), the year and the words: one block, centred in the cloth between the
  // row of stitches and the motifs, with a second row over the motifs when there is room for it.
  const name = p.n.toUpperCase();
  const big = pixelTextCells(name) * 2 <= COLS - 10;
  const words = p.w ? wordRows(p.w)! : [];
  const mr = ROWS - 5 - 11;
  const block = (big ? 14 : 7) + (p.y ? 10 : 0) + words.length * 9 + (p.y || words.length ? 3 : 0);
  const [top, foot] = [37, mr - 6];
  const room = foot - top - block;
  let r = top + Math.max(0, Math.floor(room / 2));
  if (room >= 6) for (let c = 8; c < COLS - 8; c += 2) cloth.set(c, mr - 4);
  centred(cloth, name, r, big ? 2 : 1);
  r += (big ? 14 : 7) + 3;
  if (p.y) {
    centred(cloth, String(p.y), r);
    r += 10;
  }
  for (const row of words) {
    centred(cloth, row, r);
    r += 9;
  }
  // The motifs at the foot: one in the middle, two in the corners, three all.
  const at = p.mo.length === 1 ? [Math.floor((COLS - 11) / 2)] : p.mo.length === 2 ? [6, COLS - 17] : [6, Math.floor((COLS - 11) / 2), COLS - 17];
  p.mo.forEach((m, i) => cloth.put(MOTIF_GRIDS[m], at[i], mr));
  return cloth.stitches() + caption(348, ...captionLines(samplerCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => samplerCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(samplerBody((spec as { p: Params }).p), color));
