/**
 * An image's size read from its first bytes (PNG IHDR, JPEG SOF, WebP
 * VP8/VP8L/VP8X), before anything is decoded: a small file can decode to
 * gigabytes (a "decompression bomb"), so the page refuses one past
 * MAX_PIXELS before the browser is asked to open it. Null when the header
 * can't be read (the decoder then decides, as before).
 */

/** The most pixels a picture may have (a 100 MP photo is past any phone's camera). */
export const MAX_PIXELS = 100_000_000;

export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u32be = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  // PNG: the signature, then IHDR's width and height.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { w: u32be(16), h: u32be(20) };
  // JPEG: walk the markers to the first start-of-frame.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: u16be(i + 5), w: u16be(i + 7) };
      i += 2 + u16be(i + 2);
    }
    return null;
  }
  // WebP: RIFF….WEBP, then its first chunk.
  if (b.length >= 30 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...b.subarray(12, 16));
    if (chunk === "VP8X") return { w: u24le(24) + 1, h: u24le(27) + 1 };
    // Lossy: after the frame tag and start code, 14-bit width and height, little-endian.
    if (chunk === "VP8 ") return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/** Whether a picture's header says it's too big to open (unreadable headers pass: the decoder decides). */
export const tooManyPixels = (b: Uint8Array) => {
  const s = imageSize(b);
  return !!s && s.w * s.h > MAX_PIXELS;
};
