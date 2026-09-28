/**
 * An upload's ink raster (1 = ink, 1500 × 2000) on and off the page (DOM):
 * as a canvas in the tee colour's inks (white ink on black, black on white,
 * for CustomMockup), as the stored PNG (1-bit alpha, nothing else in it),
 * and back.
 */
export const W = 1500;
export const H = 2000;

/** The print in the tee's inks: the tee's colour as ground, the other as ink (screen / multiply lays it on the photo). */
export function inkCanvas(ink: Uint8Array, tee: "black" | "white", w = W, h = H): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const [g, k] = tee === "black" ? [0, 255] : [255, 0];
  for (let i = 0; i < w * h; i++) {
    const v = ink[i] ? k : g;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** The stored form: a PNG whose alpha is the ink (0 or 255) and whose colour is plain black. No metadata. */
export function inkPng(ink: Uint8Array, w = W, h = H): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = ink[i] ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}

/** Back from the stored PNG to the ink mask. */
export async function pngInk(blob: Blob): Promise<Uint8Array> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const ink = new Uint8Array(c.width * c.height);
  for (let i = 0; i < ink.length; i++) ink[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return ink;
}

/** A short content hash of a mask (FNV-1a over its packed bits), hex: names the print in the bag. */
export function inkHash(ink: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ink.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (ink[i + b] ? 1 : 0);
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
