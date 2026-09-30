/**
 * Synthetic uploads for the conversion tests, made in code (no image files):
 * a scan, a logo, a photograph, and strokes of a known width on the grid.
 */
import { mulberry32 } from "@/lib/custom/rng";
import type { Pixels } from "@/lib/upload/convert";

/** A grey picture (0–1 per pixel) as opaque RGBA. */
export function fromGrey(g: ArrayLike<number>, w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, Math.max(0, g[i])) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  return { w, h, data };
}

/** Coverage of a pixel by a shape from its signed distance (negative inside): a one-pixel antialiased edge. */
const cover = (sd: number) => Math.min(1, Math.max(0, 0.5 - sd));

/** Distance from (x, y) to the segment a–b. */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const [dx, dy] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** A pencil-and-ink scan: dark strokes on tinted paper with a shadow across it and grain. */
export function scan(w = 1600, h = 1200, seed = 1): Pixels {
  const rnd = mulberry32(seed);
  const segs: number[][] = [];
  for (let i = 0; i < 40; i++) {
    const [x, y] = [w * (0.15 + 0.7 * rnd()), h * (0.15 + 0.7 * rnd())];
    const [a, l] = [rnd() * Math.PI * 2, 60 + rnd() * 200];
    segs.push([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 3 + rnd() * 5]);
  }
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const paper = 0.8 + 0.14 * (x / w) + 0.03 * (y / h) + (rnd() - 0.5) * 0.06;
      let ink = 0;
      for (const [ax, ay, bx, by, r] of segs) {
        if (x < Math.min(ax, bx) - r - 1 || x > Math.max(ax, bx) + r + 1 || y < Math.min(ay, by) - r - 1 || y > Math.max(ay, by) + r + 1) continue;
        ink = Math.max(ink, cover(segDist(x + 0.5, y + 0.5, ax, ay, bx, by) - r / 2));
      }
      g[y * w + x] = paper * (1 - ink) + 0.12 * ink;
    }
  return fromGrey(g, w, h);
}

/** A flat logo: a ring, a bar and a triangle, black on white. */
export function logo(w = 1200, h = 1200, light = false): Pixels {
  const g = new Float32Array(w * h);
  const [cx, cy] = [w * 0.5, h * 0.4];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [px, py] = [x + 0.5, y + 0.5];
      const ring = Math.abs(Math.hypot(px - cx, py - cy) - w * 0.25) - w * 0.04;
      const bar = Math.max(Math.abs(px - cx) - w * 0.3, Math.abs(py - h * 0.82) - h * 0.03);
      // Triangle: inside when below both slopes and above the base.
      const tri = Math.max(py - h * 0.55, -(py - h * 0.25) - Math.abs(px - cx) * 0.3 + h * 0.05, Math.abs(px - cx) - (py - h * 0.25) * 0.6);
      const ink = cover(Math.min(ring, bar, tri));
      g[y * w + x] = light ? 0.05 + 0.9 * ink : 1 - 0.95 * ink;
    }
  return fromGrey(g, w, h);
}

/** A photograph: a lit, shaded ball on a graded backdrop, with fine texture. */
export function photo(w = 1600, h = 1200, seed = 2, flat = false): Pixels {
  const rnd = mulberry32(seed);
  const g = new Float32Array(w * h);
  const [cx, cy, R] = [w * 0.5, h * 0.52, h * 0.34];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const back = flat ? 0.93 : 0.35 + 0.4 * (y / h) + 0.1 * Math.sin(x / 90);
      const d = Math.hypot(x - cx, y - cy) / R;
      const lit = 0.15 + 0.7 * Math.max(0, 1 - Math.hypot(x - cx + R * 0.4, y - cy + R * 0.4) / (R * 1.6));
      const tex = 0.06 * Math.sin(x / 7) * Math.sin(y / 9) + (rnd() - 0.5) * 0.03;
      const a = cover((d - 1) * R);
      g[y * w + x] = back * (1 - a) + (lit + tex) * a;
    }
  return fromGrey(g, w, h);
}

/** Circle outlines of a given stroke width (px) on the print grid, as a 1 = ink mask. */
export function rings(widthPx: number, w = 1500, h = 2000): Uint8Array {
  const m = new Uint8Array(w * h);
  const circles = [
    [750, 700, 420],
    [750, 700, 300],
    [750, 1500, 250],
    [400, 1500, 90],
    [1100, 1500, 90],
  ];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (const [cx, cy, r] of circles) if (Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r) <= widthPx / 2) m[y * w + x] = 1;
  return m;
}
