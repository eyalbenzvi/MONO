import sharp from "sharp";

/** Deterministic pseudo-random numbers (mulberry32), so every fixture is the same file each run. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const png = (w: number, h: number, px: (x: number, y: number) => number) => {
  const buf = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf[y * w + x] = Math.max(0, Math.min(255, Math.round(px(x, y))));
  return sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
};

/** A "photograph": a dark subject (soft blobs and texture) on a flat light ground, 1600 × 1200. */
export function photo(): Promise<Buffer> {
  const r = rng(7);
  const blobs = Array.from({ length: 9 }, () => [400 + r() * 800, 300 + r() * 600, 80 + r() * 160, 40 + r() * 120]);
  return png(1600, 1200, (x, y) => {
    let v = 225;
    for (const [bx, by, br, dark] of blobs) v -= dark * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (2 * br * br));
    return v + 18 * Math.sin(x / 9) * Math.sin(y / 11);
  });
}

/** A "drawing": black strokes on white paper (rings and bars), 1400 × 1400. */
export function drawing(): Promise<Buffer> {
  return png(1400, 1400, (x, y) => {
    const d = Math.hypot(x - 700, y - 700);
    const ring = Math.abs((d % 120) - 60) < 9 && d < 560;
    const bar = Math.abs(((x + y) % 300) - 150) < 7 && d > 580 && d < 680;
    return ring || bar ? 12 : 246;
  });
}

/** A pencil sketch photographed: soft graphite strokes (rings, grey not black) and a smudge of shading on paper, 1400 × 1400. Its greys read as a photograph; Drawing takes it as the line work it is. */
export function pencilSketch(): Promise<Buffer> {
  const r = rng(11);
  return png(1400, 1400, (x, y) => {
    const d = Math.hypot(x - 700, y - 700);
    const off = Math.abs((d % 140) - 70);
    let v = 236 - 10 * (y / 1400) + 6 * (r() - 0.5);
    if (d < 560) v -= 120 * Math.exp(-(off * off) / 60);
    // Shading: a band of light graphite across the lower right.
    if (x + y > 1700 && x + y < 2100 && d < 600) v -= 55 + 12 * Math.sin(x / 3);
    return v;
  });
}

/** Too small for either size (short side under 600 px). */
export function tiny(): Promise<Buffer> {
  return png(600, 500, (x, y) => (Math.hypot(x - 300, y - 250) < 150 ? 20 : 240));
}

/** A contour map, busy enough for the catalogue tier and like no catalogue design: the contour lines of a few hills, 1500 × 1500. */
export function engraving(): Promise<Buffer> {
  const hills = [[420, 520, 260, 1], [1040, 430, 200, 0.8], [760, 1060, 330, 1.2], [1180, 1120, 150, 0.6]];
  return png(1500, 1500, (x, y) => {
    let z = 0;
    for (const [hx, hy, r, k] of hills) z += k * Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * r * r));
    return z > 0.08 && (z * 10) % 1 < 0.22 ? 10 : 245;
  });
}

/** A drawing in hairlines (2 px on 1400): too fine to print as it is, fine made bolder. */
export function hairlines(): Promise<Buffer> {
  return png(1400, 1400, (x, y) => {
    const d = Math.hypot(x - 700, y - 700);
    return d < 600 && Math.abs((d % 50) - 25) < 0.6 ? 15 : 245;
  });
}

/** A photograph big enough for Small but not Full (short side 900 px). */
export async function mediumPhoto(): Promise<Buffer> {
  return sharp(await photo()).resize(1000, 750).png().toBuffer();
}

/** Soft bands of mid-grey: prints in dots, but as lines its edges crowd (gaps too narrow). */
export function bands(): Promise<Buffer> {
  return png(1600, 1200, (x, y) => 128 + 70 * Math.sin(x / 40) * Math.sin(y / 55));
}
