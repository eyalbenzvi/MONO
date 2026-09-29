/**
 * The whole print from a computed body: the 300 × 400 canvas, its ground,
 * and the inks for the tee (white ink on black; on a white tee the inks swap),
 * minified. The seventh set's wrapper in scripts/generateCatalog.ts, shared
 * so a personalised print is byte for byte what the catalogue would write.
 */
import { minifySvg } from "./minify";

export const W = 300;
export const H = 400;
/**
 * The ground colour inside a body (a fill that hides what's behind it: a
 * ridge in front of the next, a gap cut where one stroke passes under
 * another): the tee's colour on either tee, as the ink is always the ink.
 * No catalogue print writes it, so theirs stay byte for byte as they were.
 */
export const GROUND = "#010101";

let minifying = true;
/**
 * On a page a print is only drawn, never written as a file: minifying it
 * there costs a fifth of the work and changes nothing on screen (the
 * minifier is visually lossless). The page's drawing code calls this; the
 * generator, the tests and the build keep the byte-for-byte file.
 */
export function drawOnly() {
  minifying = false;
}

export function wrap(body: string, baseColor: "black" | "white"): string {
  const [ink, ground] = baseColor === "black" ? ["#FFFFFF", "#000000"] : ["#000000", "#FFFFFF"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${ground}"/>${body.replace(/#FFFFFF/g, ink).replace(/#010101/g, ground)}</svg>`;
  return minifying ? minifySvg(svg) : svg;
}
