/**
 * Your Crossword: your people's names built into one crossword
 * (lib/custom/draw/crossword), set like the catalogue's Type prints (the
 * type-data variant): a plain grid of open cells, each name's first cell
 * numbered in reading order, as a newspaper numbers its lights; no black
 * squares (a crossword's blocks would print as a slab of ink), only the
 * cells the names use. The names print filled in, bold, or (`h: 1`) the
 * grid is left blank and the names are listed under it by length, to be
 * fitted back in. A name that crosses no other sits a cell clear, on its own.
 */
import { INK, caption, f1, text } from "../kit";
import { buildCrossword, type Crossword } from "../draw/crossword";
import type { CustomSpec } from "../spec";
import { crossNames, type Params } from "../specs/crossword";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** The grid's area (above the caption; less when the names are listed under it). */
const AREA = { x: 26, y: 26, w: 248, h: 280 };
const LISTED_H = 226;
/** The largest cell (a short list shouldn't set letters like a poster). */
const MAX_CELL = 40;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Standard numbering: every cell that starts a word, in reading order. */
function numbering(cw: Crossword): Map<string, number> {
  const starts = [...new Set(cw.placed.map((p) => `${p.r},${p.c}`))].map((k) => k.split(",").map(Number) as [number, number]);
  starts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return new Map(starts.map(([r, c], i) => [`${r},${c}`, i + 1]));
}

/** Words as lines of about `max` characters: "3 NOA · 4 ELLA RUTH · …", by length. */
function listLines(words: string[], max: number): string[] {
  const byLen = new Map<number, string[]>();
  for (const w of [...words].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))) byLen.set(w.length, [...(byLen.get(w.length) ?? []), w]);
  const groups = [...byLen].map(([n, ws]) => `${n}: ${ws.join(" ")}`);
  const lines: string[] = [];
  for (const g of groups) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 3 + g.length <= max) lines[lines.length - 1] = `${last} · ${g}`;
    else lines.push(g);
  }
  return lines;
}

export function crosswordBody(p: Params): string {
  const names = crossNames(p.x);
  const cw = buildCrossword(names);
  const blank = p.h === 1;
  const areaH = blank ? LISTED_H : AREA.h;
  const cell = Math.min(AREA.w / cw.cols, areaH / cw.rows, MAX_CELL);
  const x0 = AREA.x + (AREA.w - cw.cols * cell) / 2;
  const y0 = AREA.y + (areaH - cw.rows * cell) / 2;
  const nums = numbering(cw);
  const letters = new Map<string, string>();
  for (const w of cw.placed) for (let i = 0; i < w.word.length; i++) letters.set(w.across ? `${w.r},${w.c + i}` : `${w.r + i},${w.c}`, w.word[i]);

  // The cells, touching as a printed grid's do: each edge drawn once.
  const edges = new Set<string>();
  let d = "";
  let s = "";
  const ink = Math.max(0.6, Math.min(1.2, cell * 0.055));
  const numSize = cell * 0.27;
  const numbered = numSize >= 2.6;
  for (const [key, ch] of letters) {
    const [r, c] = key.split(",").map(Number);
    const [x, y] = [x0 + c * cell, y0 + r * cell];
    for (const [k, seg] of [
      [`h${r},${c}`, `M${f1(x)} ${f1(y)}H${f1(x + cell)}`],
      [`h${r + 1},${c}`, `M${f1(x)} ${f1(y + cell)}H${f1(x + cell)}`],
      [`v${r},${c}`, `M${f1(x)} ${f1(y)}V${f1(y + cell)}`],
      [`v${r},${c + 1}`, `M${f1(x + cell)} ${f1(y)}V${f1(y + cell)}`],
    ])
      if (!edges.has(k)) edges.add(k), (d += seg);
    const n = nums.get(key);
    if (n !== undefined && numbered) s += text(x + cell * 0.08, y + numSize * 1.05, String(n), r1(numSize), { anchor: "start" });
    if (!blank) s += text(x + cell / 2, y + cell * 0.7 + (n !== undefined && numbered ? cell * 0.05 : 0), ch, r1(cell * 0.52), { bold: true });
  }
  // Where a printed grid has its black squares, hatching (one ink: the block's tone from lines, never a slab), the
  // diagonals on one phase across the whole grid so neighbouring blocks read as one.
  let hatch = "";
  const gap = Math.max(1.9, Math.min(3.2, cell / 5));
  for (let r = 0; r < cw.rows; r++)
    for (let c = 0; c < cw.cols; c++) {
      if (letters.has(`${r},${c}`)) continue;
      const [x, y] = [x0 + c * cell, y0 + r * cell];
      // Lines x + y = k through the square [x, x + cell] × [y, y + cell].
      for (let k = Math.ceil((x + y) / gap) * gap; k < x + y + 2 * cell; k += gap) {
        const [ax, ay] = [Math.max(x, k - y - cell), Math.min(y + cell, k - x)];
        const [bx, by] = [Math.min(x + cell, k - y), Math.max(y, k - x - cell)];
        if (bx - ax > 0.3) hatch += `M${f1(ax)} ${f1(ay)}L${f1(bx)} ${f1(by)}`;
      }
    }
  const dots = hatch ? `<path d="${hatch}" fill="none" stroke="${INK}" stroke-width=".5"/>` : "";
  s = `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f1(ink)}" stroke-linecap="square"/>` + dots + s;

  if (blank) {
    // The names to fit, by length, as a setter lists a fill-in's words.
    // As large as the longest line allows (a short list reads from across the room), never over 9.
    let lines = listLines(names, 32);
    if (lines.length > 3) lines = listLines(names, 58);
    const size = r1(Math.min(9, 262 / (0.602 * Math.max(...lines.map((l) => l.length)))));
    const lead = size * 1.7;
    const top = Math.min(y0 + cw.rows * cell + 16 + size, 320 - (lines.length - 1) * lead);
    lines.forEach((l, i) => (s += text(150, top + i * lead, l, size)));
  }
  const title = p.w ?? "Crossword";
  const sub = `${names.length} names · ${cw.crossings === 0 ? "no" : cw.crossings} ${cw.crossings === 1 ? "crossing" : "crossings"}${blank ? " · fill them in" : ""}`;
  return s + caption(338, title, sub);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(crosswordBody((spec as { p: Params }).p), color);
