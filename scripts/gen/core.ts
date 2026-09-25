/**
 * Shared primitives for the catalog generator: seeded randomness, geometry
 * helpers and the Design contract every generator returns.
 */
import { FEATURE_KEYS, type FeatureKey, type FeatureVector } from "../../types/shirt";

export const W = 300;
export const H = 400;
export const M = 24; // print margin

/* ------------------------------------------------------------------ */
/* Deterministic randomness + small helpers                            */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const int = (rng: Rng, min: number, max: number) => Math.floor(range(rng, min, max + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const n1 = (n: number) => Math.round(n * 10) / 10; // SVG coordinate precision
export const r2 = (n: number) => Math.round(n * 100) / 100;

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function vector(v: Partial<Record<FeatureKey, number>>): FeatureVector {
  const out = {} as FeatureVector;
  for (const k of FEATURE_KEYS) out[k] = r2(clamp01(v[k] ?? 0));
  return out;
}

export const pts = (points: [number, number][]) => points.map(([x, y]) => `${n1(x)},${n1(y)}`).join(" ");

export function polygon(cx: number, cy: number, r: number, sides: number, rot: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

/** Smooth path through points (quadratic curves via midpoints). */
export function smooth(points: [number, number][], closed = false): string {
  if (points.length < 3) return `M${pts(points).replace(/ /g, " L")}`;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const P = closed ? [...points, points[0], points[1]] : points;
  let d = closed ? `M${pts([mid(P[0], P[1])])}` : `M${pts([P[0]])}`;
  for (let i = 1; i < P.length - 1; i++) {
    const m = mid(P[i], P[i + 1]);
    d += ` Q${n1(P[i][0])},${n1(P[i][1])} ${n1(m[0])},${n1(m[1])}`;
  }
  if (!closed) d += ` L${pts([P[P.length - 1]])}`;
  return d + (closed ? "Z" : "");
}

/* ------------------------------------------------------------------ */
/* Design generators                                                   */
/* ------------------------------------------------------------------ */

/**
 * Visual signature of a design, used to group near-identical prints into
 * families. `key` holds the categorical choices that change the look outright
 * (algorithm, word, shape, polarity…); `vec` holds the continuous parameters
 * normalised to ~[0, 1]. Designs only share a family when their keys match
 * and their vectors are close. Computing it consumes no randomness, so the
 * prints are unaffected.
 */
export interface Signature {
  key: string;
  vec: number[];
}

export interface Design {
  body: string;
  variant: string;
  sig: Signature;
  description: string;
  /** Missing dimensions default to 0 (see vector()). */
  features: Partial<Record<FeatureKey, number>>;
  /** 0..1, drives price. */
  complexity: number;
}

export type Generator = (rng: Rng, ink: string, ground: string) => Design;

export const X0 = M;
export const Y0 = M;
export const IW = W - 2 * M;
export const IH = H - 2 * M;
