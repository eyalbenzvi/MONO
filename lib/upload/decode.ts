/**
 * From what the page hands over (a file, or pixels already drawn) to
 * convert's pixels, with the browser's own decoders: createImageBitmap
 * (EXIF orientation applied, so a phone photo is the right way up and its
 * metadata never reaches the pixels) and an OffscreenCanvas. Runs in the
 * upload worker (lib/upload/worker.ts), or on the main thread where there
 * is no worker (lib/upload/run.ts). The conversion itself is convert.ts.
 */
import { MAX_LONG, convert, sanitiseSvg, tooSmall, type Ask, type Converted, type Pixels, type PrintSize } from "./convert";
import { MAX_BYTES, REASONS } from "./reasons";
import { analyse, type Analysis } from "./analyse";

/** `analyse`: also judge the print here (lib/upload/analyse), so the page's main thread doesn't. */
type Analyse = { analyse?: { bolder: boolean } };
export type UploadRequest = (
  | { file: Blob; type: string; mode?: Ask; size: PrintSize }
  | { svgRaster: Pixels; size: PrintSize }
  | { pixels: Pixels; mode?: Ask; size: PrintSize; checked?: boolean }
) &
  Analyse;

export type UploadResult = { ok: true; converted: Converted; source: { w: number; h: number }; analysis?: Analysis } | { ok: false; reason: string };

/** The formats the page takes. */
export const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
/** An SVG is rasterised this big on its long side (brief 6.2). */
export const SVG_LONG = 1500;
/**
 * The reason a worker gives when it can't decode an SVG itself (most
 * browsers only decode SVG where there's a document): run.ts then draws it
 * on the main thread and sends the pixels back. Never shown.
 */
export const SVG_ON_MAIN = "svg-needs-document";

type Canvas = OffscreenCanvas;

function canvas(w: number, h: number): Canvas {
  return new OffscreenCanvas(w, h);
}

/** A bitmap drawn at most maxLong on its long side (scaled while drawing, so a 50 MP photo never becomes 50 MP of pixels). */
function draw(bmp: ImageBitmap, maxLong: number, ground?: string): Pixels {
  const k = Math.min(1, maxLong / Math.max(bmp.width, bmp.height));
  const [w, h] = [Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k))];
  const c = canvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  if (ground) (ctx.fillStyle = ground), ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

/**
 * The SVG with a width and height set on its root, the long side long px,
 * from its viewBox (or its own width and height), so a decoder draws it at
 * that size rather than 300 × 150.
 */
export function sizedSvg(svg: string, long = SVG_LONG): string {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const num = (name: string) => Number(new RegExp(`\\s${name}\\s*=\\s*["']?\\s*([\\d.]+)`, "i").exec(root)?.[1]);
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(root);
  let [w, h] = vb ? [Number(vb[1]), Number(vb[2])] : [num("width"), num("height")];
  if (!(w > 0 && h > 0)) [w, h] = [1, 1];
  const k = long / Math.max(w, h);
  const bare = root.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return svg.replace(root, bare.replace(/<svg\b/i, `<svg width="${Math.round(w * k)}" height="${Math.round(h * k)}"`));
}

/** A sanitised SVG decoded and drawn here (a worker usually can't; the caller then draws it where there's a document). */
async function svgPixels(text: string): Promise<Pixels> {
  const bmp = await createImageBitmap(new Blob([sizedSvg(text)], { type: "image/svg+xml" }));
  try {
    return draw(bmp, SVG_LONG, "#fff");
  } finally {
    bmp.close();
  }
}

/** One request, start to finish. Refusals come back as reasons, never as thrown errors. */
export async function handle(req: UploadRequest): Promise<UploadResult> {
  const ok = (converted: Converted, w: number, h: number): UploadResult => ({ ok: true, converted, source: { w, h }, ...(req.analyse ? { analysis: analyse(converted, req.analyse) } : {}) });
  try {
    if ("svgRaster" in req) return ok(convert({ svgRaster: req.svgRaster }, { size: req.size }), req.svgRaster.w, req.svgRaster.h);
    if ("pixels" in req) {
      // `checked`: the page measured the source before scaling it down (lib/upload/client), so the pixels' own size says nothing.
      if (!req.checked && tooSmall(req.pixels.w, req.pixels.h, req.size)) return { ok: false, reason: req.size === "full" ? REASONS.smallForFull : REASONS.smallForSmall };
      return ok(convert({ pixels: req.pixels }, { mode: req.mode, size: req.size }), req.pixels.w, req.pixels.h);
    }
    const { file, type, mode, size } = req;
    if (!(TYPES as readonly string[]).includes(type)) return { ok: false, reason: REASONS.format };
    if (file.size > MAX_BYTES) return { ok: false, reason: REASONS.heavy };
    if (type === "image/svg+xml") {
      const s = sanitiseSvg(await file.text());
      if (!s.ok) return { ok: false, reason: s.reason };
      let p: Pixels;
      try {
        p = await svgPixels(s.svg);
      } catch {
        return { ok: false, reason: SVG_ON_MAIN };
      }
      return ok(convert({ svgRaster: p }, { size }), p.w, p.h);
    }
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return { ok: false, reason: REASONS.unreadable };
    }
    const [w, h] = [bmp.width, bmp.height];
    if (tooSmall(w, h, size)) return bmp.close(), { ok: false, reason: size === "full" ? REASONS.smallForFull : REASONS.smallForSmall };
    const p = draw(bmp, MAX_LONG);
    bmp.close();
    return ok(convert({ pixels: p }, { mode, size }), w, h);
  } catch {
    return { ok: false, reason: REASONS.unreadable };
  }
}

/** The buffers a result can hand over without copying. */
export function transferables(r: UploadResult): ArrayBuffer[] {
  if (!r.ok) return [];
  const c = r.converted;
  const a = r.analysis;
  // Each buffer once (a tee's ink can be the converted ink itself).
  return [...new Set([c.ink.buffer, ...(c.tone ? [c.tone.lum.buffer, c.tone.alpha.buffer] : []), ...(a ? [a.inks.black.buffer, a.inks.white.buffer] : [])])] as ArrayBuffer[];
}
