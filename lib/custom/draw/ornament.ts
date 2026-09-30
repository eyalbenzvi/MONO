/**
 * Turned and struck ornament: the guilloche rosette (bands of fine,
 * phase-shifted waves, as a rose engine cuts them) and the n-fold star
 * rosette (star polygons nested ring inside ring). The catalogue draws the
 * counts from a seeded generator; a template passes its own.
 */
import { INK, f1 } from "../kit";
import { polyline, type Point } from "./paths";

export interface Guilloche {
  /** Waves around the circle in the innermost band (each band out has one more multiple). */
  lobes: number;
  /** Phase-shifted copies of each band's wave: their crossings make the moiré. */
  strands: number;
  /** Each band's wave height as a fraction of the band's width, innermost first (one entry per band). */
  amps: number[];
  cx?: number;
  cy?: number;
  /** The radius the first band starts at, and the width all the bands share. */
  inner?: number;
  span?: number;
}

/** A guilloche rosette as one hairline path. */
export function guilloche(o: Guilloche): string {
  const { lobes, strands, amps } = o;
  const cx = o.cx ?? 150, cy = o.cy ?? 185, inner = o.inner ?? 30, span = o.span ?? 84;
  const bands = amps.length;
  let d = "";
  for (let b = 0; b < bands; b++) {
    const R = inner + (b + 0.5) * (span / bands);
    const amp = (span / bands) * amps[b];
    const lobeK = lobes * (b + 1);
    for (let s = 0; s < strands; s++) {
      const ph = (s / strands) * ((Math.PI * 2) / lobeK);
      const pts: Point[] = [];
      const steps = Math.max(240, lobeK * 10);
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const r = R + amp * Math.sin(lobeK * t + ph * lobeK);
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      d += polyline(pts) + "Z";
    }
  }
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".55"/>`;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export interface Rosette {
  /** The fold: points on each star. */
  n: number;
  /** One entry per ring, outermost first: whether an interlace circle is drawn inside it. */
  circles: boolean[];
  cx?: number;
  cy?: number;
  /** The outer ring's radius, and how far in the rings reach. */
  r?: number;
  depth?: number;
}

/** A star rosette: {n/k} star polygons, ring inside ring, each ring turned half a point from the last, a dot at the centre. */
export function rosette(o: Rosette): string {
  const { n, circles } = o;
  const cx = o.cx ?? 150, cy = o.cy ?? 185, R0 = o.r ?? 118, depth = o.depth ?? 100;
  const rings = circles.length;
  let body = "";
  for (let r = 0; r < rings; r++) {
    const R = R0 - r * (depth / rings);
    const step = Math.max(2, Math.floor((n - 1) / 2) - (r % 2));
    // {n/step} as a compound: gcd(n, step) separate stars.
    const g = gcd(n, step);
    let d = "";
    for (let c = 0; c < g; c++) {
      const pts: Point[] = [];
      for (let i = 0; i <= n / g; i++) {
        const a = ((c + i * step) / n) * Math.PI * 2 + (r % 2 ? Math.PI / n : 0) - Math.PI / 2;
        pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
      }
      d += polyline(pts) + "Z";
    }
    body += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f1(1.4 - r * 0.15)}" stroke-linejoin="round"/>`;
    if (circles[r]) body += `<circle cx="${cx}" cy="${cy}" r="${f1(R * 0.62)}" fill="none" stroke="${INK}" stroke-width=".6"/>`;
  }
  return body + `<circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>`;
}

/** A point on a rounded rectangle's centre line at arc length s, and its outward normal. */
function roundRectAt(x0: number, y0: number, x1: number, y1: number, r: number, s: number): [number, number, number, number] {
  const w = x1 - x0 - 2 * r, h = y1 - y0 - 2 * r, q = (Math.PI / 2) * r;
  const segs: ((t: number) => [number, number, number, number])[] = [
    (t) => [x0 + r + t, y0, 0, -1],
    (t) => { const a = -Math.PI / 2 + t / r; return [x1 - r + r * Math.cos(a), y0 + r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; },
    (t) => [x1, y0 + r + t, 1, 0],
    (t) => { const a = t / r; return [x1 - r + r * Math.cos(a), y1 - r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; },
    (t) => [x1 - r - t, y1, 0, 1],
    (t) => { const a = Math.PI / 2 + t / r; return [x0 + r + r * Math.cos(a), y1 - r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; },
    (t) => [x0, y1 - r - t, -1, 0],
    (t) => { const a = Math.PI + t / r; return [x0 + r + r * Math.cos(a), y0 + r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; },
  ];
  const lens = [w, q, h, q, w, q, h, q];
  for (let i = 0; i < 8; i++) {
    if (s <= lens[i] || i === 7) return segs[i](Math.min(s, lens[i]));
    s -= lens[i];
  }
  return segs[0](0);
}

/**
 * A guilloche border: phase-shifted waves run round a rounded rectangle (the
 * band's centre line), as a banknote's or a certificate's frame is cut, a
 * whole number of waves round so the ends meet. One hairline path.
 */
export function guillocheFrame(o: { x0: number; y0: number; x1: number; y1: number; r: number; band: number; wave: number; strands: number; width?: number }): string {
  const { x0, y0, x1, y1, r, band, strands } = o;
  const per = 2 * (x1 - x0 - 2 * r) + 2 * (y1 - y0 - 2 * r) + 2 * Math.PI * r;
  const waves = Math.max(8, Math.round(per / o.wave));
  const steps = waves * 12;
  let d = "";
  for (let k = 0; k < strands; k++) {
    const ph = (k / strands) * Math.PI * 2;
    const pts: Point[] = [];
    for (let i = 0; i < steps; i++) {
      const s = (i / steps) * per;
      const [x, y, nx, ny] = roundRectAt(x0, y0, x1, y1, r, s);
      const off = (band / 2) * Math.sin((s / per) * waves * Math.PI * 2 + ph);
      pts.push([x + nx * off, y + ny * off]);
    }
    d += polyline(pts) + "Z";
  }
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${o.width ?? 0.5}"/>`;
}
