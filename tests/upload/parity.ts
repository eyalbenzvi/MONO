/**
 * The halftone parity fixtures: three tones (ink 0–1, stored as bytes) the
 * port in lib/upload/convert.ts and scripts/photos/halftone.py both screen
 * at 1500 × 2000. The reference coverage is committed in
 * fixtures/halftone-parity.json; to make it again (python3 with numpy,
 * Pillow and opencv-python-headless):
 *
 *   npx tsx tests/upload/parity.ts /tmp/parity && python3 tests/upload/fixtures/parity.py /tmp/parity
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { mulberry32 } from "@/lib/custom/rng";

export interface ParityTone {
  name: string;
  w: number;
  h: number;
  data: Uint8Array;
}

/** Coverage over 32 × 32 blocks (whole blocks only: 46 × 62). */
export const BLOCK = 32;

export function parityTones(): ParityTone[] {
  const make = (name: string, w: number, h: number, f: (x: number, y: number, r: () => number) => number): ParityTone => {
    const r = mulberry32(w * 7 + h);
    const data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = Math.round(Math.min(1, Math.max(0, f(x / w, y / h, r))) * 255);
    return { name, w, h, data };
  };
  return [
    // A small picture scaled up 4×: a smooth ramp, a lit ball and a dark mass (the cap).
    make("ramp", 375, 500, (x, y) => {
      const ball = Math.hypot(x - 0.5, y - 0.35) < 0.28 ? 0.9 - 0.8 * Math.max(0, 1 - Math.hypot(x - 0.4, y - 0.27) / 0.4) : -1;
      return ball >= 0 ? ball : y > 0.75 && y < 0.9 && x > 0.2 && x < 0.8 ? 1 : 0.1 + 0.6 * x;
    }),
    // About print size: texture and grain over a gradient.
    make("texture", 900, 1200, (x, y, r) => 0.5 + 0.35 * Math.sin(x * 40) * Math.sin(y * 31) * (1 - y) + 0.25 * (y - 0.5) + (r() - 0.5) * 0.1),
    // Larger than print (scaled down): line work, thin strokes that stay solid and a slab that's capped.
    make("strokes", 1800, 2400, (x, y) => {
      const line = Math.abs(((x * 17 + y * 3) % 1) - 0.5) < 0.03 || Math.abs(((y * 23) % 1) - 0.5) < 0.02;
      const slab = x > 0.55 && x < 0.9 && y > 0.1 && y < 0.3;
      return slab || line ? 0.97 : 0.03;
    }),
  ];
}

if (process.argv[1]?.endsWith("parity.ts")) {
  const dir = process.argv[2] ?? "/tmp/parity";
  mkdirSync(dir, { recursive: true });
  for (const t of parityTones()) writeFileSync(path.join(dir, `${t.name}.${t.w}x${t.h}.u8`), t.data);
  console.log(`wrote ${dir}`);
}
