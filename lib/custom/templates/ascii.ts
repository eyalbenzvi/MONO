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
 */
import { INK, caption, text } from "../kit";
import { pixelTextRows } from "../draw/pixelFont";
import type { AsciiParams, CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** Advance of one monospace cell, as a fraction of font size (DejaVu Sans Mono: 0.602). */
const CELL = 0.602;
const AREA = { x: 34, y: 58, w: 232, h: 222 };
/** The terminal's frame: + - | characters round the whole print, as the catalogue's framed banners. */
const FRAME = { x: 14, y: 20, w: 272, h: 290, fs: 10 };

/** The character grid of the banner. */
export function asciiRows(p: AsciiParams): string[] {
  const phrase = p.f === "phrase" ? [...(p.p ?? "").replace(/\s+/g, "")] : [];
  let k = 0;
  const out: string[] = [];
  p.x.forEach((word, wi) => {
    const rows = pixelTextRows(word);
    const width = rows[0].length + (p.s ? 1 : 0);
    const grid = Array.from({ length: 7 + (p.s ? 1 : 0) }, () => Array<string>(width).fill(" "));
    rows.forEach((row, r) =>
      [...row].forEach((cell, c) => {
        if (cell === "X") grid[r][c] = p.f === "self" ? word[Math.floor(c / 6)] : p.f === "phrase" ? phrase[k++ % phrase.length] : p.f;
      }),
    );
    // The shadow: down and to the right of every lit pixel that doesn't cover another.
    if (p.s)
      rows.forEach((row, r) => [...row].forEach((cell, c) => cell === "X" && grid[r + 1][c + 1] === " " && (grid[r + 1][c + 1] = "/")));
    if (wi > 0) out.push("");
    out.push(...grid.map((g) => g.join("")));
  });
  return glow(out).map((r) => r.replace(/\s+$/, ""));
}

/** The glow: round the letters, lighter characters by distance (a character ramp, as ASCII shading has), GLOW cells deep. */
const RAMP = ["+", "=", "-", ":", "."];
const GLOW = RAMP.length;
function glow(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length)) + 2 * GLOW, h = rows.length + 2 * GLOW;
  const grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => rows[y - GLOW]?.[x - GLOW] ?? " "));
  // Distance to the nearest lit character, a cell being half as tall as it is wide in look (rows count double).
  const dist = (x: number, y: number) => {
    let best = Infinity;
    for (let dy = -GLOW; dy <= GLOW; dy++)
      for (let dx = -2 * GLOW; dx <= 2 * GLOW; dx++) {
        const c = grid[y + dy]?.[x + dx];
        if (c && c !== " " && !RAMP.includes(c)) best = Math.min(best, Math.max(Math.abs(dx) / 2, Math.abs(dy)));
      }
    return best;
  };
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (grid[y][x] === " ") {
        const d = Math.ceil(dist(x, y));
        if (d >= 1 && d <= GLOW) out[y][x] = RAMP[d - 1];
      }
  return out.map((r) => r.join(""));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function asciiBody(p: AsciiParams): string {
  const rows = asciiRows(p);
  const cols = Math.max(...rows.map((r) => r.length));
  // As big as the area allows (a short word grows, up to 44).
  const fs = Math.min(AREA.w / (cols * CELL), AREA.h / (rows.length * 1.02), 44);
  const bw = cols * fs * CELL, lh = fs * 1.02;
  const x0 = 150 - bw / 2, y0 = AREA.y + (AREA.h - rows.length * lh) / 2;
  let s = "";
  rows.forEach((r, i) => {
    const lead = r.length - r.trimStart().length;
    if (r.trim())
      s += `<text x="${(x0 + lead * fs * CELL).toFixed(1)}" y="${(y0 + (i + 0.8) * lh).toFixed(1)}" fill="${INK}" font-size="${fs.toFixed(2)}" font-family="DejaVu Sans Mono, monospace" font-weight="bold" xml:space="preserve">${esc(r.slice(lead))}</text>`;
  });
  const fc = Math.floor(FRAME.w / (FRAME.fs * CELL)), fr = Math.floor(FRAME.h / FRAME.fs);
  const fx = 150 - (fc * FRAME.fs * CELL) / 2;
  const frame = (r: number, str: string) => `<text x="${fx.toFixed(1)}" y="${(FRAME.y + (r + 0.8) * FRAME.fs).toFixed(1)}" fill="${INK}" font-size="${FRAME.fs}" font-family="DejaVu Sans Mono, monospace" xml:space="preserve">${esc(str)}</text>`;
  s += frame(0, `+${"-".repeat(fc - 2)}+`) + frame(fr - 1, `+${"-".repeat(fc - 2)}+`);
  for (let r = 1; r < fr - 1; r++) s += frame(r, `|${" ".repeat(fc - 2)}|`);
  const cmd = `$ banner "${p.x.join(" ").toLowerCase()}"`;
  s += text(fx + FRAME.fs * CELL * 2, FRAME.y + 2.8 * FRAME.fs, cmd, Math.min(9, 230 / (0.602 * cmd.length)), { anchor: "start" });
  return s + caption(338, p.w ?? p.x.join(" "), p.f === "phrase" ? `typed in "${p.p}"` : p.f === "self" ? "typed in its own letters" : `typed in ${p.f}`);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(asciiBody((spec as { p: AsciiParams }).p), color);
