/**
 * Print quality and real size, measured by rendering each print small with
 * resvg (deterministic: fixed font files, fixed size).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { BaseColor } from "../../types/shirt";

/** Below this quality score (0–100) a print is weak: never in the taste test, link-preview picks or the top of the shop. */
export const WEAK_QUALITY = 35;
/** The printed area on the tee, cm (the 300×400 print; matches PRINT_SIZE_CM). */
const PRINT_CM = { width: 28, height: 37 };

// Fixed font files (the same on every run and on the CI runner's Ubuntu).
const FONT_FILES = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"]
  .flatMap((d) =>
    ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSansMono.ttf", "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSerif-Regular.ttf", "LiberationSerif-Italic.ttf", "LiberationSerif-Bold.ttf", "LiberationMono-Regular.ttf", "LiberationMono-Bold.ttf"].map((f) =>
      path.join(d, f),
    ),
  )
  .filter((f) => existsSync(f));

/**
 * Quality 0–100 from the print itself, rendered at 150 px wide: how much
 * ink it carries (coverage, 40%), how much of the print it spans (ink
 * bounding box, 30%) and how much is going on (edge transitions, 30%). A
 * lone small shape scores low. The bounding box also gives the print's real
 * size on the tee.
 */
export function measurePrint(svg: string, baseColor: BaseColor): { quality: number; printCm: { width: number; height: number }; ink: number } {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: 150 }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" } }).render();
  const px = img.pixels;
  const { width: w, height: h } = img;
  // Ink amount per pixel (the ground is black on black tees, white on white).
  const ink = (i: number) => (baseColor === "black" ? px[i * 4] / 255 : 1 - px[i * 4] / 255);
  let sum = 0;
  let edges = 0;
  let [minX, minY, maxX, maxY] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = ink(y * w + x);
      sum += a;
      const on = a > 0.2;
      if (on) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
      if (x > 0 && ink(y * w + x - 1) > 0.2 !== on) edges++;
      if (y > 0 && ink((y - 1) * w + x) > 0.2 !== on) edges++;
    }
  const bw = maxX < 0 ? 0 : (maxX - minX + 1) / w;
  const bh = maxY < 0 ? 0 : (maxY - minY + 1) / h;
  const cover = Math.min(1, sum / (w * h) / 0.2);
  const quality = Math.round(100 * (0.4 * cover + 0.3 * Math.sqrt(bw * bh) + 0.3 * Math.min(1, edges / 2500)));
  return { quality, printCm: { width: Math.max(1, Math.round(bw * PRINT_CM.width)), height: Math.max(1, Math.round(bh * PRINT_CM.height)) }, ink: sum / (w * h) };
}

