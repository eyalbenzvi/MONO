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
