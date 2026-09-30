/**
 * Ink on cloth: how a print sits on the tee in a mockup, the same arithmetic
 * in the build's baker (scripts/images/bake mockup, detail) and the page's
 * close-up (lib/custom/raster drawDetail); the live mockup takes a shortcut
 * with the same density (BLEND_ALPHA).
 *
 * The ink is screened onto a black tee and multiplied onto a white one, as a
 * plain blend would, with two things a real print has and a flat blend lacks:
 * - density: plastisol white on black is not paper white, black on white not
 *   a hole (INK), so the print reads as ink, not a sticker;
 * - the cloth's folds: where the shirt's own tone dips below its average (a
 *   crease, a shadow under the chest) the ink dips with it, where it lifts the
 *   ink lifts (FOLDS). The average is the print box's own, so only the folds
 *   and the light across the chest move the ink, never the tee's colour.
 * Where there's no ink the photo is untouched; antialiased edges blend by
 * their coverage.
 */
import type { BaseColor } from "@/types/shirt";

/** The ink's lightness on each tee (0–1): white ink on black, black ink on white. */
export const INK: Record<BaseColor, number> = { black: 0.93, white: 0.1 };
/** How strongly the cloth's tone moves the ink (1: as much as the cloth itself moves). */
export const FOLDS: Record<BaseColor, number> = { black: 1.6, white: 0.5 };

/**
 * The live preview's shortcut (lib/custom/raster drawMockup, redrawn at every
 * keystroke and across a grid of cards): the plain screen or multiply blend
 * laid at this opacity gives the ink its density (white ink on a black tee
 * lands at INK.black, black ink on white near INK.white) with no pixel pass;
 * only the folds are left to the close-up and the baked pictures.
 */
export const BLEND_ALPHA: Record<BaseColor, number> = { black: INK.black, white: 1 - INK.white };

const lum = (px: ArrayLike<number>, i: number) => (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;

/**
 * Lays the print on the photo in place. `photo` holds the print box's pixels
 * (RGB or RGBA, `photoStride` bytes a pixel); `print` the print at the same
 * size in the tee colour's inks on its ground (grey or RGBA, `printStride`
 * bytes a pixel, its first channel read): white ink on black for a black tee,
 * black on white for a white one.
 */
export function inkOnCloth(photo: { [i: number]: number; length: number }, photoStride: number, print: ArrayLike<number>, printStride: number, color: BaseColor): void {
  const n = Math.floor(photo.length / photoStride);
  // The cloth's average tone, from a sample (every 7th pixel: the average of a whole chest, not a detail).
  let [sum, count] = [0, 0];
  for (let k = 0; k < n; k += 7, count++) sum += lum(photo, k * photoStride);
  const mean = count ? sum / count : 0;
  const [ink, folds] = [INK[color], FOLDS[color]];
  const black = color === "black";
  for (let k = 0; k < n; k++) {
    const v = print[k * printStride];
    // Most of the box is bare cloth: skipped at once.
    if (black ? v === 0 : v === 255) continue;
    const a = (black ? v : 255 - v) / 255;
    const i = k * photoStride;
    const tone = Math.min(1, Math.max(0, ink + folds * (lum(photo, i) - mean))) * 255;
    // Rounded alike in both (a Buffer truncates, a canvas's array rounds).
    photo[i] = Math.round(photo[i] + a * (tone - photo[i]));
    photo[i + 1] = Math.round(photo[i + 1] + a * (tone - photo[i + 1]));
    photo[i + 2] = Math.round(photo[i + 2] + a * (tone - photo[i + 2]));
  }
}
