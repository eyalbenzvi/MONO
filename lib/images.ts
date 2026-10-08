/**
 * The pictures the site shows are made at build time (scripts/images/bake.ts)
 * from the prints and the model photos: each design on its model photo, the
 * flat print, and a close-up of the print for zooming — one plain image per
 * design, colour and size, with the ink, the tee colour and the fabric
 * already in it. The browser picks the size (srcset); nothing is blended,
 * inverted or resized on the page.
 */
import { assetUrl } from "@/lib/catalog";
import { MODEL_ASPECT, modelFor, type ModelPhoto } from "@/lib/models";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

type Print = Pick<ShirtProduct, "n" | "backPrintUrl" | "pic">;

/** Widths of the design on its model photo (a grid card at 1× up to a Discover card at 3×). */
export const MOCKUP_WIDTHS = [360, 720, 1080] as const;
/** Widths of a raster print shown flat (a drawn print stays vector). */
export const PRINT_WIDTHS = [480, 1500] as const;
/** The close-up: the print's area of the photo, enough for a 3× zoom on a phone's Discover card. */
export const DETAIL_WIDTH = 900;

const key = (s: Print, color: BaseColor) => `${s.n}-${color}`;
export const isVector = (s: Print) => s.backPrintUrl.endsWith(".svg");

/** Paths under public/ (the baker writes them; the page asks for them). */
export const mockupPath = (s: Print, color: BaseColor, w: number) => `/img/m/${key(s, color)}-${w}.webp`;
export const printPath = (s: Print, color: BaseColor, w?: number) => (isVector(s) ? `/img/p/${key(s, color)}.svg` : `/img/p/${key(s, color)}-${w}.webp`);
export const detailPath = (s: Print, color: BaseColor) => `/img/d/${key(s, color)}.webp`;

/**
 * A picture's address on the page: the file, plus the print's version. A re-made print keeps its file names, and a
 * device keeps the pictures it has (public/sw.js, a day); the version makes them new addresses, so nobody sees the
 * old picture on the tee while the close-up shows the new one.
 */
export const pictureUrl = (s: Print, file: string) => `${assetUrl(file)}${s.pic ? `?v=${s.pic}` : ""}`;

const set = (s: Print, widths: readonly number[], url: (w: number) => string) => widths.map((w) => `${pictureUrl(s, url(w))} ${w}w`).join(", ");

export function mockupImage(s: Print, color: BaseColor) {
  return { src: pictureUrl(s, mockupPath(s, color, MOCKUP_WIDTHS[1])), srcSet: set(s, MOCKUP_WIDTHS, (w) => mockupPath(s, color, w)) };
}

export function printImage(s: Print, color: BaseColor) {
  if (isVector(s)) return { src: pictureUrl(s, printPath(s, color)), srcSet: undefined };
  return { src: pictureUrl(s, printPath(s, color, PRINT_WIDTHS[PRINT_WIDTHS.length - 1])), srcSet: set(s, PRINT_WIDTHS, (w) => printPath(s, color, w)) };
}

/** Where the close-up sits on the mockup (fractions: left, top, width, height) — the model photo's print box. */
export function detailBox(s: Pick<ShirtProduct, "n">, color: BaseColor): ModelPhoto["box"] | null {
  return modelFor(s, color)?.box ?? null;
}

export { MODEL_ASPECT };

/** How wide pictures are shown, for the browser's choice of file (one CSS length each). */
export const SIZES = {
  /** A Discover card. */
  card: "min(94vw, 460px)",
  /** A shop grid card (two columns on a phone, up to six on a desk). */
  grid: "min(46vw, 280px)",
  /** Small pictures: the card's back, Saved, the bag, strips. */
  thumb: "96px",
  /** The product page's picture. */
  product: "min(92vw, 600px)",
  /** Full-screen zoom. */
  zoom: "min(100vw, 640px)",
} as const;
