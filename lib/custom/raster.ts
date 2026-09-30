/**
 * A personalised print as a picture, in the browser. On the photo it is drawn
 * straight onto the canvas (canvasSvg) and laid the way bake.ts lays the
 * catalogue's: screen on a black tee, multiply on a white one. "Show the print
 * only" shows the SVG itself through an <img> (a blob: URL, which the CSP
 * allows); an image can't load a web font, so the print's fonts (DejaVu Sans
 * Mono, and the Make faces it names: scripts/tools/buildFonts.py,
 * buildPrintFonts.py) are embedded in it first.
 */
import { assetUrl } from "@/lib/catalog";
import type { BaseColor } from "@/types/shirt";
import { drawSvg, printCanvas } from "./canvasSvg";
import { BLEND_ALPHA, inkOnCloth } from "./inkOnCloth";
import { CHECK_H, CHECK_W, type InkRaster } from "./quality";

/** Each print face: its file, the family the SVG names (lib/custom/kit FONT_FAMILY) and its weight. */
const FONTS = [
  ["/fonts/dejavu-sans-mono.woff2", "DejaVu Sans Mono", "normal"],
  ["/fonts/dejavu-sans-mono-bold.woff2", "DejaVu Sans Mono", "bold"],
  ["/fonts/libre-caslon-text.woff2", "Libre Caslon Text", "normal"],
  ["/fonts/libre-caslon-text-bold.woff2", "Libre Caslon Text", "bold"],
  ["/fonts/oswald.woff2", "Oswald", "normal"],
  ["/fonts/oswald-bold.woff2", "Oswald", "bold"],
  ["/fonts/unifraktur-maguntia.woff2", "UnifrakturMaguntia", "normal"],
  ["/fonts/ibm-plex-mono.woff2", "IBM Plex Mono", "normal"],
  ["/fonts/ibm-plex-mono-bold.woff2", "IBM Plex Mono", "bold"],
  ["/fonts/space-grotesk.woff2", "Space Grotesk", "normal"],
  ["/fonts/space-grotesk-bold.woff2", "Space Grotesk", "bold"],
  ["/fonts/cinzel.woff2", "Cinzel", "normal"],
  ["/fonts/cinzel-bold.woff2", "Cinzel", "bold"],
  ["/fonts/playfair-display.woff2", "Playfair Display", "normal"],
  ["/fonts/playfair-display-bold.woff2", "Playfair Display", "bold"],
] as const;

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const rules = new Map<string, Promise<string>>();
/** One face's @font-face rule with its file inline (fetched once). A missing file leaves the fallback face. */
const faceRule = ([file, family, weight]: (typeof FONTS)[number]) => {
  let r = rules.get(file);
  if (!r) {
    r = fetch(assetUrl(file))
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(file))))
      .then((b) => `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${toBase64(b)}) format("woff2")}`)
      .catch(() => "");
    rules.set(file, r);
  }
  return r;
};
/** The @font-face rules a print needs: the faces of the families it names (every face when no print is given). */
export function loadFontCss(svg?: string): Promise<string> {
  return Promise.all(FONTS.filter(([, family]) => !svg || svg.includes(family)).map(faceRule)).then((r) => r.join(""));
}

/** The SVG with the font rules in it. */
export const withFonts = (svg: string, css: string) => (css ? svg.replace(/^(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`) : svg);

/** An image of an SVG string, decoded. */
export function svgImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(() => img)
    .finally(() => URL.revokeObjectURL(url));
}

const images = new Map<string, Promise<HTMLImageElement>>();
/** An image file, decoded once. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    const img = new Image();
    img.src = src;
    p = img.decode().then(() => img);
    p.catch(() => images.delete(src));
    images.set(src, p);
  }
  return p;
}

/**
 * The print on the photo, drawn into a canvas of w × h device pixels: the
 * photo scaled to fill it, then the print in the photo's print box (rounded
 * to whole pixels as bake.ts rounds it), screened onto black or multiplied
 * onto white at the ink's density (inkOnCloth BLEND_ALPHA).
 */
/** A print to lay on the tee: an SVG, or a picture already in the tee colour's inks (an upload's raster, lib/upload/bitmap). */
export type PrintSource = string | CanvasImageSource;
const printOf = (p: PrintSource, w: number, h: number, readable = false): CanvasImageSource => (typeof p === "string" ? printCanvas(p, w, h, readable) : p);
/**
 * Gives a canvas's pixels back at once (a zero-size canvas holds none): a
 * page drawing many prints (the Make index, a filter changing its groups)
 * otherwise waits on the garbage collector for each, and a phone's canvas
 * memory runs out first (Safari has a hard cap; a tab can crash).
 */
export const release = (c: CanvasImageSource | null | undefined) => {
  if (typeof HTMLCanvasElement !== "undefined" && c instanceof HTMLCanvasElement) (c.width = 0), (c.height = 0);
};

export function drawMockup(ctx: CanvasRenderingContext2D, w: number, h: number, photo: CanvasImageSource, svg: PrintSource, box: readonly number[], color: BaseColor) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(photo, 0, 0, w, h);
  const [bx, by, bw, bh] = [Math.round(box[0] * w), Math.round(box[1] * h), Math.round(box[2] * w), Math.round(box[3] * h)];
  // Redrawn at every keystroke and across a grid of cards: the plain blend, at the ink's density (inkOnCloth BLEND_ALPHA); the folds are the close-up's.
  ctx.globalCompositeOperation = color === "black" ? "screen" : "multiply";
  ctx.globalAlpha = BLEND_ALPHA[color];
  const print = printOf(svg, bw, bh);
  ctx.drawImage(print, bx, by, bw, bh);
  if (print !== svg) release(print);
  ctx.restore();
}

/** A canvas kept in memory (cheap to read back), of w × h. */
function readable(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  [c.width, c.height] = [w, h];
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  return [c, g];
}

/**
 * The print laid on the photo in the canvas's box `to` (x, y, w, h): ink on
 * cloth (lib/custom/inkOnCloth), as the baker lays it. The arithmetic reads
 * canvases kept in memory (the photo's part `from`, the print), never the
 * page's own canvas, so nothing waits on the graphics card; the result is
 * drawn back in one go. A source the page can't read (it never should be: every one
 * is the site's own) gets the plain screen or multiply blend.
 */
function layInk(ctx: CanvasRenderingContext2D, print: CanvasImageSource, to: readonly number[], photo: CanvasImageSource, from: readonly number[], color: BaseColor) {
  const [x, y, w, h] = to;
  if (w <= 0 || h <= 0) return;
  try {
    // A drawn print is already a readable canvas of the box's size on its ground (printCanvas): read as it is. Anything else is laid on the ground at that size first.
    let ink: Uint8ClampedArray;
    if (typeof HTMLCanvasElement !== "undefined" && print instanceof HTMLCanvasElement && print.width === w && print.height === h) ink = print.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
    else {
      const [flat, f] = readable(w, h);
      f.fillStyle = color === "black" ? "#000" : "#fff";
      f.fillRect(0, 0, w, h);
      f.drawImage(print, 0, 0, w, h);
      ink = f.getImageData(0, 0, w, h).data;
      release(flat);
    }
    const [area, g] = readable(w, h);
    g.drawImage(photo, from[0], from[1], from[2], from[3], 0, 0, w, h);
    const cloth = g.getImageData(0, 0, w, h);
    inkOnCloth(cloth.data, 4, ink, 4, color);
    g.putImageData(cloth, 0, 0);
    // Drawn, not put: the canvas's transform (a card's chest crop) applies.
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(area, x, y, w, h);
    release(area);
  } catch {
    ctx.globalCompositeOperation = color === "black" ? "screen" : "multiply";
    ctx.drawImage(print, x, y, w, h);
  }
}

/**
 * The close-up: the photo's print area enlarged to w × h, the print over all
 * of it (bake.ts detail()).
 */
export function drawDetail(ctx: CanvasRenderingContext2D, w: number, h: number, photo: HTMLImageElement, svg: PrintSource, box: readonly number[], color: BaseColor) {
  const [W, H] = [photo.naturalWidth, photo.naturalHeight];
  const from = [Math.round(box[0] * W), Math.round(box[1] * H), Math.round(box[2] * W), Math.round(box[3] * H)];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, from[0], from[1], from[2], from[3], 0, 0, w, h);
  const print = printOf(svg, w, h, true);
  layInk(ctx, print, [0, 0, w, h], photo, from, color);
  if (print !== svg) release(print);
  ctx.restore();
}

/**
 * The print's ink as the quality checks read it (scripts/gen/quality.ts
 * svgInk): drawn 300 × 400, white ink on black counts its lightness, black
 * ink on white its darkness. The same InkRaster solidBlock and assessPrint
 * judge the catalogue by.
 */
export function inkFromCanvas(svg: string, baseColor: BaseColor): InkRaster {
  const c = document.createElement("canvas");
  c.width = CHECK_W;
  c.height = CHECK_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = baseColor === "black" ? "#000" : "#fff";
  ctx.fillRect(0, 0, CHECK_W, CHECK_H);
  drawSvg(ctx, svg, CHECK_W, CHECK_H);
  const px = ctx.getImageData(0, 0, CHECK_W, CHECK_H).data;
  const ink = new Float32Array(CHECK_W * CHECK_H);
  for (let i = 0; i < ink.length; i++) ink[i] = baseColor === "black" ? px[i * 4] / 255 : 1 - px[i * 4] / 255;
  release(c);
  return { w: CHECK_W, h: CHECK_H, ink };
}
