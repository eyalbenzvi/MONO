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
import { CAP, INK, caption, clip, f1, text, textWidth, captionLines, type Lines, house } from "../kit";
import { titleWords } from "../specKit";
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

/** The names grouped by length, as a setter lists a fill-in's words: "3: NOA", "4: ELLA RUTH", … */
function listGroups(words: string[]): string[] {
  const byLen = new Map<number, string[]>();
  for (const w of [...words].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))) byLen.set(w.length, [...(byLen.get(w.length) ?? []), w]);
  return [...byLen].map(([n, ws]) => `${n}: ${ws.join(" ")}`);
}

/**
 * The groups set in lines at the largest size (at most `max`, down to the
 * face's floor) that fits `width` in at most `maxLines`: groups joined by a
 * centred dot while they fit, a group too long for a line broken between its
 * names.
 */
function listFit(groups: string[], width: number, max: number, maxLines: number): { lines: string[]; size: number } {
  const opts = { spacing: 0 };
  for (let size = max; size >= 4.5; size = Math.round((size - 0.25) * 100) / 100) {
    const sp = { ...opts, spacing: r1(size * 0.04) };
    const fits = (l: string) => textWidth(l, size, sp) <= width;
    const lines: string[] = [];
    let ok = true;
    for (const g of groups) {
      const last = lines[lines.length - 1];
      if (last !== undefined && fits(`${last} · ${g}`)) lines[lines.length - 1] = `${last} · ${g}`;
      else if (fits(g)) lines.push(g);
      else {
        let line = "";
        for (const w of g.split(" ")) {
          const next = line ? `${line} ${w}` : w;
          if (fits(next)) line = next;
          else if (line) lines.push(line), (line = w);
          else ok = false;
        }
        if (line) lines.push(line);
      }
    }
    if (ok && lines.length <= maxLines) return { lines, size };
  }
  return { lines: groups.map((g) => clip(g, width, 4.5)), size: 4.5 };
}

/** The drawing, the caption's lines as ours, and where the caption sits. */
function crosswordDraw(p: Params): [string, Lines, number] {
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
  // A light's number in Plex, never under the face's floor: a grid too fine for it goes unnumbered.
  const numSize = r1(Math.min(7, Math.max(4.5, cell * 0.3)));
  const numbered = cell >= 14;
  // The letters in Space Grotesk Bold (a name set large), optically centred in the cell (below the number when there is one).
  const letterSize = r1(cell * 0.5);
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
    if (n !== undefined && numbered) s += text(x + Math.max(1.4, cell * 0.08), y + numSize * 1.02 + 0.6, String(n), numSize, { anchor: "start" });
    if (!blank) s += text(x + cell / 2, y + cell / 2 + (CAP.grotesk * letterSize) / 2 + (n !== undefined && numbered ? cell * 0.06 : 0), ch, letterSize, { bold: true, family: "grotesk" });
  }
  // Where a printed grid has its black squares, hatching (one ink: the block's tone from lines, never a slab), the
  // diagonals on one phase across the whole grid so neighbouring blocks read as one.
  let hatch = "";
  const gap = Math.max(2.2, Math.min(3.2, cell / 5));
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
    const { lines, size } = listFit(listGroups(names), 256, 8.5, 4);
    const lead = size * 1.65;
    const top = Math.min(y0 + cw.rows * cell + 14 + size, 318 - (lines.length - 1) * lead);
    lines.forEach((l, i) => (s += text(150, top + i * lead, l, size, { spacing: r1(size * 0.04) })));
  }
  const title = titleWords(p) ?? "Crossword";
  const sub = `${names.length} names · ${cw.crossings === 0 ? "no" : cw.crossings} ${cw.crossings === 1 ? "crossing" : "crossings"}${blank ? " · fill them in" : ""}`;
  return [s, [title, sub, undefined], 338];
}
/** The caption's lines (ours). */
export const crosswordCaption = (p: Params): Lines => crosswordDraw(p)[1];

export function crosswordBody(p: Params): string {
  const [s, lines, y] = crosswordDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => crosswordCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(crosswordBody((spec as { p: Params }).p), color));
