/**
 * Halftone prints shrunk by the browser: a phone's GPU samples the fine dots
 * instead of averaging them, and the print turns into coarse blocks (a
 * checkerboard). Here the print is shrunk once, properly, into a canvas at
 * the size it's shown in device pixels (components/PrintImage).
 */

/** Past this much shrinking the browser is not trusted with the print. */
export const SMOOTH_FROM = 1.1;
/** Canvas sizes go up in these steps, so a pinch redraws a few times, not every frame. */
const STEP = 1.25;

/**
 * The canvas width for a print `natural` px wide shown at `need` device px,
 * or 0 when the browser can show the file itself (little or no shrinking).
 */
export function smoothWidth(natural: number, need: number): number {
  if (!(natural > 0) || !(need > 0) || natural <= need * SMOOTH_FROM) return 0;
  // The next step up from what's needed (never short of pixels), within the file.
  const w = Math.ceil(STEP ** Math.ceil(Math.log(need) / Math.log(STEP)));
  return w * SMOOTH_FROM >= natural ? 0 : w;
}

/**
 * The widths to halve through on the way from `natural` to `target`: each
 * halving averages 2 × 2 pixels exactly, so no dot is dropped; the last step
 * is under 2×.
 */
export function halvings(natural: number, target: number): number[] {
  const out: number[] = [];
  let w = natural;
  while (w / 2 >= target) out.push((w = Math.round(w / 2)));
  if (out[out.length - 1] !== target) out.push(target);
  return out;
}

/** Draw `img` into `canvas`, `width` px wide (keeping its aspect). Returns false if it can't. */
export function drawSmooth(img: HTMLImageElement, canvas: HTMLCanvasElement, width: number): boolean {
  const ratio = img.naturalHeight / img.naturalWidth;
  let src: CanvasImageSource = img;
  let sw = img.naturalWidth;
  for (const w of halvings(img.naturalWidth, width)) {
    const step = document.createElement("canvas");
    step.width = w;
    step.height = Math.round(w * ratio);
    const ctx = step.getContext("2d");
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, sw, Math.round(sw * ratio), 0, 0, step.width, step.height);
    src = step;
    sw = w;
  }
  const out = canvas.getContext("2d");
  if (!out) return false;
  canvas.width = width;
  canvas.height = Math.round(width * ratio);
  out.drawImage(src, 0, 0);
  return true;
}
