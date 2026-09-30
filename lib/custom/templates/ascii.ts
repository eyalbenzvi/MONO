/**
 * Your ASCII: your words as big letters typed out of characters, the
 * catalogue's ASCII banners (scripts/gen/set3/ascii) with your text: the
 * 5 × 7 pixel font (lib/custom/draw/pixelFont), each lit pixel a character
 * — the word's own letter, one of # @ % 8 $, or your phrase running through
 * the letters in order — an optional drop shadow in slashes, a glow of
 * lighter characters fading out round the letters (+ = - : .), the shell line
 * that "printed" it above, and your words as the output line below. On the
 * monospace grid of the print font; each row is one text run, so columns
 * line up in the canvas preview as in the print.
 *
 * Or a picture: the customer's photo as tones (made on their device,
 * lib/custom/draw/asciiPicture), each cell a character of a ramp by ink,
 * in the same frame, printed by `$ cat picture.txt`.
 */
import { FONT_FAMILY, INK, caption, captionLines, clip, fitSize, house, text, type Lines } from "../kit";
import { titleWords } from "../specKit";
import { pixelTextRows } from "../draw/pixelFont";
import { ASCII_ROWS, asciiUnpack, type AsciiParams, type CustomSpec } from "../spec";
import { pictureRows } from "../draw/asciiPicture";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** Advance of one monospace cell, as a fraction of font size: IBM Plex Mono's, the face the grid is set in. */
const CELL = 0.6;
const GRID_FAMILY = FONT_FAMILY.plex;
const AREA = { x: 34, y: 60, w: 232, h: 222 };
/** The terminal's frame: + - | characters round the whole print, as the catalogue's framed banners. */
const FRAME = { x: 14, y: 22, w: 272, h: 290, fs: 10 };

/** What each cell of the banner is: a letter's pixel, its shadow, the glow round them, or nothing. */
type Kind = "L" | "S" | "G" | " ";

/** The banner's grid: its characters, and what each one is. */
function asciiGrid(p: AsciiParams): { rows: string[]; kinds: Kind[][] } {
  const f = p.f ?? "self";
  const phrase = f === "phrase" ? [...(p.p ?? "").replace(/\s+/g, "")] : [];
  let k = 0;
  const words = p.x.map((word) => pixelTextRows(word));
  const widest = Math.max(...words.map((rows) => rows[0].length));
  const chars: string[][] = [];
  const kinds: Kind[][] = [];
  words.forEach((rows, wi) => {
    const word = p.x[wi];
    // A shorter word centred over the longer one, on whole cells.
    const pad = Math.floor((widest - rows[0].length) / 2);
    const width = widest + (p.s ? 1 : 0);
    const grid = Array.from({ length: 7 + (p.s ? 1 : 0) }, () => Array<string>(width).fill(" "));
    const kind = grid.map((g) => g.map((): Kind => " "));
    rows.forEach((row, r) =>
      [...row].forEach((cell, c) => {
        if (cell !== "X") return;
        grid[r][c + pad] = f === "self" ? word[Math.floor(c / 6)] : f === "phrase" ? phrase[k++ % phrase.length] : f;
        kind[r][c + pad] = "L";
      }),
    );
    // The shadow: down and to the right of every lit pixel that doesn't cover another.
    if (p.s)
      rows.forEach((row, r) =>
        [...row].forEach((cell, c) => {
          if (cell === "X" && kind[r + 1][c + pad + 1] === " ") (grid[r + 1][c + pad + 1] = "/"), (kind[r + 1][c + pad + 1] = "S");
        }),
      );
    if (wi > 0) chars.push([]), kinds.push([]);
    chars.push(...grid);
    kinds.push(...kind);
  });
  return glow(chars, kinds);
}

/** The character grid of the banner. */
export function asciiRows(p: AsciiParams): string[] {
  return asciiGrid(p).rows;
}

/**
 * The glow: round the letters, lighter characters by distance (a character
 * ramp, as ASCII shading has), GLOW cells deep. Light marks only, set in the
 * regular weight, so the letters (bold) read first and the glow falls away.
 */
const RAMP = ["·", ":", ":", "·", "."];
const GLOW = RAMP.length;
function glow(chars: string[][], kinds: Kind[][]): { rows: string[]; kinds: Kind[][] } {
  const w = Math.max(...chars.map((r) => r.length)) + 2 * GLOW, h = chars.length + 2 * GLOW;
  const at = <T,>(g: T[][], y: number, x: number, blank: T) => g[y - GLOW]?.[x - GLOW] ?? blank;
  const grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => at(chars, y, x, " ")));
  const kind = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x): Kind => at(kinds, y, x, " " as Kind)));
  // Distance to the nearest lit character, a cell being half as tall as it is wide in look (rows count double).
  const dist = (x: number, y: number) => {
    let best = Infinity;
    for (let dy = -GLOW; dy <= GLOW; dy++)
      for (let dx = -2 * GLOW; dx <= 2 * GLOW; dx++) {
        const c = kind[y + dy]?.[x + dx];
        if (c === "L" || c === "S") best = Math.min(best, Math.max(Math.abs(dx) / 2, Math.abs(dy)));
      }
    return best;
  };
  const out = grid.map((r) => [...r]);
  const outKind = kind.map((r) => [...r]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (kind[y][x] === " ") {
        const d = Math.ceil(dist(x, y));
        if (d >= 1 && d <= GLOW) (out[y][x] = RAMP[d - 1]), (outKind[y][x] = "G");
      }
  // Trailing blanks dropped (as the rows always were).
  const rows = out.map((r) => r.join("").replace(/\s+$/, ""));
  return { rows, kinds: outKind.map((r, i) => r.slice(0, rows[i].length)) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A run of characters on the grid, from column `col` (spaces kept, so the columns hold). */
const run = (x0: number, col: number, y: number, fs: number, str: string, bold = false) =>
  `<text x="${(x0 + col * fs * CELL).toFixed(1)}" y="${y.toFixed(1)}" fill="${INK}" font-size="${fs.toFixed(2)}" font-family="${GRID_FAMILY}"${bold ? ` font-weight="bold"` : ""} xml:space="preserve">${esc(str)}</text>`;

/** One row of the banner as runs: the letters bold, the shadow and the glow regular. */
function rowRuns(x0: number, y: number, fs: number, row: string, kinds: Kind[]): string {
  let s = "";
  const chars = [...row];
  let i = 0;
  while (i < chars.length) {
    if (kinds[i] === " " || chars[i] === " ") {
      i++;
      continue;
    }
    const bold = kinds[i] === "L";
    let j = i;
    while (j < chars.length && chars[j] !== " " && (kinds[j] === "L") === bold && kinds[j] !== " ") j++;
    s += run(x0, i, y, fs, chars.slice(i, j).join(""), bold);
    i = j;
  }
  return s;
}

/** The terminal's frame, and where its shell line starts. */
function frame(): { s: string; fx: number } {
  const fc = Math.floor(FRAME.w / (FRAME.fs * CELL)), fr = Math.floor(FRAME.h / FRAME.fs);
  const fx = 150 - (fc * FRAME.fs * CELL) / 2;
  const row = (r: number, str: string) => run(fx, 0, FRAME.y + (r + 0.8) * FRAME.fs, FRAME.fs, str);
  let s = row(0, `+${"-".repeat(fc - 2)}+`) + row(fr - 1, `+${"-".repeat(fc - 2)}+`);
  for (let r = 1; r < fr - 1; r++) s += row(r, `|${" ".repeat(fc - 2)}|`);
  return { s, fx };
}

/** The shell line that printed it, at the frame's top left, fitted to the frame (cut with an ellipsis when it can't). */
function shell(fx: number, cmd: string): string {
  const w = 272 - FRAME.fs * CELL * 4;
  const size = fitSize(cmd, w, 9, { floor: 5 });
  return text(fx + FRAME.fs * CELL * 2, FRAME.y + 2.8 * FRAME.fs, clip(cmd, w, size), size, { anchor: "start" });
}

export function asciiBody(p: AsciiParams): string {
  const grid = asciiGrid(p);
  // A narrow banner (a short word, set by the area's height) has its glow's
  // outer dots carried out to the area's width, so the screen is lit edge to
  // edge and the word sits in the middle of it.
  const own = Math.max(...grid.rows.map((r) => r.length));
  const fit = Math.floor(AREA.w / ((AREA.h / (grid.rows.length * 1.02)) * CELL));
  const side = Math.max(0, Math.floor((fit - own) / 2));
  const edge = RAMP[GLOW - 1];
  // A wide one (set by the width) gives up the glow's outer columns, up to
  // all but its inner four cells (two rings), so its letters grow.
  const crop = fit < own ? Math.min(2 * GLOW - 4, Math.ceil((own - fit) / 2)) : 0;
  const rows = grid.rows.map((r) => edge.repeat(side) + [...r.padEnd(own, edge)].slice(crop, own - crop).join("") + edge.repeat(side));
  const kinds = grid.kinds.map((k) => [...Array<Kind>(side).fill("G"), ...[...k, ...Array<Kind>(own - k.length).fill("G")].slice(crop, own - crop), ...Array<Kind>(side).fill("G")]);
  const cols = own - 2 * crop + 2 * side;
  // As big as the area allows (a short word grows, up to 44).
  const fs = Math.min(AREA.w / (cols * CELL), AREA.h / (rows.length * 1.02), 44);
  const bw = cols * fs * CELL, lh = fs * 1.02;
  const x0 = 150 - bw / 2, y0 = AREA.y + (AREA.h - rows.length * lh) / 2;
  let s = "";
  rows.forEach((r, i) => (s += rowRuns(x0, y0 + (i + 0.8) * lh, fs, r, kinds[i])));
  const { s: box, fx } = frame();
  s += box + shell(fx, `$ banner "${p.x.join(" ").toLowerCase()}"`);
  return s + caption(338, ...captionLines(asciiCaption(p), p.cap));
}

/** The caption's lines (ours): the words (the visitor's title, else the letters) and what they're typed in; a picture's title only when given. */
export function asciiCaption(p: AsciiParams): Lines {
  const w = titleWords(p);
  if (p.g) return [w, `a picture in ${p.c! * ASCII_ROWS[p.c!]} characters`];
  const f = p.f ?? "self";
  return [w ?? p.x.join(" "), f === "phrase" ? `typed in "${p.p}"` : f === "self" ? "typed in its own letters" : `typed in ${f}`];
}

export const captionOf = (spec: CustomSpec) => asciiCaption((spec as { p: AsciiParams }).p);

/**
 * A picture (`g`): its tones as characters on the same monospace grid, in the same frame, the grid
 * filling the area (the rows follow from the width: ASCII_ROWS). The ink is the characters, so the
 * tee decides the ramp's direction (pictureRows). Regular weight: bold dense characters block up.
 */
export function asciiPictureBody(p: AsciiParams, color: BaseColor): string {
  const cols = p.c!;
  const levels = asciiUnpack(p.g, cols)!;
  const rows = pictureRows(levels, cols, color);
  const fs = Math.min(AREA.w / (cols * CELL), AREA.h / (rows.length * 1.02));
  const lh = fs * 1.02;
  const x0 = 150 - (cols * fs * CELL) / 2, y0 = AREA.y + (AREA.h - rows.length * lh) / 2;
  let s = "";
  rows.forEach((row, i) => {
    const r = row.replace(/\s+$/, "");
    const lead = r.length - r.trimStart().length;
    if (r.trim())
      s += run(x0, lead, y0 + (i + 0.8) * lh, fs, r.slice(lead));
  });
  const { s: box, fx } = frame();
  s += box + shell(fx, "$ cat picture.txt");
  // Without a title the house lockup's lines move up into its place (the line where the title would be); the visitor may add one, or more lines.
  const [title, sub, sub2] = captionLines(asciiCaption(p), p.cap);
  return s + caption(title ? 338 : 323, title, sub, sub2);
}

export const render = (spec: CustomSpec, color: BaseColor) => {
  const p = (spec as { p: AsciiParams }).p;
  return house(() => wrap(p.g ? asciiPictureBody(p, color) : asciiBody(p), color));
};
