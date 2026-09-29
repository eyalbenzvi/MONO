import sharp from "sharp";
import type { Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_PIXELS, imageSize, tooManyPixels } from "@/lib/upload/header";

const img = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#808080" } });

describe("uploads: a picture's size from its header, before it's decoded", () => {
  it("reads PNG, JPEG, lossy and lossless WebP", async () => {
    const buf = async (s: Sharp) => new Uint8Array(await s.toBuffer());
    expect(imageSize(await buf(img(1234, 567).png()))).toEqual({ w: 1234, h: 567 });
    expect(imageSize(await buf(img(1234, 567).jpeg()))).toEqual({ w: 1234, h: 567 });
    expect(imageSize(await buf(img(1234, 567).webp()))).toEqual({ w: 1234, h: 567 });
    expect(imageSize(await buf(img(1234, 567).webp({ lossless: true })))).toEqual({ w: 1234, h: 567 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("a small file that would decode past 100 MP is refused; an ordinary photo isn't", async () => {
    // A PNG header claiming 20000 × 20000 (the header is all that's read).
    const bomb = new Uint8Array(await img(8, 8).png().toBuffer());
    new DataView(bomb.buffer).setUint32(16, 20000);
    new DataView(bomb.buffer).setUint32(20, 20000);
    expect(20000 * 20000).toBeGreaterThan(MAX_PIXELS);
    expect(tooManyPixels(bomb)).toBe(true);
    expect(tooManyPixels(new Uint8Array(await img(4000, 3000).jpeg().toBuffer()))).toBe(false);
  });
});
