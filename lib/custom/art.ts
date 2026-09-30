/**
 * The Make prints' artwork (data/art: Your Dinosaur's plates, Your
 * Landmarks' drawings): public-domain pictures traced at build time to
 * one-ink outlines (scripts/sources/makeArt.ts), drawn here as a single
 * even-odd path fitted into a box, with every point placed by arithmetic
 * (no transform, no image).
 */
import { INK, f1 } from "./kit";

/**
 * A traced picture: its box in whole pixels, its rings (x, y, x, y, …; a
 * hole is a ring inside a ring) and, for a photograph, its screen's dots
 * (x, y, r in tenths of a pixel, …).
 */
export interface ArtFile {
  w: number;
  h: number;
  rings: number[][];
  dots?: number[];
}

/** Where a picture lands when fitted into a box (centred, its proportions kept): the scale and its top-left corner. */
export function artFit(art: Pick<ArtFile, "w" | "h">, x: number, y: number, w: number, h: number, align: "middle" | "bottom" = "middle") {
  const k = Math.min(w / art.w, h / art.h);
  return { k, x: x + (w - art.w * k) / 2, y: align === "bottom" ? y + h - art.h * k : y + (h - art.h * k) / 2, w: art.w * k, h: art.h * k };
}

/** The picture as a path fitted into the box (x, y, w, h), filled with the ink. */
export function artSvg(art: ArtFile, x: number, y: number, w: number, h: number, align: "middle" | "bottom" = "middle"): string {
  const fit = artFit(art, x, y, w, h, align);
  let d = "";
  for (const r of art.rings) {
    d += "M";
    for (let i = 0; i < r.length; i += 2) d += `${i ? " " : ""}${f1(fit.x + r[i] * fit.k)} ${f1(fit.y + r[i + 1] * fit.k)}`;
    d += "Z";
  }
  // Dots as two half circles each (they never touch, so even-odd leaves them whole).
  const dots = art.dots ?? [];
  for (let i = 0; i < dots.length; i += 3) {
    const r = (dots[i + 2] / 10) * fit.k;
    const cx = fit.x + dots[i] * fit.k, cy = fit.y + dots[i + 1] * fit.k;
    d += `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
  }
  return `<path d="${d}" fill="${INK}" fill-rule="evenodd"/>`;
}

/** A picker's thumbnail of a picture ("landmarks/eiffel"), baked at build time (scripts/images/bakeMake.ts), under public/. */
export const artThumbPath = (key: string) => `/img/make/art-${key.replace("/", "-")}.webp`;
/** The thumbnails' size, px (square). */
export const ART_THUMB = 160;
