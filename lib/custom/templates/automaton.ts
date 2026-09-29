/**
 * Your Automaton: the word's ASCII bits, eight to a character, as the first
 * row of an elementary cellular automaton, run down the print (Wolfram's
 * rule numbering; the row wraps round at its ends). Drawn like the
 * catalogue's Matrix prints: a grid of lit dots (or squares) with air
 * between them, never merged, so a busy rule reads as texture rather than a
 * block. The word sits at the top as its bits, one digit over each cell of
 * the first row, its letters over their bytes.
 */
import { INK, caption, f1, text } from "../kit";
import type { Params } from "../specs/automaton";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";
import type { CustomSpec } from "../spec";

const X0 = 18, X1 = 282, BOTTOM = 318;

/** The word's bits, most significant first, eight to a character. */
export const wordBits = (x: string) => [...x].flatMap((c) => [...c.charCodeAt(0).toString(2).padStart(8, "0")].map(Number));

/**
 * Cells across: the bits with at least four cells of air either side, never
 * under 65, odd and not a multiple of three: on a ring of 2^k cells rule 90
 * cancels itself out to nothing within 2^(k-1) rows, and on a multiple of
 * three rules 150 and 105 have rows that fall to nothing (or to all ink).
 */
export function cellsAcross(bits: number): number {
  let c = Math.max(65, bits + 8) | 1;
  while (c % 3 === 0) c += 2;
  return c;
}

/** The rows of the automaton: the first is the bits centred in `cols` cells; each next cell is the rule's bit for its three neighbours above. */
export function evolve(bits: number[], rule: number, cols: number, rows: number): Uint8Array[] {
  let row = new Uint8Array(cols);
  const off = Math.floor((cols - bits.length) / 2);
  bits.forEach((b, i) => (row[off + i] = b));
  const out = [row];
  for (let r = 1; r < rows; r++) {
    const next = new Uint8Array(cols);
    for (let i = 0; i < cols; i++) next[i] = (rule >> ((row[(i + cols - 1) % cols] << 2) | (row[i] << 1) | row[(i + 1) % cols])) & 1;
    out.push((row = next));
  }
  return out;
}

/** The print's body (white ink, unwrapped). */
export function automatonBody(p: Params): string {
  const bits = wordBits(p.x);
  const cols = cellsAcross(bits.length);
  const s = (X1 - X0) / cols;
  // The bits are set so one digit's advance (0.602 em) is exactly one cell.
  const bitSize = s / 0.602;
  const letterY = 34, bitsY = letterY + 11, top = bitsY + 5;
  const rows = Math.floor((BOTTOM - top) / s);
  const grid = evolve(bits, p.r, cols, rows);
  const off = Math.floor((cols - bits.length) / 2);
  let out = "";
  [...p.x].forEach((ch, i) => {
    const x = X0 + (off + i * 8) * s;
    out += text(x + 4 * s, letterY, ch, Math.min(9, 8 * s * 0.9), { bold: true });
    out += text(x, bitsY, bits.slice(i * 8, i * 8 + 8).join(""), bitSize, { anchor: "start" });
  });
  // One path a row: dots as two arcs, squares as closed boxes; filled, each apart from its neighbours.
  const r = s * 0.36, q = s * 0.7;
  grid.forEach((row, j) => {
    const cy = top + (j + 0.5) * s;
    // Each mark ends where it began, so the next is one relative move along (the row's data stays short: a busy print has thousands).
    const mark = p.s ? `h${f1(q)}v${f1(q)}h-${f1(q)}z` : `a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 -${f1(2 * r)} 0z`;
    const dx = p.s ? -q / 2 : -r, dy = p.s ? -q / 2 : 0;
    // Moves between rounded positions, so the rounding never adds up along a row.
    const tenths = (i: number) => Math.round((X0 + (i + 0.5) * s + dx) * 10);
    let d = "";
    let last = -1;
    row.forEach((on, i) => {
      if (!on) return;
      d += (last < 0 ? `M${tenths(i) / 10} ${f1(cy + dy)}` : `m${(tenths(i) - tenths(last)) / 10} 0`) + mark;
      last = i;
    });
    if (d) out += `<path d="${d}" fill="${INK}"/>`;
  });
  return out + caption(338, p.x, `Rule ${p.r} · ${cols} cells · ${rows} generations`, "Elementary cellular automaton from the word's ASCII bits");
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(automatonBody((spec as { p: Params }).p), color);
