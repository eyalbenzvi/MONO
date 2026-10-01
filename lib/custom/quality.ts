/**
 * The prints' ink analysis, pure (the generator, the audit and the browser's
 * personalised prints judge a print by the same numbers): the quality score,
 * on an InkRaster. Rasterising a print happens elsewhere: resvg in
 * scripts/gen/quality.ts, a canvas in the browser.
 */
import type { BaseColor, Medium } from "../../types/shirt";

/**
 * Below this quality score (assessPrint, 0–100) a print is weak: never in
 * the taste test, the shop window, "picked for you" rows or the default
 * link preview. Calibrated so about the bottom tenth of the catalogue is weak.
 */
export const WEAK_QUALITY = 53;
/** Weak: a low score, or a flag (a sliver, a paper edge or vignette, a flat picture). */
export const isWeak = (s: { quality: number; flags: readonly string[] }) => s.quality < WEAK_QUALITY || s.flags.length > 0;

/** The printed area on the tee, cm (the 300×400 print; matches PRINT_SIZE_CM). */
const PRINT_CM = { width: 28, height: 37 };

/* ------------------------------------------------------------------ */
/* Ink masks                                                            */
/* ------------------------------------------------------------------ */

/** Ink per pixel (0–1) of a print as it lands on its tee: white ink on black, black on white — the same shape either way. */
export interface InkRaster {
  w: number;
  h: number;
  ink: Float32Array;
}

/** The check runs at the print's own size (300 × 400, about 1 mm a pixel on the tee). */
export const CHECK_W = 300;
export const CHECK_H = 400;


/**
 * A WebP print's ink, from its RGBA pixels (any size): an ink print is black
 * ink whose alpha is its strength; a photograph lands on its tee as the
 * picture's lights (black tee) or darks (white tee), never inverted.
 */
export function rasterInk(rgba: Uint8Array | Buffer, w: number, h: number, medium: Medium, baseColor: BaseColor): InkRaster {
  const ink = new Float32Array(w * h);
  for (let i = 0; i < ink.length; i++) {
    const l = rgba[i * 4] / 255;
    const a = rgba[i * 4 + 3] / 255;
    ink[i] = medium === "ink" ? a * (1 - l) : baseColor === "black" ? l * a : a * (1 - l);
  }
  return { w, h, ink };
}

/** A pixel counts as ink from this much (0–1). */
const ON = 0.35;

/* ------------------------------------------------------------------ */
/* Quality score (content overhaul, Part 6)                             */
/* ------------------------------------------------------------------ */

export interface Assessment {
  /** 0–100: how well the print carries on a tee (see assessPrint). */
  quality: number;
  /** The ink's real size on the tee, cm (its bounding box on the 28 × 37 cm area). */
  printCm: { width: number; height: number };
  /** Mean ink over the print area (0–1). */
  ink: number;
  /** The ink's bounding box as a share of the print area. */
  extent: number;
  /** What's wrong with it: a sliver of a picture, a paper edge or vignette, a flat snapshot. */
  flags: ("sliver" | "vignette" | "flat")[];
}

/** Below this share of the print area, the picture is a sliver on the tee. */
/** A sliver: the ink's box under this share of the print's width or height (a strip across the chest). */
export const SLIVER = 0.3;

/**
 * Quality 0–100 for any print — drawn, ink or halftone photograph — from
 * its ink as it lands on the tee:
 * - coverage (35%): too sparse or too solid both lose;
 * - extent (25%): how much of the print area the ink's box spans;
 * - detail (40%): how much the ink density changes from place to place,
 *   measured on a coarse density map (so a dot screen reads by the picture
 *   it makes, not by its dots).
 * Flags: a sliver (box under SLIVER of the width or height), a vignette or paper edge
 * (ink crowding the box's outline around an empty middle), a flat picture
 * (almost no change in density: a dim interior snapshot).
 */
/**
 * Detail: how much the ink's density changes across a coarse map (4 × 4 px
 * cells, ~4 mm on the tee), per cell of the ink's own box (`extent`, its
 * share of the print), so a small dense print isn't penalised twice. Shared
 * with the upload checks (lib/upload/measure detailOf).
 */
export function densityDetail(ink: ArrayLike<number>, w: number, h: number, extent: number): number {
  const C = 4;
  const cw = Math.floor(w / C);
  const ch = Math.floor(h / C);
  const dens = new Float32Array(cw * ch);
  for (let y = 0; y < ch * C; y++) for (let x = 0; x < cw * C; x++) dens[Math.floor(y / C) * cw + Math.floor(x / C)] += ink[y * w + x] / (C * C);
  let grad = 0;
  for (let y = 0; y < ch - 1; y++)
    for (let x = 0; x < cw - 1; x++) {
      const d = dens[y * cw + x];
      grad += Math.abs(dens[y * cw + x + 1] - d) + Math.abs(dens[(y + 1) * cw + x] - d);
    }
  return grad / Math.max(1, extent * cw * ch);
}

export function assessPrint({ w, h, ink }: InkRaster): Assessment {
  let sum = 0;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = ink[y * w + x];
      sum += a;
      if (a > ON) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const cover = sum / (w * h);
  const bw = x1 < 0 ? 0 : (x1 - x0 + 1) / w;
  const bh = y1 < 0 ? 0 : (y1 - y0 + 1) / h;
  const extent = bw * bh;
  const detail = densityDetail(ink, w, h, extent);
  // Sparse line work (a star chart, a diagram) is full marks from 4% ink; a print mostly ink loses them.
  const coverScore = cover < 0.04 ? cover / 0.04 : cover <= 0.32 ? 1 : Math.max(0.2, 1 - (cover - 0.32) / 0.4);
  const extentScore = Math.min(1, Math.sqrt(extent) / 0.72);
  const detailScore = Math.min(1, detail / 0.35);
  const quality = Math.round(100 * (0.35 * coverScore + 0.25 * extentScore + 0.4 * detailScore));
  // Vignette / paper edge: the outer ring of the box carries far more ink than its middle.
  const flags: Assessment["flags"] = [];
  if (x1 >= 0 && Math.min(bw, bh) < SLIVER) flags.push("sliver");
  if (x1 >= 0) {
    const ring = Math.max(2, Math.round(Math.min(x1 - x0, y1 - y0) * 0.06));
    let [rin, rn, min, mn] = [0, 0, 0, 0];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const edge = x - x0 < ring || x1 - x < ring || y - y0 < ring || y1 - y < ring;
        if (edge) (rin += ink[y * w + x]), rn++;
        else (min += ink[y * w + x]), mn++;
      }
    if (rn && mn && rin / rn > 0.25 && rin / rn > 3 * (min / mn)) flags.push("vignette");
  }
  if (detail < 0.06 && cover > 0.02) flags.push("flat");
  return {
    quality,
    printCm: { width: Math.max(1, Math.round(bw * PRINT_CM.width)), height: Math.max(1, Math.round(bh * PRINT_CM.height)) },
    ink: cover,
    extent,
    flags,
  };
}

/** Share of a raster's inked pixels that are neither ink nor ground (must be 0 for a one-ink print). */
export function midtones({ ink }: InkRaster): number {
  let on = 0;
  let mid = 0;
  for (let i = 0; i < ink.length; i++) {
    if (ink[i] > 0.02) on++;
    if (ink[i] > 0.02 && ink[i] < 0.98) mid++;
  }
  return on ? mid / on : 0;
}
