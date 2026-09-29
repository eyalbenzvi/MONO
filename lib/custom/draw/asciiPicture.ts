/**
 * Your ASCII's picture mode: a photo turned into a grid of tones on the
 * device (the editor decodes it and hands the pixels here; nothing is sent
 * anywhere), and the tones turned into characters for the print. Pure, so
 * the tests put synthetic pictures through exactly what the editor runs.
 */
import { ASCII_LEVELS } from "../spec";

/** Advance and line height of one monospace cell, as fractions of font size (the template's grid). */
export const CELL_W = 0.602;
export const CELL_H = 1.02;

/**
 * The character ramp, by measured ink a cell (resvg, DejaVu Sans Mono at 8 units:
 * 0, 3, 6, 11, 15, 21, 28, 31 %): index = how much ink.
 */
export const RAMP = " .:*=%#@";

/**
 * The part of a w × h picture that fills a cols × rows grid: the largest box of the grid's look (a cell is
 * taller than wide), `zoom` times closer, centred across the picture's short side and at `pos` (0–1) along
 * its long one (face-agnostic: the customer moves it).
 */
export function cropBox(w: number, h: number, cols: number, rows: number, pos = 0.5, zoom = 1) {
  const aspect = (cols * CELL_W) / (rows * CELL_H);
  const z = Math.max(1, zoom);
  const sw = Math.min(w, h * aspect) / z, sh = Math.min(h, w / aspect) / z;
  const t = Math.min(1, Math.max(0, pos));
  const wide = w / h > aspect;
  return { sx: (w - sw) * (wide ? t : 0.5), sy: (h - sh) * (wide ? 0.5 : t), sw, sh };
}

/** The gain a contrast stretch may use: a flat picture stays flat instead of its noise becoming a print. */
const MAX_GAIN = 4;

/**
 * A picture's luminance (0–1, w × h, row by row; already cropped to the grid's look) as tones
 * 0 (darkest) to ASCII_LEVELS − 1: averaged to one value a cell, edges sharpened if asked
 * (unsharp mask over the 3 × 3 cells round), stretched between the 2nd and 98th percentile,
 * and rounded to a level.
 */
export function toneGrid(lum: ArrayLike<number>, w: number, h: number, cols: number, rows: number, opts: { edges?: boolean } = {}): number[] {
  const n = cols * rows;
  let v = new Float64Array(n);
  const count = new Float64Array(n);
  for (let y = 0; y < h; y++) {
    const r = Math.min(rows - 1, Math.floor((y * rows) / h));
    for (let x = 0; x < w; x++) {
      const i = r * cols + Math.min(cols - 1, Math.floor((x * cols) / w));
      v[i] += lum[y * w + x];
      count[i]++;
    }
  }
  for (let i = 0; i < n; i++) v[i] = count[i] ? v[i] / count[i] : 0;
  if (opts.edges) {
    const out = new Float64Array(n);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        let s = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && yy < rows && xx >= 0 && xx < cols) (s += v[yy * cols + xx]), k++;
          }
        const c = v[y * cols + x];
        out[y * cols + x] = c + 1.2 * (c - s / k);
      }
    v = out;
  }
  const sorted = Array.from(v).sort((a, b) => a - b);
  const lo0 = sorted[Math.floor(0.02 * (n - 1))], hi0 = sorted[Math.ceil(0.98 * (n - 1))];
  // Stretch to the range, never by more than MAX_GAIN: a narrower range gets a window 1 / MAX_GAIN wide round
  // its middle, kept inside 0–1, so a dark picture stays dark and a light one light.
  const span = Math.max(hi0 - lo0, 1 / MAX_GAIN);
  const lo = Math.min(Math.max(0, (lo0 + hi0 - span) / 2), 1 - span);
  const top = ASCII_LEVELS - 1;
  return Array.from(v, (x) => Math.max(0, Math.min(top, Math.round(((x - lo) / span) * top))));
}

/** A tone grid as the rows of characters that print it: on a black tee the ink is light, on a white tee dark. */
export function pictureRows(levels: readonly number[], cols: number, color: "black" | "white"): string[] {
  const top = ASCII_LEVELS - 1;
  const rows: string[] = [];
  for (let i = 0; i < levels.length; i += cols) rows.push(levels.slice(i, i + cols).map((l) => RAMP[color === "black" ? l : top - l]).join(""));
  return rows;
}

/** Luminance (Rec. 709, 0–1) of RGBA pixels (a canvas's ImageData). */
export function luminance(rgba: ArrayLike<number>): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255;
  return out;
}
