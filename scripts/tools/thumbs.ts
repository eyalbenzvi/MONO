/**
 * Grid thumbnails of the raster prints: public/prints/t/print_N.webp, 240 ×
 * 320 (a grid card's print box is at most ~90 CSS px wide, so this is sharp
 * at 2–3× DPR) at about a tenth of the full print's bytes. The shop grid,
 * Saved and the bag use them, so switching categories shows whole tees at
 * once. SVG prints are small already and stay vector (their text must be
 * set by the browser's fonts). Only missing or stale thumbs are written.
 *   npm run thumbs
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { SHIRTS } from "../../lib/catalog";

export const THUMB_W = 240;
export const THUMB_H = 320;
const PUBLIC = path.resolve(__dirname, "..", "..", "public");
const OUT = path.join(PUBLIC, "prints", "t");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const rasters = [...new Set(SHIRTS.map((s) => s.backPrintUrl).filter((u) => u.endsWith(".webp")))];
  let written = 0;
  for (const url of rasters) {
    const src = path.join(PUBLIC, url);
    const dst = path.join(OUT, path.basename(url));
    if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue;
    await sharp(src).resize(THUMB_W, THUMB_H, { fit: "fill" }).webp({ quality: 70, alphaQuality: 70, effort: 6 }).toFile(dst);
    written++;
  }
  console.log(`thumbs: ${written} written, ${rasters.length} in all`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
