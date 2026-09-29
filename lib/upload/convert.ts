/**
 * "From yours": a customer's picture, drawing or SVG turned into a
 * one-ink print on the catalogue's 1500 × 2000 grid (brief 6.2). Pure: typed
 * arrays in, typed arrays out, no DOM and no Node, so the same code runs in
 * the upload worker (lib/upload/worker.ts), on the main thread as a fallback
 * and in the tests. Decoding, EXIF orientation and SVG rasterising happen in
 * the worker; this file only sees pixels.
 *
 * The pipeline, per class:
 * - line (a scan, a drawing, a logo): Sauvola adaptive threshold at the
 *   working size, trimmed and fitted to the print, then specks and pinholes
 *   under 0.3 mm² cleaned at the print's own scale.
 * - photo, Dots: background taken off (only a flat one), levels, then the
 *   tone itself is placed on the print grid and only then screened (the
 *   port of scripts/photos/halftone.py), so the dots are the catalogue's
 *   dots at 30 lpi whatever the upload's size. The tone is kept, because a
 *   photograph is never inverted: a black tee prints its lights, a white tee
 *   its darks, two different screens of the same tone (inkFor).
 * - photo, Lines: the tone placed on the grid, Canny edges at print scale,
 *   widened to 0.6 mm, trimmed, fitted and cleaned.
 * - vector (a sanitised SVG, rasterised by the worker): a plain threshold,
 *   trimmed and fitted.
 */
import { REASONS } from "./reasons";
import { MAX_LONG } from "./pixels";
import { BOXES, MM_PER_PX, OUT_H, OUT_W, PX_PER_MM, type PrintSize } from "./grid";

export interface Pixels {
  w: number;
  h: number;
  /** RGBA, straight (not premultiplied) alpha, as ImageData gives it. */
  data: Uint8ClampedArray;
}

export type UploadClass = "line" | "photo" | "vector";
export type Mode = "dots" | "lines" | "line" | "vector";
/** What the page may ask of a picture: its class's own mode, Dots or Lines (a photograph), or Drawing (a photograph read as line work: a sketch shot on paper). */
export type Ask = Mode | "drawing";
export type { PrintSize } from "./grid";
export type Tee = "black" | "white";

/** A photograph's tone on the print grid: luminance after levels, and where the picture is (0 outside it or on its removed background). */
export interface Tone {
  lum: Float32Array;
  alpha: Float32Array;
}

export interface Converted {
  cls: UploadClass;
  mode: Mode;
  size: PrintSize;
  w: 1500;
  h: 2000;
  /** 1 = ink, OUT_W × OUT_H: the print for the upload's own tee (darkOnLight ? white : black). Line work is the same shapes on either tee. */
  ink: Uint8Array;
  /** Dots only: the placed tone, screened per tee by inkFor (a photograph is never inverted). */
  tone: Tone | null;
  /** Share of the upload's ink pixels in midtones (midtoneShare), before conversion. */
  midtones: number;
  /** The upload's polarity: dark marks on a light ground (line work), or a dark picture (a photograph). */
  darkOnLight: boolean;
}

/* ------------------------------------------------------------------ */
/* The print grid                                                       */
/* ------------------------------------------------------------------ */

export { BOXES, MM_PER_PX, OUT_H, OUT_W, PX_PER_MM, TOP } from "./grid";
/** The worker's decode cap (brief 6.2): the long side, px (lib/upload/pixels, which has no converter to load). */
export { MAX_LONG } from "./pixels";
/**
 * convert works at the size the picture would print at Full (fitted into
 * the 1500 × 1940 area, never enlarged): the print grid can't show more,
 * and every step after costs by the pixel.
 */
const workLong = (w: number, h: number) => Math.round(Math.max(w, h) * Math.min(1, BOXES.full.w / w, BOXES.full.h / h));
/** A file's short side must be at least this for each size (brief 6.1). */
export const MIN_SHORT: Record<PrintSize, number> = { full: 1100, small: 800 };
export const tooSmall = (w: number, h: number, size: PrintSize) => Math.min(w, h) < MIN_SHORT[size];

/* ------------------------------------------------------------------ */
/* Pixels to grey                                                       */
/* ------------------------------------------------------------------ */

/**
 * Area-averaged downscale to a long side of at most maxLong (a no-op below
 * it). Colour is averaged premultiplied, so a transparent pixel's hidden
 * colour never bleeds into its neighbours. A whole-number share of the
 * reduction goes first as plain k × k blocks (each source pixel read once),
 * the fractional rest after, row by row: a 12 MP input never needs a second
 * full-size buffer.
 */
export function downscale(p: Pixels, maxLong = MAX_LONG): Pixels {
  const long = Math.max(p.w, p.h);
  if (long <= maxLong) return p;
  // Up to 16 × 16 blocks at a time: their premultiplied sums still fit 32 bits.
  const k = Math.min(16, Math.floor(long / maxLong));
  const q = k > 1 ? blocks(p, k) : p;
  return Math.max(q.w, q.h) <= maxLong ? q : k === 16 ? downscale(q, maxLong) : areaDown(q, maxLong / Math.max(q.w, q.h));
}

/** k × k blocks averaged (premultiplied); a ragged last row or column averages what it has. */
function blocks(p: Pixels, k: number): Pixels {
  const [dw, dh] = [Math.ceil(p.w / k), Math.ceil(p.h / k)];
  const W = p.w;
  const acc = new Uint32Array(dw * 4);
  const col = new Int32Array(p.w);
  for (let x = 0; x < p.w; x++) col[x] = ((x / k) | 0) * 4;
  const out = new Uint8ClampedArray(dw * dh * 4);
  const s = p.data;
  for (let dy = 0; dy < dh; dy++) {
    acc.fill(0);
    const y1 = Math.min(p.h, (dy + 1) * k);
    for (let y = dy * k; y < y1; y++)
      for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
        const a = s[i + 3];
        const o = col[x];
        acc[o] += s[i] * a;
        acc[o + 1] += s[i + 1] * a;
        acc[o + 2] += s[i + 2] * a;
        acc[o + 3] += a;
      }
    const rows = y1 - dy * k;
    for (let x = 0; x < dw; x++) {
      const a = acc[x * 4 + 3];
      const i = (dy * dw + x) * 4;
      if (a > 0) {
        out[i] = acc[x * 4] / a + 0.5;
        out[i + 1] = acc[x * 4 + 1] / a + 0.5;
        out[i + 2] = acc[x * 4 + 2] / a + 0.5;
      }
      out[i + 3] = a / (rows * (Math.min(p.w, (x + 1) * k) - x * k)) + 0.5;
    }
  }
  return { w: dw, h: dh, data: out };
}

/** Fractional area averaging by f < 1: each source pixel split between at most two destination columns and rows. */
function areaDown(p: Pixels, f: number): Pixels {
  const [dw, dh] = [Math.max(1, Math.round(p.w * f)), Math.max(1, Math.round(p.h * f))];
  const [sx, sy] = [p.w / dw, p.h / dh];
  const col = new Int32Array(p.w);
  const wt = new Float32Array(p.w);
  for (let x = 0; x < p.w; x++) {
    const d = Math.min(dw - 1, Math.floor(x / sx));
    col[x] = d;
    wt[x] = d + 1 < dw ? Math.min(1, (d + 1) * sx - x) : 1;
  }
  // Two accumulator rows (the destination row being filled and the next), and one horizontally reduced source row.
  const acc = [new Float64Array(dw * 4), new Float64Array(dw * 4)];
  const row = new Float64Array(dw * 4 + 4);
  const out = new Uint8ClampedArray(dw * dh * 4);
  const area = sx * sy;
  const flush = (d: number) => {
    const A = acc[d & 1];
    for (let x = 0; x < dw; x++) {
      const a = A[x * 4 + 3];
      const i = (d * dw + x) * 4;
      if (a > 0) {
        out[i] = A[x * 4] / a + 0.5;
        out[i + 1] = A[x * 4 + 1] / a + 0.5;
        out[i + 2] = A[x * 4 + 2] / a + 0.5;
      }
      out[i + 3] = a / area + 0.5;
    }
    A.fill(0);
  };
  const s = p.data;
  let cur = 0;
  for (let y = 0; y < p.h; y++) {
    row.fill(0);
    for (let x = 0, i = y * p.w * 4; x < p.w; x++, i += 4) {
      const a = s[i + 3];
      const o = col[x] * 4;
      const w0 = wt[x];
      const r = s[i] * a, g = s[i + 1] * a, b = s[i + 2] * a;
      if (w0 === 1) {
        row[o] += r;
        row[o + 1] += g;
        row[o + 2] += b;
        row[o + 3] += a;
        continue;
      }
      const w1 = 1 - w0;
      row[o] += r * w0;
      row[o + 1] += g * w0;
      row[o + 2] += b * w0;
      row[o + 3] += a * w0;
      row[o + 4] += r * w1;
      row[o + 5] += g * w1;
      row[o + 6] += b * w1;
      row[o + 7] += a * w1;
    }
    const d = Math.min(dh - 1, Math.floor(y / sy));
    const v0 = d + 1 < dh ? Math.min(1, (d + 1) * sy - y) : 1;
    while (cur < d) flush(cur++);
    const A = acc[d & 1];
    const B = acc[(d + 1) & 1];
    const v1 = 1 - v0;
    for (let j = 0; j < dw * 4; j++) A[j] += row[j] * v0;
    if (v1 > 0) for (let j = 0; j < dw * 4; j++) B[j] += row[j] * v1;
  }
  while (cur < dh) flush(cur++);
  return { w: dw, h: dh, data: out };
}

/** Luminance 0–1 (Rec. 709 on the encoded values, as halftone.py reads its masters), composited over white paper. */
export function grey(p: Pixels): Float32Array {
  const g = new Float32Array(p.w * p.h);
  const d = p.data;
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    const a = d[j + 3] / 255;
    g[i] = ((0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255) * a + 1 - a;
  }
  return g;
}

/** The q-quantiles of the values (0–1), where the mask is set (all when none), from a 1024-bin histogram. */
function quantiles(g: Float32Array, qs: number[], mask?: Uint8Array | Float32Array): number[] {
  const bins = new Uint32Array(1024);
  let n = 0;
  for (let i = 0; i < g.length; i++) if (!mask || mask[i] > 0.5) bins[Math.min(1023, Math.max(0, (g[i] * 1023) | 0))]++, n++;
  return qs.map((q) => {
    const want = q * n;
    let k = 0;
    for (let b = 0; b < 1024; b++) if ((k += bins[b]) >= want) return b / 1023;
    return 1;
  });
}

/** Levels: the 1st–99th percentile stretched to 0–1 (over the mask, when given: a photograph's subject, not its removed ground). */
export function levels(g: Float32Array, mask?: Uint8Array | Float32Array): Float32Array {
  const [lo, hi] = quantiles(g, [0.01, 0.99], mask);
  const k = 1 / Math.max(1e-3, hi - lo);
  const out = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = Math.min(1, Math.max(0, (g[i] - lo) * k));
  return out;
}

/** 3 × 3 box blur (edges clamped). */
function blur3(g: Float32Array, w: number, h: number): Float32Array {
  const t = new Float32Array(g.length), out = new Float32Array(g.length);
  for (let y = 0; y < h; y++)
    for (let x = 0, i = y * w; x < w; x++, i++) t[i] = (g[x ? i - 1 : i] + g[i] + g[x < w - 1 ? i + 1 : i]) / 3;
  for (let y = 0; y < h; y++)
    for (let x = 0, i = y * w; x < w; x++, i++) out[i] = (t[y ? i - w : i] + t[i] + t[y < h - 1 ? i + w : i]) / 3;
  return out;
}

/** Below this share of midtones among its ink pixels, an upload is line work (brief 6.2). */
export const LINE_MIDTONES = 0.08;

/**
 * Share of the ink pixels that are midtones, the line-or-photo measure.
 * Defined so a scan's paper and its strokes' soft edges don't count:
 * 1. the paper is flattened: each pixel divided by the local paper level
 *    (the 95th percentile of a 4 × 4 grid of blocks, interpolated; a block
 *    far darker than its brightest neighbour is inside a black shape and
 *    takes that neighbour's paper), so a shadow or a tinted sheet reads as
 *    white;
 * 2. a 3 × 3 blur takes out sensor and paper grain, then levels (1st–99th);
 * 3. ink pixels are those under 0.9; a midtone is an ink pixel over 0.1
 *    whose 3 × 3 neighbourhood spans under 0.4: a real grey, not the ramp
 *    across the edge of a black stroke.
 */
export function midtoneShare(g: Float32Array, w: number, h: number): number {
  const G = 4;
  const bg = new Float32Array(G * G);
  for (let by = 0; by < G; by++)
    for (let bx = 0; bx < G; bx++) {
      const [x0, x1, y0, y1] = [Math.floor((bx * w) / G), Math.floor(((bx + 1) * w) / G), Math.floor((by * h) / G), Math.floor(((by + 1) * h) / G)];
      const part = new Float32Array((x1 - x0) * (y1 - y0));
      let k = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) part[k++] = g[y * w + x];
      bg[by * G + bx] = Math.max(0.05, quantiles(part, [0.95])[0]);
    }
  const near = bg.map((_, i) => {
    let m = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const [x, y] = [(i % G) + dx, ((i / G) | 0) + dy];
        if (x >= 0 && y >= 0 && x < G && y < G) m = Math.max(m, bg[y * G + x]);
      }
    return bg[i] < 0.7 * m ? m : bg[i];
  });
  bg.set(near);
  const flat = new Float32Array(g.length);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(G - 1, Math.max(0, (y + 0.5) / (h / G) - 0.5));
    const y0 = Math.min(G - 2, Math.floor(fy));
    const vy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(G - 1, Math.max(0, (x + 0.5) / (w / G) - 0.5));
      const x0 = Math.min(G - 2, Math.floor(fx));
      const vx = fx - x0;
      const b = (bg[y0 * G + x0] * (1 - vx) + bg[y0 * G + x0 + 1] * vx) * (1 - vy) + (bg[(y0 + 1) * G + x0] * (1 - vx) + bg[(y0 + 1) * G + x0 + 1] * vx) * vy;
      flat[y * w + x] = Math.min(1, g[y * w + x] / b);
    }
  }
  const l = levels(blur3(flat, w, h));
  let [ink, mid] = [0, 0];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = l[i];
      if (v >= 0.9) continue;
      ink++;
      if (v <= 0.1) continue;
      let lo = v;
      let hi = v;
      for (let dy = -w; dy <= w; dy += w)
        for (let dx = -1; dx <= 1; dx++) {
          const u = l[i + dy + dx];
          if (u < lo) lo = u;
          if (u > hi) hi = u;
        }
      if (hi - lo < 0.4) mid++;
    }
  return ink ? mid / ink : 0;
}

/** Midtones are judged at this long side: plenty for a share, and quick. */
const CLASSIFY_LONG = 512;

/** The midtone share of an upload, read the way round it's drawn (light marks on a dark ground inverted first). */
function midtonesOf(p: Pixels): number {
  const s = downscale(p, CLASSIFY_LONG);
  const g = grey(s);
  return midtoneShare(lightOnDark(g, s.w, s.h) ? invert(g) : g, s.w, s.h);
}

/** Line or photograph, from the midtones (an SVG is a vector and words are words before this is asked). */
export const classify = (p: Pixels): "line" | "photo" => (midtonesOf(p) < LINE_MIDTONES ? "line" : "photo");

/** The values in the outer ring of the picture, r px deep, every step-th pixel. */
function ringOf(g: Float32Array, w: number, h: number, r: number, step = 1): Float32Array {
  const out: number[] = [];
  for (let y = 0; y < h; y += step) {
    const edge = y < r || y >= h - r;
    for (let x = 0; x < (edge ? w : r); x += step) out.push(g[y * w + x]);
    if (!edge) for (let x = w - r; x < w; x += step) out.push(g[y * w + x]);
  }
  return Float32Array.from(out);
}

/** Median of the outer ring (a 2% border) under 0.5: light marks on a dark ground. */
const lightOnDark = (g: Float32Array, w: number, h: number) => quantiles(ringOf(g, w, h, Math.max(1, Math.round(Math.min(w, h) * 0.02))), [0.5])[0] < 0.5;

function invert(g: Float32Array): Float32Array {
  const out = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = 1 - g[i];
  return out;
}

/* ------------------------------------------------------------------ */
/* Line work                                                            */
/* ------------------------------------------------------------------ */

/** Sauvola's k and R (R is the standard 128 of 255, the widest standard deviation a 0–1 image has). */
const SAUVOLA_K = 0.2;
const SAUVOLA_R = 0.5;
/** The window, mm at print scale (brief 6.2). */
const WINDOW_MM = 15;
/** Specks and pinholes under this area are cleaned, mm². */
export const SPECK_MM2 = 0.3;
/** Darker than this (after levels) is ink whatever the neighbourhood: Sauvola alone hollows out a shape wider than its window. */
const ALWAYS_INK = 0.3;

/** Window sums of v and v² (a box of side 2r + 1, clipped at the edges) and their counts, by separable running sums. */
function boxMeans(g: Float32Array, w: number, h: number, r: number): { mean: Float32Array; sq: Float32Array } {
  const tm = new Float32Array(g.length), ts = new Float32Array(g.length);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let [s, q] = [0, 0];
    for (let x = 0; x < Math.min(w, r); x++) (s += g[o + x]), (q += g[o + x] * g[o + x]);
    for (let x = 0; x < w; x++) {
      if (x + r < w) (s += g[o + x + r]), (q += g[o + x + r] * g[o + x + r]);
      if (x - r - 1 >= 0) (s -= g[o + x - r - 1]), (q -= g[o + x - r - 1] * g[o + x - r - 1]);
      const n = Math.min(w - 1, x + r) - Math.max(0, x - r) + 1;
      tm[o + x] = s / n;
      ts[o + x] = q / n;
    }
  }
  const mean = new Float32Array(g.length), sq = new Float32Array(g.length);
  const [cs, cq] = [new Float64Array(w), new Float64Array(w)];
  for (let y = 0; y < Math.min(h, r); y++) for (let x = 0; x < w; x++) (cs[x] += tm[y * w + x]), (cq[x] += ts[y * w + x]);
  for (let y = 0; y < h; y++) {
    const [add, sub] = [y + r < h ? (y + r) * w : -1, y - r - 1 >= 0 ? (y - r - 1) * w : -1];
    const n = Math.min(h - 1, y + r) - Math.max(0, y - r) + 1;
    for (let x = 0; x < w; x++) {
      if (add >= 0) (cs[x] += tm[add + x]), (cq[x] += ts[add + x]);
      if (sub >= 0) (cs[x] -= tm[sub + x]), (cq[x] -= ts[sub + x]);
      mean[y * w + x] = cs[x] / n;
      sq[y * w + x] = cq[x] / n;
    }
  }
  return { mean, sq };
}

/**
 * Line work to ink (1 = ink): Sauvola's threshold, T = m·(1 + k·(s/R − 1))
 * over a window about 15 mm across at print scale, so a shadow across a
 * scan or a tinted sheet stays paper. The window sums run in O(1) a pixel
 * (running sums, the integral image's trick a row and a column at a time,
 * a fraction of its memory). Then the clean-up (clean).
 */
export function toLine(g: Float32Array, w: number, h: number, pxPerMm: number): Uint8Array {
  const r = Math.max(7, Math.round((WINDOW_MM * pxPerMm) / 2));
  const { mean, sq } = boxMeans(g, w, h, r);
  const ink = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) {
    const m = mean[i];
    const s = Math.sqrt(Math.max(0, sq[i] - m * m));
    ink[i] = g[i] < ALWAYS_INK || g[i] < m * (1 + SAUVOLA_K * (s / SAUVOLA_R - 1)) ? 1 : 0;
  }
  return clean(ink, w, h, pxPerMm);
}

/**
 * The line clean-up: ink specks (8-connected) and holes in the ink
 * (4-connected: the complementary pair, so a diagonal crack is never both
 * a join and a gap) under SPECK_MM2 at this scale are removed and filled.
 * A hole touching the edge is ground, never filled. In place; returns it.
 */
export function clean(ink: Uint8Array, w: number, h: number, pxPerMm: number): Uint8Array {
  const min = SPECK_MM2 * pxPerMm * pxPerMm;
  const seen = new Uint8Array(ink.length);
  const stack = new Int32Array(ink.length);
  const region = new Int32Array(Math.ceil(min) + 1);
  for (let want = 1; want >= 0; want--) {
    seen.fill(0);
    const eight = want === 1;
    for (let s0 = 0; s0 < ink.length; s0++) {
      if (ink[s0] !== want || seen[s0]) continue;
      let top = 0;
      let n = 0;
      let edge = false;
      stack[top++] = s0;
      seen[s0] = 1;
      while (top) {
        const p = stack[--top];
        if (n < region.length) region[n] = p;
        n++;
        const x = p % w;
        const y = (p - x) / w;
        const l = x > 0, r = x < w - 1, u = y > 0, d = y < h - 1;
        if (!l || !r || !u || !d) edge = true;
        if (l && ink[p - 1] === want && !seen[p - 1]) (seen[p - 1] = 1), (stack[top++] = p - 1);
        if (r && ink[p + 1] === want && !seen[p + 1]) (seen[p + 1] = 1), (stack[top++] = p + 1);
        if (u && ink[p - w] === want && !seen[p - w]) (seen[p - w] = 1), (stack[top++] = p - w);
        if (d && ink[p + w] === want && !seen[p + w]) (seen[p + w] = 1), (stack[top++] = p + w);
        if (!eight) continue;
        if (l && u && ink[p - w - 1] === want && !seen[p - w - 1]) (seen[p - w - 1] = 1), (stack[top++] = p - w - 1);
        if (r && u && ink[p - w + 1] === want && !seen[p - w + 1]) (seen[p - w + 1] = 1), (stack[top++] = p - w + 1);
        if (l && d && ink[p + w - 1] === want && !seen[p + w - 1]) (seen[p + w - 1] = 1), (stack[top++] = p + w - 1);
        if (r && d && ink[p + w + 1] === want && !seen[p + w + 1]) (seen[p + w + 1] = 1), (stack[top++] = p + w + 1);
      }
      if (n < min && (eight || !edge)) for (let i = 0; i < n; i++) ink[region[i]] = 1 - want;
    }
  }
  return ink;
}

/** Plain threshold at mid-grey (vector, words). */
function threshold(g: Float32Array, t = 0.5): Uint8Array {
  const out = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = g[i] < t ? 1 : 0;
  return out;
}

/* ------------------------------------------------------------------ */
/* Placement                                                            */
/* ------------------------------------------------------------------ */

type Box = { x: number; y: number; w: number; h: number };

/** The bounding box of the set pixels, or null. */
function bbox(m: Uint8Array | Float32Array, w: number, h: number, on = 0.5): Box | null {
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x] > on) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Where a box of bw × bh lands, fitted whole into the size's area: scaled to fit, top at the area's top, centred across. */
export function fit(bw: number, bh: number, size: PrintSize): Box {
  const B = BOXES[size];
  const k = Math.min(B.w / bw, B.h / bh);
  const [w, h] = [Math.max(1, Math.round(bw * k)), Math.max(1, Math.round(bh * k))];
  return { x: B.x + Math.round((B.w - w) / 2), y: B.y, w, h };
}

const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos3 = (x: number) => (x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

/** Pillow's resampling weights for one axis (ImagingResample: support widened when shrinking, weights normalised). */
function weights(inSize: number, outSize: number, from = 0, span = inSize) {
  const scale = span / outSize;
  const fs = Math.max(scale, 1);
  const support = 3 * fs;
  const lo = new Int32Array(outSize), n = new Int32Array(outSize);
  const taps = Math.ceil(support) * 2 + 1;
  const k = new Float32Array(outSize * taps);
  for (let o = 0; o < outSize; o++) {
    const c = from + (o + 0.5) * scale;
    const xmin = Math.max(Math.trunc(c - support + 0.5), 0);
    const xmax = Math.min(Math.trunc(c + support + 0.5), inSize);
    let sum = 0;
    for (let x = xmin; x < xmax && x - xmin < taps; x++) sum += k[o * taps + x - xmin] = lanczos3((x - c + 0.5) / fs);
    for (let x = 0; x < xmax - xmin && x < taps; x++) k[o * taps + x] /= sum || 1;
    lo[o] = xmin;
    n[o] = Math.min(taps, xmax - xmin);
  }
  return { lo, n, k, taps };
}

/**
 * Lanczos-3 resampling of the box (bx, by, bw, bh) of a w × h plane to
 * dw × dh, the filter Pillow's Image.resize(LANCZOS) uses (halftone.py's
 * upsample): separable, horizontal pass first, antialiased when shrinking.
 */
export function lanczos(src: Float32Array, w: number, h: number, dw: number, dh: number, box: Box = { x: 0, y: 0, w, h }): Float32Array {
  const H = weights(w, dw, box.x, box.w);
  const V = weights(h, dh, box.y, box.h);
  // Only the source rows the vertical pass reads.
  const r0 = V.lo[0], r1 = V.lo[dh - 1] + V.n[dh - 1];
  const tmp = new Float32Array((r1 - r0) * dw);
  for (let y = r0; y < r1; y++) {
    const o = y * w;
    const t = (y - r0) * dw;
    for (let x = 0; x < dw; x++) {
      let s = 0;
      const lo = o + H.lo[x], n = H.n[x], kk = x * H.taps;
      for (let j = 0; j < n; j++) s += src[lo + j] * H.k[kk + j];
      tmp[t + x] = s;
    }
  }
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const [lo, n, kk] = [V.lo[y] - r0, V.n[y], y * V.taps];
    const o = y * dw;
    for (let j = 0; j < n; j++) {
      const wt = V.k[kk + j];
      const t = (lo + j) * dw;
      for (let x = 0; x < dw; x++) out[o + x] += tmp[t + x] * wt;
    }
  }
  return out;
}

/** A plane of dw × dh pasted into a blank print grid at (x, y). */
function paste<T extends Uint8Array | Float32Array>(out: T, part: ArrayLike<number>, at: Box): T {
  for (let y = 0; y < at.h; y++) for (let x = 0; x < at.w; x++) out[(at.y + y) * OUT_W + at.x + x] = part[y * at.w + x];
  return out;
}

/**
 * An ink mask trimmed to its ink's box and fitted whole into Full or Small
 * on the 1500 × 2000 grid (fit): resampled with Lanczos and cut at half,
 * so edges stay smooth when a small file is scaled up.
 */
export function place(mask: Uint8Array, w: number, h: number, size: PrintSize): Uint8Array {
  const out = new Uint8Array(OUT_W * OUT_H);
  const b = bbox(mask, w, h);
  if (!b) return out;
  const at = fit(b.w, b.h, size);
  const src = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) src[i] = mask[i];
  const r = lanczos(src, w, h, at.w, at.h, b);
  const bits = new Uint8Array(r.length);
  for (let i = 0; i < r.length; i++) bits[i] = r[i] >= 0.5 ? 1 : 0;
  return paste(out, bits, at);
}

/* ------------------------------------------------------------------ */
/* Photographs: the tone, and the screen (port of halftone.py)          */
/* ------------------------------------------------------------------ */

/** The outer ring (5% of the short side) is flat below this luminance σ: a backdrop, removable (brief 6.2). */
export const FLAT_RING = 0.06;
/** The flood from the border takes pixels within this of the ring's median luminance: a backdrop's shading, not the subject's edge. */
export const BG_TOLERANCE = 0.1;

/**
 * A photograph's tone at its own size: the background taken off only when
 * the outer 5% ring is flat (σ < FLAT_RING), by a flood fill from the
 * border within BG_TOLERANCE of the ring's median (never a crop into the
 * subject, no cut-out model); then levels (1st–99th percentile) over what's
 * left. Returns the luminance, the picture's own pixels (alpha) and their
 * box. Screening happens later, after placement, at the print's resolution.
 */
export function toDots(g: Float32Array, w: number, h: number): { lum: Float32Array; alpha: Float32Array; box: Box } {
  const ring = ringOf(g, w, h, Math.max(1, Math.round(Math.min(w, h) * 0.05)), 2);
  let [s, s2] = [0, 0];
  for (const v of ring) (s += v), (s2 += v * v);
  const sigma = Math.sqrt(Math.max(0, s2 / ring.length - (s / ring.length) ** 2));
  const alpha = new Float32Array(g.length).fill(1);
  if (sigma < FLAT_RING) {
    const med = quantiles(ring, [0.5])[0];
    const stack = new Int32Array(g.length);
    let top = 0;
    const push = (p: number) => {
      if (alpha[p] && Math.abs(g[p] - med) <= BG_TOLERANCE) (alpha[p] = 0), (stack[top++] = p);
    };
    for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
    for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
    while (top) {
      const p = stack[--top];
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < g.length - w) push(p + w);
    }
    // Nothing (or almost nothing) left: the "backdrop" was the picture. Keep it whole.
    let kept = 0;
    for (let i = 0; i < alpha.length; i++) kept += alpha[i];
    if (kept < 0.02 * alpha.length) alpha.fill(1);
  }
  const lum = levels(g, alpha);
  return { lum, alpha, box: bbox(alpha, w, h) ?? { x: 0, y: 0, w, h } };
}

/** The screen (halftone.py): 30 lpi at 45°, on the 28 cm grid. */
export const LPI = 30;
export const ANGLE = 45;
/** Maximum ink: the darkest tone prints as 80% dots, an open mesh, never a solid slab (halftone.py MAX_TONE). */
export const MAX_TONE = 0.8;
/** A square this wide (px, ~3.5 mm) fitting inside the dark is a mass, capped at MAX_TONE; a stroke narrower stays solid (halftone.py SLAB_PX). */
export const SLAB_PX = 19;
/**
 * The smallest dot, 8% of a cell (about 0.3 mm across): a smaller one
 * doesn't hold on a tee. Tones under half of it print nothing, the rest at
 * least this (brief 6.2, dots 8–80%; halftone.py has no floor, its tiny
 * dots simply vanish at 4.5 px a cell).
 */
export const MIN_DOT = 0.08;

let screenMap: Float32Array | null = null;
/** The AM threshold map: 0 at each dot's centre rising to 1 at the cell's corners (round dots that join past 50%). */
export function screenAt(): Float32Array {
  if (screenMap) return screenMap;
  const cell = OUT_W / (28 / 2.54) / LPI;
  const t = (ANGLE * Math.PI) / 180;
  const [c, s] = [Math.cos(t), Math.sin(t)];
  // u = (x·c + y·s) / cell and v = (−x·s + y·c) / cell, so each cosine splits into per-column and per-row tables (cos(a ± b)).
  const table = (n: number, k: number) => {
    const [co, si] = [new Float64Array(n), new Float64Array(n)];
    for (let i = 0; i < n; i++) (co[i] = Math.cos((2 * Math.PI * (i + 0.5) * k) / cell)), (si[i] = Math.sin((2 * Math.PI * (i + 0.5) * k) / cell));
    return [co, si];
  };
  const [xc, xs] = table(OUT_W, c), [ys, yss] = table(OUT_H, s), [xs2, xss2] = table(OUT_W, s), [yc, ycs] = table(OUT_H, c);
  const m = new Float32Array(OUT_W * OUT_H);
  for (let y = 0; y < OUT_H; y++)
    for (let x = 0; x < OUT_W; x++) {
      const cu = xc[x] * ys[y] - xs[x] * yss[y];
      const cv = yc[y] * xs2[x] + ycs[y] * xss2[x];
      m[y * OUT_W + x] = 0.5 - (cu + cv) / 4;
    }
  return (screenMap = m);
}

/**
 * Binary erosion (outside counts as set, as OpenCV's erode) or dilation
 * (outside unset) by a k × k square: separable running counts, the
 * vertical pass a row at a time so memory is read in order.
 */
function morph(m: Uint8Array, w: number, h: number, k: number, erode: boolean): Uint8Array {
  const r = k >> 1;
  const e = erode ? 1 : 0;
  const t = new Uint8Array(m.length);
  // Nothing set stays nothing (the edges only matter next to something set).
  if (m.indexOf(1) < 0) return t;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    if (erode && m.subarray(o, o + w).indexOf(1) < 0) continue;
    let c = r * e;
    for (let x = 0; x < r; x++) c += x < w ? m[o + x] : e;
    for (let x = 0; x < w; x++) {
      c += x + r < w ? m[o + x + r] : e;
      t[o + x] = erode ? +(c === k) : +(c > 0);
      c -= x - r >= 0 ? m[o + x - r] : e;
    }
  }
  const out = new Uint8Array(m.length);
  const col = new Int32Array(w);
  for (let y = -r; y < r; y++) for (let x = 0; x < w; x++) col[x] += y < 0 || y >= h ? e : t[y * w + x];
  for (let y = 0; y < h; y++) {
    const [add, sub, o] = [(y + r) * w, (y - r) * w, y * w];
    const inAdd = y + r < h, inSub = y - r >= 0;
    for (let x = 0; x < w; x++) {
      const c = col[x] + (inAdd ? t[add + x] : e);
      out[o + x] = erode ? +(c === k) : +(c > 0);
      col[x] = c - (inSub ? t[sub + x] : e);
    }
  }
  return out;
}

/**
 * The screen proper, on a tone at the print's resolution (0–1 ink per
 * pixel, OUT_W × OUT_H), as halftone.py: highlights cleaned
 * ((D − 0.04) / 0.92), the dot floor (MIN_DOT), a dark mass wider than
 * SLAB_PX capped at MAX_TONE (an opening by a SLAB_PX square: strokes keep
 * full ink), then each pixel is ink where the tone beats the screen.
 */
export function screenTone(D: Float32Array): Uint8Array {
  const n = OUT_W * OUT_H;
  const d = new Float32Array(n);
  const dark = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    let v = (D[i] - 0.04) / 0.92;
    v = v < MIN_DOT / 2 ? 0 : v > 1 ? 1 : v < MIN_DOT ? MIN_DOT : v;
    d[i] = v;
    if (v > MAX_TONE) (dark[i] = 1), (any = true);
  }
  const mass = any ? morph(morph(dark, OUT_W, OUT_H, SLAB_PX, true), OUT_W, OUT_H, SLAB_PX, false) : dark;
  const s = screenAt();
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) ink[i] = (mass[i] && d[i] > MAX_TONE ? MAX_TONE : d[i]) > s[i] ? 1 : 0;
  return ink;
}

/** A placed tone as ink for a tee, never inverted: a black tee's white ink draws the lights, a white tee's black ink the darks. */
export function screen(tone: Tone, tee: Tee): Uint8Array {
  const n = OUT_W * OUT_H;
  const D = new Float32Array(n);
  const { lum, alpha } = tone;
  for (let i = 0; i < n; i++) {
    const a = alpha[i] * 1.2;
    if (a <= 0) continue;
    const l = lum[i] < 0 ? 0 : lum[i] > 1 ? 1 : lum[i];
    D[i] = (tee === "black" ? l : 1 - l) * (a > 1 ? 1 : a);
  }
  return screenTone(D);
}

/** The ink for a tee: a photograph's own screen for it; line work is the same shapes either way (the black tee prints them in white). */
export const inkFor = (c: Converted, tee: Tee): Uint8Array => (c.tone ? screen(c.tone, tee) : c.ink);

/** A photograph's tone placed on the grid: its picture's box fitted like any print. */
function placeTone(t: ReturnType<typeof toDots>, w: number, h: number, size: PrintSize): { tone: Tone; at: Box } {
  const at = fit(t.box.w, t.box.h, size);
  const lum = paste(new Float32Array(OUT_W * OUT_H), lanczos(t.lum, w, h, at.w, at.h, t.box), at);
  // A picture kept whole is simply its box; only a removed background needs its edge resampled.
  let whole = true;
  for (let i = 0; i < t.alpha.length && whole; i++) whole = t.alpha[i] === 1;
  const alpha = whole ? paste(new Float32Array(OUT_W * OUT_H), new Float32Array(at.w * at.h).fill(1), at) : paste(new Float32Array(OUT_W * OUT_H), lanczos(t.alpha, w, h, at.w, at.h, t.box), at);
  return { tone: { lum, alpha }, at };
}

/* ------------------------------------------------------------------ */
/* Photographs as lines: Canny                                          */
/* ------------------------------------------------------------------ */

/** The narrowest line a Lines print draws, mm (brief 6.2). */
export const EDGE_MM = 0.6;
/** Canny's blur, mm at print scale: finer picks up a photograph's grain as lines. */
const EDGE_SIGMA_MM = 0.5;
/** Strong edges: this quantile of the thinned gradient's strength (weak ones at 40% of it, kept where they join a strong one). */
const EDGE_HIGH = 0.95;

/** Separable Gaussian blur, σ in px (edges clamped). */
function gauss(g: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const kk = k.map((v) => v / sum);
  const t = new Float32Array(g.length), out = new Float32Array(g.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) s += g[y * w + Math.min(w - 1, Math.max(0, x + j))] * kk[j + r];
      t[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) s += t[Math.min(h - 1, Math.max(0, y + j)) * w + x] * kk[j + r];
      out[y * w + x] = s;
    }
  return out;
}

/**
 * Canny edges: a Gaussian (σ = EDGE_SIGMA_MM at print scale), Sobel, thinning by
 * non-maximum suppression along the gradient, then hysteresis (strong
 * edges at the EDGE_HIGH quantile of the surviving magnitudes, weak at 40% of
 * that, weak kept only when joined to strong). The one-pixel edges are
 * widened by a disc so every line is at least EDGE_MM, then the clean-up.
 */
export function toEdges(g: Float32Array, w: number, h: number, pxPerMm: number): Uint8Array {
  const b = gauss(g, w, h, Math.max(1, EDGE_SIGMA_MM * pxPerMm));
  const mag = new Float32Array(g.length);
  const dir = new Uint8Array(g.length);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = b[i - w + 1] + 2 * b[i + 1] + b[i + w + 1] - b[i - w - 1] - 2 * b[i - 1] - b[i + w - 1];
      const gy = b[i + w - 1] + 2 * b[i + w] + b[i + w + 1] - b[i - w - 1] - 2 * b[i - w] - b[i - w + 1];
      mag[i] = Math.hypot(gx, gy);
      // Gradient direction in four sectors: 0 = horizontal, 1 = 45°, 2 = vertical, 3 = 135°.
      const a = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      dir[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
    }
  const nms = new Float32Array(g.length);
  const off = [1, w + 1, w, w - 1];
  const kept: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < 1e-3) continue;
      const o = off[dir[i]];
      if (m >= mag[i + o] && m > mag[i - o]) (nms[i] = m), kept.push(m);
    }
  const out = new Uint8Array(g.length);
  if (!kept.length) return out;
  const scaled = new Float32Array(kept.length);
  for (let i = 0; i < kept.length; i++) scaled[i] = Math.min(1, kept[i] / 6);
  const high = quantiles(scaled, [EDGE_HIGH])[0] * 6;
  const low = high * 0.4;
  const stack: number[] = [];
  for (let i = 0; i < nms.length; i++) if (nms[i] >= high && nms[i] > 0) (out[i] = 1), stack.push(i);
  while (stack.length) {
    const p = stack.pop()!;
    for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) {
      const q = p + d;
      if (q >= 0 && q < out.length && !out[q] && nms[q] >= low && nms[q] > 0) (out[q] = 1), stack.push(q);
    }
  }
  return clean(widen(out, w, h, Math.max(1, Math.ceil((EDGE_MM / 2) * pxPerMm))), w, h, pxPerMm);
}

/** Dilation by a disc of radius r px: each ink pixel stamps the disc, one row span at a time. */
function widen(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(m.length);
  const span = Array.from({ length: 2 * r + 1 }, (_, i) => Math.floor(Math.sqrt(r * r + r - (i - r) ** 2)));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let j = 0; j <= 2 * r; j++) {
        const ny = y + j - r;
        if (ny < 0 || ny >= h) continue;
        const o = ny * w;
        const x1 = Math.min(w - 1, x + span[j]);
        for (let nx = Math.max(0, x - span[j]); nx <= x1; nx++) out[o + nx] = 1;
      }
    }
  return out;
}

/* ------------------------------------------------------------------ */
/* SVG                                                                  */
/* ------------------------------------------------------------------ */

export const SVG_REFUSED = REASONS.svg;

/** Elements that run code, load something or embed another document or picture ([ns:]name, any case). */
const BAD_TAGS = /<\s*(?:[\w-]+:)?(?:script|foreignobject|image|feimage|iframe|embed|object|audio|video|canvas|link|meta|base|handler|listener)\b/i;
/** Anything that reaches outside the file: a href or url() not pointing at "#" in the same file, @import, a scheme. */
const BAD_REFS = [
  /\b(?:[\w-]+:)?href\s*=(?!\s*["']?\s*#)/i,
  /url\s*\((?!\s*["']?\s*#)/i,
  /@import/i,
  /javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i,
  /<!\s*(?:entity|doctype|element|attlist)/i,
  /<\?\s*xml-stylesheet/i,
  // Animating an attribute into a link or handler.
  /\battributename\s*=\s*["']?\s*(?:[\w-]+:)?(?:href|on\w+)/i,
];

/**
 * Checks an uploaded SVG before the worker rasterises it (brief 6.2): no
 * script, foreignObject, event attribute, external reference or embedded
 * picture, no DOCTYPE or entity (the billion-laughs and external-entity
 * tricks). Refuses rather than repairs: a file that needs repairing isn't
 * one we'd print as drawn. String checks on the raw text, case- and
 * whitespace-insensitive, and deliberately strict (a forbidden word inside
 * a comment refuses too).
 */
/** The most shapes an uploaded SVG may draw, every <use> expanded. */
const SVG_MAX_SHAPES = 100_000;

/**
 * How many elements an SVG draws once every <use> is expanded: each element
 * counts in the scope of its nearest ancestor with an id, a <use> adds its
 * target's count, and a scope inside another counts in it too. A <use>
 * cycle counts as infinite.
 */
export function shapesOf(svg: string): number {
  const own = new Map<string, number>();
  const refs = new Map<string, string[]>();
  const stack: { name: string; id?: string }[] = [];
  const scope = () => [...stack].reverse().find((e) => e.id)?.id ?? "#root";
  const add = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  for (const [tag] of svg.matchAll(/<[^>!?][^>]*>/g)) {
    const close = /^<\s*\//.exec(tag);
    const name = /^<\s*\/?\s*([\w:-]+)/.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (close) {
      const at = stack.map((e) => e.name).lastIndexOf(name);
      if (at >= 0) stack.length = at;
      continue;
    }
    const here = scope();
    own.set(here, (own.get(here) ?? 0) + 1);
    const id = /\sid\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name === "use") {
      const target = /href\s*=\s*["']\s*#([^"']+)["']/i.exec(tag)?.[1];
      if (target) add(refs, here, target);
    }
    if (id) add(refs, here, id);
    if (!/\/\s*>$/.test(tag)) stack.push({ name, id });
  }
  const memo = new Map<string, number>();
  const busy = new Set<string>();
  const weight = (k: string): number => {
    if (memo.has(k)) return memo.get(k)!;
    if (busy.has(k)) return Infinity;
    busy.add(k);
    let n = own.get(k) ?? 0;
    for (const r of refs.get(k) ?? []) n += weight(r);
    busy.delete(k);
    memo.set(k, n);
    return n;
  };
  return weight("#root");
}

export function sanitiseSvg(text: string): { ok: true; svg: string } | { ok: false; reason: typeof SVG_REFUSED } {
  const no = { ok: false, reason: SVG_REFUSED } as const;
  const svg = text.replace(/^﻿/, "").trim();
  if (!/<\s*svg\b/i.test(svg) || BAD_TAGS.test(svg) || BAD_REFS.some((r) => r.test(svg))) return no;
  // Event attributes inside any tag: onload=, onclick = …, also after a newline or a slash.
  for (const [tag] of svg.matchAll(/<[^>]*>/g)) if (/[\s/"']on[a-z]+\s*=/i.test(tag)) return no;
  // Size: nested <use> multiplies (7 levels of ten is ten million shapes); no artwork needs that many.
  if (shapesOf(svg) > SVG_MAX_SHAPES) return no;
  // CSS escapes (u\72l(…), @\69mport) would slip past the checks above; artwork doesn't need them.
  if (/<style[\s\S]*?\\|style\s*=\s*["'][^"']*\\/i.test(svg)) return no;
  return { ok: true, svg };
}

/* ------------------------------------------------------------------ */
/* The whole conversion                                                 */
/* ------------------------------------------------------------------ */

/** Source px per print mm when the whole w × h picture is fitted into the size (an estimate before trimming: the trimmed print is a little larger). */
const pxPerMmFor = (w: number, h: number, size: PrintSize) => w / (fit(w, h, size).w * MM_PER_PX);

export interface ConvertInput {
  pixels?: Pixels;
  svgRaster?: Pixels;
}

/**
 * An upload to a print: the class (vector for an SVG, otherwise line or
 * photo by its midtones), the mode (the class's own
 * unless Dots or Lines is asked of a photograph, or Drawing, which reads
 * it as line work), and the ink on the 1500 × 2000 grid for Full or Small.
 */
export function convert(input: ConvertInput, opts: { mode?: Ask; size: PrintSize }): Converted {
  const { size } = opts;
  const src = input.svgRaster ?? input.pixels;
  if (!src) throw new Error("convert: nothing to convert");
  const p = downscale(src, workLong(src.w, src.h));
  let g = grey(p);
  const { w, h } = p;
  const midtones = midtonesOf(p);
  // Drawing: a photograph of paper (its shading reads as midtones) taken as the line work it is.
  const cls: UploadClass = input.svgRaster ? "vector" : midtones < LINE_MIDTONES || opts.mode === "drawing" ? "line" : "photo";
  const base = { cls, size, w: OUT_W, h: OUT_H, midtones } as const;
  if (cls === "photo") {
    const mode: Mode = opts.mode === "lines" ? "lines" : "dots";
    const t = toDots(g, w, h);
    let [sum, n] = [0, 0];
    for (let i = 0; i < t.lum.length; i++) if (t.alpha[i]) (sum += g[i]), n++;
    const darkOnLight = sum / Math.max(1, n) < 0.5;
    const { tone, at } = placeTone(t, w, h, size);
    if (mode === "dots") return { ...base, mode, darkOnLight, tone, ink: screen(tone, darkOnLight ? "white" : "black") };
    // Lines: edges found on the tone as placed (so σ and the stroke are print millimetres), then trimmed and fitted again.
    const part = new Float32Array(at.w * at.h);
    for (let y = 0; y < at.h; y++)
      for (let x = 0; x < at.w; x++) {
        const i = (at.y + y) * OUT_W + at.x + x;
        const a = Math.min(1, tone.alpha[i]);
        part[y * at.w + x] = tone.lum[i] * a + (1 - a);
      }
    const edges = toEdges(part, at.w, at.h, PX_PER_MM);
    return { ...base, mode, darkOnLight: true, tone: null, ink: clean(place(edges, at.w, at.h, size), OUT_W, OUT_H, PX_PER_MM) };
  }
  // Line work keeps its polarity: light marks on a dark ground are the ink, printed on a black tee.
  const darkOnLight = !lightOnDark(g, w, h);
  if (!darkOnLight) g = invert(g);
  const mode: Mode = cls;
  const mask = cls === "line" ? toLine(levels(g), w, h, pxPerMmFor(w, h, size)) : threshold(g);
  return { ...base, mode, darkOnLight, tone: null, ink: clean(place(mask, w, h, size), OUT_W, OUT_H, PX_PER_MM) };
}
