/**
 * A personalised print as a picture, in the browser. On the photo it is drawn
 * straight onto the canvas (canvasSvg) and laid the way bake.ts lays the
 * catalogue's: screen on a black tee, multiply on a white one. "Show the print
 * only" shows the SVG itself through an <img> (a blob: URL, which the CSP
 * allows); an image can't load a web font, so the print font (DejaVu Sans
 * Mono, cut to the captions' characters: scripts/tools/buildFonts.py) is
 * embedded in it first.
 */
import { assetUrl } from "@/lib/catalog";
import type { BaseColor } from "@/types/shirt";
import { drawSvg, printCanvas } from "./canvasSvg";
import { CHECK_H, CHECK_W, type InkRaster } from "./quality";

const FONTS = [
  ["/fonts/dejavu-sans-mono.woff2", "normal"],
  ["/fonts/dejavu-sans-mono-bold.woff2", "bold"],
] as const;

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

let fontCss: Promise<string> | null = null;
/** The @font-face rules with the font files inline (fetched once). A missing file leaves the fallback face. */
export function loadFontCss(): Promise<string> {
  fontCss ??= Promise.all(
    FONTS.map(([file, weight]) =>
      fetch(assetUrl(file))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))))
        .then((b) => `@font-face{font-family:"DejaVu Sans Mono";font-weight:${weight};src:url(data:font/woff2;base64,${toBase64(b)}) format("woff2")}`)
        .catch(() => ""),
    ),
  ).then((rules) => rules.join(""));
  return fontCss;
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
 * onto white.
 */
export function drawMockup(ctx: CanvasRenderingContext2D, w: number, h: number, photo: CanvasImageSource, svg: string, box: readonly number[], color: BaseColor) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(photo, 0, 0, w, h);
  const [bx, by, bw, bh] = [Math.round(box[0] * w), Math.round(box[1] * h), Math.round(box[2] * w), Math.round(box[3] * h)];
  ctx.globalCompositeOperation = color === "black" ? "screen" : "multiply";
  ctx.drawImage(printCanvas(svg, bw, bh), bx, by, bw, bh);
  ctx.restore();
}

/**
 * The close-up: the photo's print area enlarged to w × h, the print over all
 * of it (bake.ts detail()).
 */
export function drawDetail(ctx: CanvasRenderingContext2D, w: number, h: number, photo: HTMLImageElement, svg: string, box: readonly number[], color: BaseColor) {
  const [W, H] = [photo.naturalWidth, photo.naturalHeight];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, Math.round(box[0] * W), Math.round(box[1] * H), Math.round(box[2] * W), Math.round(box[3] * H), 0, 0, w, h);
  ctx.globalCompositeOperation = color === "black" ? "screen" : "multiply";
  ctx.drawImage(printCanvas(svg, w, h), 0, 0, w, h);
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
  return { w: CHECK_W, h: CHECK_H, ink };
}
