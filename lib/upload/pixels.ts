/**
 * The picture, prepared for a setting, on the page (browser only): turned,
 * mirrored, cropped, scaled, its light and contrast set. Kept apart from
 * the engine (client.ts) and the converter, so the stage and the edit
 * sheet can draw with it without loading either.
 */
import type { Pixels } from "./convert";
import type { Settings, Source } from "./client";

/** The worker's decode cap (brief 6.2): the long side, px. */
export const MAX_LONG = 3000;
/** Light and contrast run from -TONE_MAX to TONE_MAX (0: as taken). */
export const TONE_MAX = 50;

/** The crop in the source's own pixels (after the turn), and its short side. */
export function cropPixels(src: Pick<Source, "w" | "h">, s: Pick<Settings, "crop" | "rot">) {
  const [tw, th] = s.rot % 180 ? [src.h, src.w] : [src.w, src.h];
  const c = s.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const box = { x: Math.round(c.x * tw), y: Math.round(c.y * th), w: Math.max(1, Math.round(c.w * tw)), h: Math.max(1, Math.round(c.h * th)) };
  return { tw, th, box, short: Math.min(box.w, box.h) };
}

function canvas2d(w: number, h: number) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  return { c, ctx: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}

/** The picture turned, mirrored, cropped and scaled to at most `long` on its long side, then its light and contrast set (and made stronger when asked). */
export function sourcePixels(src: Source, s: Pick<Settings, "crop" | "rot" | "stronger"> & Partial<Pick<Settings, "flip" | "light" | "contrast">>, long = MAX_LONG): Pixels {
  const { box, tw, th } = cropPixels(src, s);
  const k = Math.min(1, long / Math.max(box.w, box.h));
  const [w, h] = [Math.max(1, Math.round(box.w * k)), Math.max(1, Math.round(box.h * k))];
  const { ctx } = canvas2d(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-box.x, -box.y);
  // The turn about the turned image's own frame.
  ctx.translate(tw / 2, th / 2);
  // The mirror in the turned frame: turned first, then flipped left to right, as the edit sheet shows it.
  if (s.flip) ctx.scale(-1, 1);
  ctx.rotate((s.rot * Math.PI) / 180);
  ctx.drawImage(src.bitmap!, -src.w / 2, -src.h / 2);
  ctx.restore();
  const data = ctx.getImageData(0, 0, w, h).data;
  if (s.light || s.contrast) tone(data, s.light ?? 0, s.contrast ?? 0);
  if (s.stronger) strengthen(data);
  return { w, h, data };
}

/**
 * Light and contrast, as the edit sheet's sliders set them: each channel
 * scaled by 1 + light/100, then spread about the middle grey by
 * 1 + contrast/100 (the order CSS's brightness() and contrast() filters use).
 */
export function tone(data: Uint8ClampedArray, light: number, contrast: number) {
  const [b, c] = [1 + light / 100, 1 + contrast / 100];
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round(((v / 255) * b - 0.5) * c * 255 + 127.5);
  for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) data[i + k] = lut[data[i + k]];
}

/**
 * "Stronger": the luminance stretched from its 2nd to its 98th percentile,
 * then a gamma of 1.35 (the mid-tones darker), so a pale picture carries
 * enough contrast to print. Colour follows the luminance.
 */
export function strengthen(data: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  const n = data.length / 4;
  for (let i = 0; i < n; i++) hist[Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2])]++;
  const at = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= q * n) return v;
    return 255;
  };
  const [lo, hi] = [at(0.02), Math.max(at(0.98), at(0.02) + 1)];
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, (v - lo) / (hi - lo))), 1.35));
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = lut[data[i + c]];
}
