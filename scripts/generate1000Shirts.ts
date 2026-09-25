/**
 * Offline procedural generator for the MONO catalog.
 *
 *   npm run generate
 *
 * Writes 1,000 monochrome 3:4 SVG prints to public/prints/print_N.svg and the
 * catalog to data/shirts.json. Fully deterministic (seeded PRNG): re-running
 * produces byte-identical output.
 *
 * Every print is single-ink: white ink on a black ground for black tees, black
 * ink on a white ground for white tees. The app blends the ground into the
 * fabric, so only the ink reads on the garment.
 *
 * Feature vectors are computed from each design's actual parameters (line
 * counts, fill ratios, stroke weights, coverage…), not assigned at random.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  FEATURE_KEYS,
  SHIRT_CATEGORIES,
  type BaseColor,
  type FeatureKey,
  type FeatureVector,
  type ShirtCategory,
  type ShirtProduct,
} from "../types/shirt";

const TOTAL = 1000;
const BLACK_SHARE = 0.7;
const SEED = 0x6d6f6e6f; // "mono"

const W = 300;
const H = 400;
const M = 24; // print margin

const ROOT = path.resolve(__dirname, "..");
const PRINTS_DIR = path.join(ROOT, "public", "prints");
const DATA_FILE = path.join(ROOT, "data", "shirts.json");

/* ------------------------------------------------------------------ */
/* Deterministic randomness + small helpers                            */
/* ------------------------------------------------------------------ */

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const int = (rng: Rng, min: number, max: number) => Math.floor(range(rng, min, max + 1));
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const n1 = (n: number) => Math.round(n * 10) / 10; // SVG coordinate precision
const r2 = (n: number) => Math.round(n * 100) / 100;

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function vector(v: Record<FeatureKey, number>): FeatureVector {
  const out = {} as FeatureVector;
  for (const k of FEATURE_KEYS) out[k] = r2(clamp01(v[k]));
  return out;
}

const pts = (points: [number, number][]) => points.map(([x, y]) => `${n1(x)},${n1(y)}`).join(" ");

function polygon(cx: number, cy: number, r: number, sides: number, rot: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

/** Smooth path through points (quadratic curves via midpoints). */
function smooth(points: [number, number][], closed = false): string {
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
interface Signature {
  key: string;
  vec: number[];
}

interface Design {
  body: string;
  variant: string;
  sig: Signature;
  description: string;
  features: Record<FeatureKey, number>;
  /** 0..1, drives price. */
  complexity: number;
}

type Generator = (rng: Rng, ink: string, ground: string) => Design;

const X0 = M;
const Y0 = M;
const IW = W - 2 * M;
const IH = H - 2 * M;

/* a) Architectural grids & perspective ------------------------------ */

const facadeGrid: Generator = (rng, ink) => {
  const cols = int(rng, 4, 12);
  const rows = int(rng, 5, 16);
  const fillP = range(rng, 0.08, 0.65);
  const sw = pick(rng, [1, 1.5, 2, 3]);
  const cw = IW / cols;
  const ch = IH / rows;
  const gap = range(rng, 0.14, 0.32) * Math.min(cw, ch);
  let filled = 0;
  let cells = `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/>`;
  const bandRows = new Set(Array.from({ length: rows }, (_, r) => r).filter(() => rng() < 0.1));
  for (let r = 0; r < rows; r++) {
    if (bandRows.has(r)) {
      cells += `<rect x="${X0}" y="${n1(Y0 + r * ch + gap / 2)}" width="${IW}" height="${n1(ch - gap)}" fill="${ink}"/>`;
      filled += cols;
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const on = rng() < fillP;
      if (on) filled++;
      cells += `<rect x="${n1(X0 + c * cw + gap / 2)}" y="${n1(Y0 + r * ch + gap / 2)}" width="${n1(cw - gap)}" height="${n1(ch - gap)}"${on ? ` fill="${ink}"` : ""}/>`;
    }
  }
  const fillRatio = filled / (cols * rows);
  const count = (cols * rows) / 192;
  const density = clamp01(count * 0.65 + fillRatio * 0.45);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${cells}</g>`,
    variant: "facade",
    sig: { key: "facade", vec: [(cols - 4) / 8, (rows - 5) / 11, fillRatio] },
    description: `Brutalist facade grid, ${cols}×${rows} bays with ${Math.round(fillRatio * 100)}% solid infill.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.55, 0.75),
      typography: 0.02,
      architectural: range(rng, 0.88, 1),
      abstract: range(rng, 0.05, 0.2),
      line_art: 0.25 + (1 - fillRatio) * 0.3,
      halftone_raster: cols * rows > 120 ? 0.2 : 0.06,
      density,
      contrast: 0.45 + fillRatio * 0.4 + (sw - 1) * 0.08,
      dark_industrial: 0.35 + density * 0.5,
      clean_minimal: 0.75 - density * 0.6,
    },
  };
};

const perspectiveCorridor: Generator = (rng, ink) => {
  const vx = W / 2 + range(rng, -70, 70);
  const vy = range(rng, 120, 280);
  const rays = int(rng, 14, 44);
  const frames = int(rng, 4, 14);
  const sw = pick(rng, [0.8, 1, 1.5, 2]);
  const border: [number, number][] = [];
  const per = Math.ceil(rays / 4);
  for (let i = 0; i < per; i++) {
    const t = i / per;
    border.push([X0 + t * IW, Y0], [X0 + IW, Y0 + t * IH], [X0 + IW - t * IW, Y0 + IH], [X0, Y0 + IH - t * IH]);
  }
  let d = "";
  for (const [x, y] of border) d += `M${n1(vx)},${n1(vy)} L${n1(x)},${n1(y)} `;
  let rects = "";
  const growth = range(rng, 0.62, 0.82);
  let s = 1;
  for (let i = 0; i < frames; i++) {
    s *= growth;
    const lerp = (a: number, b: number) => b + (a - b) * s;
    rects += `<rect x="${n1(lerp(X0, vx))}" y="${n1(lerp(Y0, vy))}" width="${n1(IW * s)}" height="${n1(IH * s)}"/>`;
  }
  const density = clamp01((rays / 44) * 0.6 + (frames / 14) * 0.4);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/><path d="${d.trim()}"/>${rects}</g>`,
    variant: "perspective",
    sig: { key: "perspective", vec: [(vx - 80) / 140, (vy - 120) / 160] },
    description: `One-point perspective corridor: ${rays} vanishing rays and ${frames} receding frames.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.5, 0.7),
      typography: 0.02,
      architectural: range(rng, 0.8, 0.95),
      abstract: range(rng, 0.15, 0.3),
      line_art: range(rng, 0.68, 0.9),
      halftone_raster: 0.02,
      density,
      contrast: 0.45 + sw * 0.12,
      dark_industrial: 0.45 + density * 0.35,
      clean_minimal: 0.62 - density * 0.5,
    },
  };
};

const skyline: Generator = (rng, ink, ground) => {
  const towers = int(rng, 5, 13);
  const baseY = Y0 + IH - range(rng, 0, 40);
  let x = X0;
  let body = "";
  let area = 0;
  const widths = Array.from({ length: towers }, () => range(rng, 0.6, 1.6));
  const total = widths.reduce((a, b) => a + b, 0);
  const windowP = range(rng, 0.2, 0.7);
  for (const wRel of widths) {
    const w = (wRel / total) * IW;
    const h = range(rng, 0.25, 0.92) * (baseY - Y0);
    body += `<rect x="${n1(x)}" y="${n1(baseY - h)}" width="${n1(w - 1)}" height="${n1(h)}" fill="${ink}"/>`;
    area += w * h;
    // window grid knocked out in ground colour
    const wc = Math.max(1, Math.floor(w / 9));
    const wr = Math.floor(h / 12);
    for (let r = 0; r < wr; r++)
      for (let c = 0; c < wc; c++)
        if (rng() < windowP)
          body += `<rect x="${n1(x + 3 + c * ((w - 4) / wc))}" y="${n1(baseY - h + 5 + r * 12)}" width="${n1(Math.max(1.5, (w - 4) / wc - 3))}" height="5" fill="${ground}"/>`;
    x += w;
  }
  body += `<line x1="${X0}" y1="${n1(baseY)}" x2="${X0 + IW}" y2="${n1(baseY)}" stroke="${ink}" stroke-width="2"/>`;
  const coverage = area / (IW * IH);
  return {
    body,
    variant: "skyline",
    sig: { key: "skyline", vec: [(towers - 5) / 8, windowP] },
    description: `Solid skyline of ${towers} towers with knocked-out window grids.`,
    complexity: clamp01(coverage + windowP * 0.3),
    features: {
      geometric: range(rng, 0.55, 0.7),
      typography: 0.02,
      architectural: range(rng, 0.88, 1),
      abstract: range(rng, 0.05, 0.18),
      line_art: range(rng, 0.08, 0.25),
      halftone_raster: windowP * 0.3,
      density: clamp01(coverage * 0.8 + windowP * 0.3),
      contrast: range(rng, 0.78, 0.96),
      dark_industrial: 0.55 + coverage * 0.4,
      clean_minimal: 0.4 - coverage * 0.3,
    },
  };
};

const slabStack: Generator = (rng, ink) => {
  const slabs = int(rng, 4, 11);
  const cols = int(rng, 2, 6);
  let body = "";
  let y = Y0;
  let solid = 0;
  const heights = Array.from({ length: slabs }, () => range(rng, 0.5, 1.5));
  const total = heights.reduce((a, b) => a + b, 0);
  const sw = pick(rng, [1.5, 2, 3]);
  for (const hRel of heights) {
    const h = (hRel / total) * IH;
    const offset = range(rng, -18, 18);
    const isSolid = rng() < 0.45;
    if (isSolid) solid++;
    body += `<rect x="${n1(X0 + 10 + offset)}" y="${n1(y + 3)}" width="${n1(IW - 20)}" height="${n1(h - 6)}"${isSolid ? ` fill="${ink}"` : ""}/>`;
    if (!isSolid)
      for (let c = 1; c < cols; c++) {
        const cx = X0 + 10 + offset + (c / cols) * (IW - 20);
        body += `<line x1="${n1(cx)}" y1="${n1(y + 3)}" x2="${n1(cx)}" y2="${n1(y + h - 3)}"/>`;
      }
    y += h;
  }
  const solidRatio = solid / slabs;
  const density = clamp01(0.3 + solidRatio * 0.45 + (slabs / 11) * 0.25);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "slabs",
    sig: { key: "slabs", vec: [solidRatio, (slabs - 4) / 7] },
    description: `Cantilevered stack of ${slabs} concrete slabs, ${solid} poured solid.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.6, 0.8),
      typography: 0.02,
      architectural: range(rng, 0.78, 0.95),
      abstract: range(rng, 0.2, 0.35),
      line_art: 0.2 + (1 - solidRatio) * 0.35,
      halftone_raster: 0.03,
      density,
      contrast: 0.55 + solidRatio * 0.4,
      dark_industrial: 0.5 + solidRatio * 0.4,
      clean_minimal: 0.55 - solidRatio * 0.35,
    },
  };
};

/* b) Geometric & polygons ------------------------------------------- */

function shape(rng: Rng, cx: number, cy: number, r: number, ink: string, fill: boolean, sw: number, kinds?: string[]) {
  const kind = pick(rng, ["circle", "square", "triangle", "hex", "diamond"] as const);
  kinds?.push(kind);
  const style = fill ? `fill="${ink}"` : `fill="none" stroke="${ink}" stroke-width="${sw}"`;
  if (kind === "circle") return `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" ${style}/>`;
  const sides = kind === "triangle" ? 3 : kind === "hex" ? 6 : 4;
  const rot = kind === "square" ? Math.PI / 4 + range(rng, -0.3, 0.3) : kind === "diamond" ? 0 : range(rng, 0, Math.PI * 2);
  return `<polygon points="${pts(polygon(cx, cy, r, sides, rot))}" ${style}/>`;
}

const monoForm: Generator = (rng, ink) => {
  const n = int(rng, 1, 3);
  const sw = pick(rng, [2, 3, 4, 6]);
  let body = "";
  let filled = 0;
  const kinds: string[] = [];
  for (let i = 0; i < n; i++) {
    const fill = rng() < 0.5;
    if (fill) filled++;
    body += shape(rng, W / 2 + range(rng, -35, 35), H / 2 + range(rng, -50, 50), range(rng, 55, 115), ink, fill, sw, kinds);
  }
  const fillRatio = filled / n;
  return {
    body,
    variant: "monoform",
    sig: { key: `monoform-${n}-${kinds[0]}`, vec: [fillRatio] },
    description: `${n === 1 ? "A single" : n === 2 ? "Two overlapping" : "Three overlapping"} primary form${n > 1 ? "s" : ""}, reduced to pure geometry.`,
    complexity: 0.15 + n * 0.08,
    features: {
      geometric: range(rng, 0.88, 1),
      typography: 0,
      architectural: range(rng, 0.05, 0.18),
      abstract: range(rng, 0.45, 0.65),
      line_art: 0.1 + (1 - fillRatio) * 0.3,
      halftone_raster: 0,
      density: 0.1 + n * 0.07 + fillRatio * 0.12,
      contrast: 0.6 + fillRatio * 0.35,
      dark_industrial: range(rng, 0.08, 0.25),
      clean_minimal: range(rng, 0.82, 0.97),
    },
  };
};

const scatter: Generator = (rng, ink) => {
  const n = int(rng, 5, 14);
  const fillP = range(rng, 0.2, 0.8);
  const sw = pick(rng, [1.5, 2, 3]);
  let body = "";
  let filled = 0;
  for (let i = 0; i < n; i++) {
    const fill = rng() < fillP;
    if (fill) filled++;
    body += shape(rng, range(rng, X0 + 25, X0 + IW - 25), range(rng, Y0 + 25, Y0 + IH - 25), range(rng, 12, 55), ink, fill, sw);
  }
  const fillRatio = filled / n;
  const density = clamp01(0.3 + (n / 14) * 0.35 + fillRatio * 0.2);
  return {
    body,
    variant: "scatter",
    sig: { key: "scatter", vec: [fillRatio, (n - 5) / 9] },
    description: `${n} primitives scattered in a loose constellation.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.82, 0.96),
      typography: 0,
      architectural: range(rng, 0.03, 0.12),
      abstract: range(rng, 0.6, 0.8),
      line_art: 0.15 + (1 - fillRatio) * 0.3,
      halftone_raster: 0.05,
      density,
      contrast: 0.55 + fillRatio * 0.3,
      dark_industrial: range(rng, 0.15, 0.35),
      clean_minimal: 0.7 - density * 0.4,
    },
  };
};

const concentric: Generator = (rng, ink) => {
  const sides = int(rng, 3, 8);
  const rings = int(rng, 5, 18);
  const twist = range(rng, 0, 0.18) * (rng() < 0.5 ? -1 : 1);
  const sw = pick(rng, [1, 1.5, 2]);
  const maxR = range(rng, 105, 130);
  let body = "";
  for (let i = 0; i < rings; i++) {
    const r = maxR * (1 - i / rings);
    body += `<polygon points="${pts(polygon(W / 2, H / 2, r, sides, -Math.PI / 2 + i * twist))}"/>`;
  }
  const density = clamp01(0.25 + (rings / 18) * 0.55);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "concentric",
    sig: { key: `concentric-${sides}-${Math.abs(twist) > 0.06 ? "spiral" : "straight"}`, vec: [] },
    description: `${rings} concentric ${sides}-sided rings${twist ? " with a slow twist" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.9, 1),
      typography: 0,
      architectural: range(rng, 0.1, 0.25),
      abstract: range(rng, 0.5, 0.7),
      line_art: range(rng, 0.55, 0.78),
      halftone_raster: 0.03,
      density,
      contrast: 0.45 + sw * 0.12,
      dark_industrial: range(rng, 0.12, 0.3),
      clean_minimal: 0.75 - density * 0.35,
    },
  };
};

const truchet: Generator = (rng, ink) => {
  const cols = int(rng, 4, 10);
  const size = IW / cols;
  const rows = Math.floor(IH / size);
  const y0 = Y0 + (IH - rows * size) / 2;
  const fillP = range(rng, 0.35, 0.75);
  let d = "";
  let filled = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (rng() > fillP) continue;
      filled++;
      const x = X0 + c * size;
      const y = y0 + r * size;
      const corner = int(rng, 0, 3);
      const tri: [number, number][][] = [
        [[x, y], [x + size, y], [x, y + size]],
        [[x, y], [x + size, y], [x + size, y + size]],
        [[x + size, y], [x + size, y + size], [x, y + size]],
        [[x, y], [x + size, y + size], [x, y + size]],
      ];
      d += `M${pts(tri[corner]).replace(/ /g, " L")}Z`;
    }
  const fillRatio = filled / (rows * cols);
  const density = clamp01(0.35 + fillRatio * 0.4 + (cols / 10) * 0.2);
  return {
    body: `<path d="${d}" fill="${ink}"/><rect x="${X0}" y="${n1(y0)}" width="${IW}" height="${n1(rows * size)}" fill="none" stroke="${ink}" stroke-width="1.5"/>`,
    variant: "tiling",
    sig: { key: "tiling", vec: [(cols - 4) / 6] },
    description: `Truchet tiling, ${cols}×${rows} half-square triangles.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.9, 1),
      typography: 0,
      architectural: range(rng, 0.2, 0.35),
      abstract: range(rng, 0.45, 0.6),
      line_art: 0.08,
      halftone_raster: cols >= 8 ? 0.25 : 0.1,
      density,
      contrast: range(rng, 0.78, 0.95),
      dark_industrial: 0.3 + density * 0.3,
      clean_minimal: 0.45 - density * 0.3,
    },
  };
};

/* c) Typography & coordinates --------------------------------------- */

const WORDS = [
  "VOID", "MONO", "RAW", "NULL", "GRID", "ECHO", "FORM", "MASS", "SLAB", "ZERO",
  "NOISE", "STATIC", "SIGNAL", "INDEX", "AXIS", "BLOCK", "UNIT", "DATA", "LOOP", "TONE",
];
const SANS = `font-family="Helvetica, Arial, sans-serif"`;
const MONO_FONT = `font-family="Courier New, Courier, monospace"`;

const bigWord: Generator = (rng, ink) => {
  const word = pick(rng, WORDS);
  const vertical = rng() < 0.35;
  const outline = rng() < 0.35;
  const span = vertical ? IH : IW;
  const size = Math.min(span / (word.length * 0.62), vertical ? 130 : 150);
  const style = outline ? `fill="none" stroke="${ink}" stroke-width="2"` : `fill="${ink}"`;
  const text = vertical
    ? `<text x="0" y="0" transform="translate(${n1(W / 2 + size * 0.35)},${H / 2}) rotate(-90)" text-anchor="middle" font-size="${n1(size)}" font-weight="900" letter-spacing="-2" ${SANS} ${style}>${word}</text>`
    : `<text x="${W / 2}" y="${n1(H / 2 + size * 0.35)}" text-anchor="middle" font-size="${n1(size)}" font-weight="900" letter-spacing="-2" ${SANS} ${style}>${word}</text>`;
  const serial = `NO.${String(int(rng, 1, 999)).padStart(3, "0")}`;
  const caption = `<text x="${X0}" y="${Y0 + IH}" font-size="9" letter-spacing="2" ${MONO_FONT} fill="${ink}">MONO / ${serial} / MMXXVI</text><line x1="${X0}" y1="${Y0 + IH - 16}" x2="${X0 + IW}" y2="${Y0 + IH - 16}" stroke="${ink}" stroke-width="1"/>`;
  return {
    body: text + caption,
    variant: "word",
    sig: { key: `word-${word}-${vertical ? "v" : "h"}-${outline ? "o" : "f"}`, vec: [] },
    description: `"${word}" set ${vertical ? "vertically " : ""}in heavy grotesk${outline ? ", outlined" : ""}.`,
    complexity: 0.25,
    features: {
      geometric: range(rng, 0.15, 0.3),
      typography: range(rng, 0.9, 1),
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.05, 0.2),
      line_art: outline ? range(rng, 0.3, 0.45) : 0.08,
      halftone_raster: 0,
      density: range(rng, 0.15, 0.35),
      contrast: outline ? range(rng, 0.6, 0.75) : range(rng, 0.8, 0.96),
      dark_industrial: range(rng, 0.2, 0.45),
      clean_minimal: range(rng, 0.72, 0.9),
    },
  };
};

const coordinates: Generator = (rng, ink) => {
  const lat = range(rng, -80, 80);
  const lon = range(rng, -179, 179);
  const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}&#176; ${v >= 0 ? pos : neg}`;
  const lines = int(rng, 6, 18);
  const cx = range(rng, X0 + 60, X0 + IW - 60);
  const cy = range(rng, Y0 + 70, Y0 + 170);
  let body = `<g stroke="${ink}" stroke-width="1"><line x1="${X0}" y1="${n1(cy)}" x2="${X0 + IW}" y2="${n1(cy)}"/><line x1="${n1(cx)}" y1="${Y0}" x2="${n1(cx)}" y2="${n1(cy + 90)}"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(range(rng, 10, 26))}" fill="none"/></g>`;
  body += `<text x="${X0}" y="${n1(cy + 125)}" font-size="26" font-weight="700" ${SANS} fill="${ink}">${fmt(lat, "N", "S")}</text>`;
  body += `<text x="${X0}" y="${n1(cy + 155)}" font-size="26" font-weight="700" ${SANS} fill="${ink}">${fmt(lon, "E", "W")}</text>`;
  let y = cy + 185;
  for (let i = 0; i < lines && y < Y0 + IH; i++, y += 12) {
    const a = (lat + range(rng, -1, 1)).toFixed(3);
    const b = (lon + range(rng, -1, 1)).toFixed(3);
    body += `<text x="${X0}" y="${n1(y)}" font-size="8.5" ${MONO_FONT} fill="${ink}">${String(i + 1).padStart(2, "0")}  ${a}  ${b}  ${int(rng, 10, 999)}M</text>`;
  }
  const density = clamp01(0.3 + (lines / 18) * 0.35);
  return {
    body,
    variant: "coordinates",
    sig: { key: "coords", vec: [(lines - 6) / 12, (cx - X0 - 60) / (IW - 120), (cy - Y0 - 70) / 100] },
    description: `Survey sheet for ${fmt(lat, "N", "S").replace("&#176;", "°")}, crosshair and ${lines} logged points.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.3, 0.5),
      typography: range(rng, 0.85, 0.95),
      architectural: range(rng, 0.2, 0.4),
      abstract: range(rng, 0.05, 0.15),
      line_art: range(rng, 0.3, 0.5),
      halftone_raster: 0.03,
      density,
      contrast: range(rng, 0.55, 0.72),
      dark_industrial: range(rng, 0.3, 0.5),
      clean_minimal: 0.75 - density * 0.4,
    },
  };
};

const repeatStack: Generator = (rng, ink) => {
  const word = pick(rng, WORDS);
  const lines = int(rng, 7, 16);
  const lh = IH / lines;
  const size = Math.min(lh * 1.05, IW / (word.length * 0.6));
  const alt = rng() < 0.6;
  let body = "";
  for (let i = 0; i < lines; i++) {
    const outline = alt && i % 2 === 1;
    body += `<text x="${W / 2}" y="${n1(Y0 + (i + 1) * lh - lh * 0.12)}" text-anchor="middle" font-size="${n1(size)}" font-weight="900" letter-spacing="-1" ${SANS} ${outline ? `fill="none" stroke="${ink}" stroke-width="1.2"` : `fill="${ink}"`}>${word}</text>`;
  }
  const density = clamp01(0.55 + (lines / 16) * 0.35);
  return {
    body,
    variant: "repeat",
    sig: { key: `repeat-${word}-${alt ? "alt" : "solid"}`, vec: [(lines - 7) / 9] },
    description: `"${word}" repeated ${lines} times${alt ? ", alternating solid and outline" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.2, 0.35),
      typography: range(rng, 0.95, 1),
      architectural: range(rng, 0.1, 0.25),
      abstract: range(rng, 0.1, 0.25),
      line_art: alt ? 0.3 : 0.08,
      halftone_raster: 0.08,
      density,
      contrast: range(rng, 0.75, 0.95),
      dark_industrial: 0.4 + density * 0.35,
      clean_minimal: 0.4 - density * 0.25,
    },
  };
};

const manifesto: Generator = (rng, ink) => {
  const heading = pick(rng, WORDS);
  const cols = int(rng, 2, 3);
  const rows = int(rng, 16, 28);
  const colW = (IW - (cols - 1) * 10) / cols;
  let body = `<text x="${X0}" y="${Y0 + 44}" font-size="46" font-weight="900" letter-spacing="-1" ${SANS} fill="${ink}">${heading}</text><rect x="${X0}" y="${Y0 + 54}" width="${IW}" height="4" fill="${ink}"/>`;
  const lh = (IH - 76) / rows;
  const perLine = Math.max(1, Math.floor(colW / 30));
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const words = Array.from({ length: perLine }, () => pick(rng, WORDS)).join(" ");
      body += `<text x="${n1(X0 + c * (colW + 10))}" y="${n1(Y0 + 76 + (r + 1) * lh)}" font-size="${n1(Math.min(8.5, lh * 0.8))}" letter-spacing="0.5" ${MONO_FONT} fill="${ink}">${words}</text>`;
    }
  const density = clamp01(0.65 + (rows / 28) * 0.3);
  return {
    body,
    variant: "manifesto",
    sig: { key: `manifesto-${cols}`, vec: [(rows - 16) / 12] },
    description: `Manifesto layout: ${heading} masthead over ${cols} columns of dense type.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.15, 0.3),
      typography: range(rng, 0.9, 1),
      architectural: range(rng, 0.2, 0.35),
      abstract: range(rng, 0.05, 0.15),
      line_art: 0.1,
      halftone_raster: range(rng, 0.12, 0.28),
      density,
      contrast: range(rng, 0.55, 0.75),
      dark_industrial: 0.45 + density * 0.25,
      clean_minimal: 0.3 - density * 0.15,
    },
  };
};

/* d) Dot matrix & halftone ------------------------------------------ */

function dotGrid(
  rng: Rng,
  ink: string,
  step: number,
  radiusAt: (x: number, y: number) => number,
): { body: string; coverage: number; dots: number } {
  let body = "";
  let area = 0;
  let dots = 0;
  const cols = Math.floor(IW / step);
  const rows = Math.floor(IH / step);
  const ox = X0 + (IW - (cols - 1) * step) / 2;
  const oy = Y0 + (IH - (rows - 1) * step) / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = ox + c * step;
      const y = oy + r * step;
      const rad = radiusAt(x, y);
      if (rad < 0.45) continue;
      dots++;
      area += Math.PI * rad * rad;
      body += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rad)}"/>`;
    }
  return { body: `<g fill="${ink}">${body}</g>`, coverage: area / (IW * IH), dots };
}

const radialHalftone: Generator = (rng, ink) => {
  const step = int(rng, 11, 18);
  const cx = range(rng, X0, X0 + IW);
  const cy = range(rng, Y0, Y0 + IH);
  const invert = rng() < 0.4;
  const gamma = range(rng, 0.7, 1.8);
  const maxD = Math.hypot(Math.max(cx - X0, X0 + IW - cx), Math.max(cy - Y0, Y0 + IH - cy));
  const { body, coverage } = dotGrid(rng, ink, step, (x, y) => {
    const t = Math.hypot(x - cx, y - cy) / maxD;
    return (step / 2) * 0.98 * Math.pow(invert ? t : 1 - t, gamma);
  });
  return {
    body,
    variant: "radial",
    sig: { key: `radial-${invert ? "inv" : "std"}`, vec: [(cx - X0) / IW, (cy - Y0) / IH] },
    description: `Radial halftone burst, ${step}px screen${invert ? ", inverted" : ""}.`,
    complexity: clamp01(coverage * 1.5 + (18 - step) / 14),
    features: {
      geometric: range(rng, 0.2, 0.35),
      typography: 0,
      architectural: range(rng, 0.02, 0.1),
      abstract: range(rng, 0.45, 0.65),
      line_art: 0.03,
      halftone_raster: range(rng, 0.9, 1),
      density: clamp01(coverage * 1.4 + 0.15),
      contrast: range(rng, 0.6, 0.85),
      dark_industrial: range(rng, 0.35, 0.6),
      clean_minimal: range(rng, 0.25, 0.45),
    },
  };
};

const linearHalftone: Generator = (rng, ink) => {
  const step = int(rng, 11, 17);
  const angle = pick(rng, [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, range(rng, 0, Math.PI)]);
  const bands = int(rng, 1, 3);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const { body, coverage } = dotGrid(rng, ink, step, (x, y) => {
    const proj = ((x - W / 2) * dx + (y - H / 2) * dy) / 250 + 0.5;
    const t = 0.5 + 0.5 * Math.sin(proj * Math.PI * bands);
    return (step / 2) * 0.98 * t;
  });
  return {
    body,
    variant: "gradient",
    sig: { key: `gradient-${bands}`, vec: [(((angle % Math.PI) + Math.PI) % Math.PI) / Math.PI] },
    description: `Ordered halftone gradient in ${bands} band${bands > 1 ? "s" : ""}, ${step}px screen.`,
    complexity: clamp01(coverage * 1.4 + (17 - step) / 12),
    features: {
      geometric: range(rng, 0.25, 0.4),
      typography: 0,
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.35, 0.55),
      line_art: 0.05,
      halftone_raster: range(rng, 0.92, 1),
      density: clamp01(coverage * 1.4 + 0.2),
      contrast: range(rng, 0.62, 0.82),
      dark_industrial: range(rng, 0.3, 0.55),
      clean_minimal: range(rng, 0.3, 0.5),
    },
  };
};

const dotMatrix: Generator = (rng, ink) => {
  const step = int(rng, 12, 18);
  const form = pick(rng, ["circle", "ring", "diamond", "bars", "cross"] as const);
  const cx = W / 2;
  const cy = H / 2;
  const R = range(rng, 80, 125);
  const on = (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy);
    switch (form) {
      case "circle": return d < R;
      case "ring": return d < R && d > R * 0.55;
      case "diamond": return Math.abs(x - cx) + Math.abs(y - cy) < R * 1.2;
      case "bars": return Math.floor((y - Y0) / (step * 2)) % 2 === 0;
      case "cross": return Math.abs(x - cx) < R * 0.3 || Math.abs(y - cy) < R * 0.3;
    }
  };
  const offR = rng() < 0.5 ? step * 0.12 : 0;
  const { body, coverage } = dotGrid(rng, ink, step, (x, y) => (on(x, y) ? step * 0.4 : offR));
  return {
    body,
    variant: "matrix",
    sig: { key: `matrix-${form}-${offR > 0 ? "grid" : "clean"}`, vec: [] },
    description: `Dot-matrix ${form} on a ${step}px LED grid.`,
    complexity: clamp01(coverage * 1.5 + 0.2),
    features: {
      geometric: range(rng, 0.45, 0.65),
      typography: 0.05,
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.3, 0.5),
      line_art: 0.02,
      halftone_raster: range(rng, 0.85, 0.95),
      density: clamp01(coverage * 1.4 + 0.15),
      contrast: range(rng, 0.65, 0.85),
      dark_industrial: range(rng, 0.35, 0.55),
      clean_minimal: range(rng, 0.4, 0.6),
    },
  };
};

const stipple: Generator = (rng, ink) => {
  const count = int(rng, 350, 800);
  const clusters = int(rng, 1, 3);
  const centers = Array.from({ length: clusters }, () => [range(rng, X0 + 40, X0 + IW - 40), range(rng, Y0 + 40, Y0 + IH - 40), range(rng, 40, 110)]);
  let body = "";
  let area = 0;
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const [cx, cy, spread] = pick(rng, centers);
    // Box–Muller for a gaussian cloud
    const u = Math.max(1e-6, rng());
    const v = rng();
    const g = Math.sqrt(-2 * Math.log(u));
    const x = cx + g * Math.cos(2 * Math.PI * v) * spread * 0.6;
    const y = cy + g * Math.sin(2 * Math.PI * v) * spread * 0.6;
    if (x < X0 || x > X0 + IW || y < Y0 || y > Y0 + IH) continue;
    const r = range(rng, 0.7, 2.1);
    area += Math.PI * r * r;
    placed++;
    body += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}"/>`;
  }
  const density = clamp01(0.3 + (placed / 800) * 0.5);
  return {
    body: `<g fill="${ink}">${body}</g>`,
    variant: "stipple",
    sig: { key: `stipple-${clusters}`, vec: [(placed - 300) / 500] },
    description: `Stippled grain cloud of ${placed} hand-set dots in ${clusters} mass${clusters > 1 ? "es" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.05, 0.15),
      typography: 0,
      architectural: range(rng, 0.02, 0.08),
      abstract: range(rng, 0.62, 0.82),
      line_art: 0.05,
      halftone_raster: range(rng, 0.8, 0.94),
      density,
      contrast: clamp01(0.35 + area / (IW * IH) * 3),
      dark_industrial: range(rng, 0.45, 0.7),
      clean_minimal: range(rng, 0.2, 0.4),
    },
  };
};

/* e) Abstract line art & waves -------------------------------------- */

const ridgeLines: Generator = (rng, ink, ground) => {
  const lines = int(rng, 18, 42);
  const amp = range(rng, 20, 55);
  const sw = pick(rng, [1, 1.2, 1.5]);
  const peaks = int(rng, 1, 3);
  const peakX = Array.from({ length: peaks }, () => range(rng, X0 + 60, X0 + IW - 60));
  let body = "";
  const top = Y0 + 50;
  const gap = (IH - 60) / lines;
  for (let i = 0; i < lines; i++) {
    const base = top + i * gap;
    const p: [number, number][] = [];
    const phase = rng() * 10;
    for (let x = X0; x <= X0 + IW; x += 8) {
      let bump = 0;
      for (const px of peakX) bump += Math.exp(-((x - px) ** 2) / (2 * 26 ** 2));
      const noise = 0.5 + 0.5 * Math.sin(x * 0.11 + phase) * Math.sin(x * 0.037 + phase * 2);
      p.push([x, base - bump * amp * noise]);
    }
    body += `<path d="${smooth(p)} L${X0 + IW},${n1(base + 4)} L${X0},${n1(base + 4)}Z" fill="${ground}" stroke="${ink}" stroke-width="${sw}"/>`;
  }
  const density = clamp01(0.35 + (lines / 42) * 0.5);
  return {
    body,
    variant: "ridges",
    sig: { key: `ridges-${peaks}`, vec: [(lines - 18) / 24] },
    description: `${lines} stacked ridge lines rising into ${peaks} peak${peaks > 1 ? "s" : ""}, like a pulsar plot.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.05, 0.15),
      typography: 0,
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.7, 0.9),
      line_art: range(rng, 0.85, 1),
      halftone_raster: 0.05,
      density,
      contrast: range(rng, 0.55, 0.75),
      dark_industrial: range(rng, 0.35, 0.6),
      clean_minimal: 0.5 - density * 0.3,
    },
  };
};

const waveInterference: Generator = (rng, ink) => {
  const families = int(rng, 2, 3);
  const perFamily = int(rng, 8, 22);
  const sw = pick(rng, [0.8, 1, 1.4]);
  let body = "";
  for (let f = 0; f < families; f++) {
    const angle = f === 0 ? 0 : range(rng, -40, 40);
    const freq = range(rng, 0.015, 0.05);
    const amp = range(rng, 6, 24);
    let d = "";
    for (let i = 0; i < perFamily; i++) {
      const y0 = -60 + (i / perFamily) * (H + 120);
      const p: [number, number][] = [];
      for (let x = -60; x <= W + 60; x += 10) p.push([x, y0 + Math.sin(x * freq + i * 0.4) * amp]);
      d += smooth(p) + " ";
    }
    body += `<path d="${d.trim()}" transform="rotate(${n1(angle)} ${W / 2} ${H / 2})"/>`;
  }
  const density = clamp01(0.3 + ((families * perFamily) / 66) * 0.6);
  return {
    body: `<clipPath id="c"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/></clipPath><g clip-path="url(#c)" fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "interference",
    sig: { key: `interference-${families}`, vec: [(perFamily - 8) / 14] },
    description: `${families} families of sine waves crossing into a moiré.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.15, 0.3),
      typography: 0,
      architectural: range(rng, 0.02, 0.1),
      abstract: range(rng, 0.75, 0.95),
      line_art: range(rng, 0.9, 1),
      halftone_raster: range(rng, 0.1, 0.25),
      density,
      contrast: 0.4 + sw * 0.15,
      dark_industrial: range(rng, 0.15, 0.35),
      clean_minimal: 0.65 - density * 0.35,
    },
  };
};

const contours: Generator = (rng, ink) => {
  const rings = int(rng, 8, 24);
  const cx = W / 2 + range(rng, -30, 30);
  const cy = H / 2 + range(rng, -40, 40);
  const a1 = range(rng, 0.05, 0.2);
  const a2 = range(rng, 0.02, 0.12);
  const p1 = rng() * 6;
  const p2 = rng() * 6;
  const k1 = int(rng, 2, 4);
  const k2 = int(rng, 4, 7);
  const sw = pick(rng, [1, 1.3, 1.8]);
  let body = "";
  for (let i = 1; i <= rings; i++) {
    const R = (i / rings) * range(rng, 120, 128);
    const p: [number, number][] = [];
    for (let s = 0; s < 40; s++) {
      const t = (s / 40) * Math.PI * 2;
      const r = R * (1 + a1 * Math.sin(k1 * t + p1 + i * 0.15) + a2 * Math.sin(k2 * t + p2));
      p.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * 1.2]);
    }
    body += `<path d="${smooth(p, true)}"/>`;
  }
  const density = clamp01(0.25 + (rings / 24) * 0.55);
  return {
    body: `<clipPath id="c"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/></clipPath><g clip-path="url(#c)" fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "contours",
    sig: { key: `contours-${k1}`, vec: [(rings - 8) / 16] },
    description: `Topographic contour map, ${rings} elevation lines.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.1, 0.25),
      typography: 0,
      architectural: range(rng, 0.1, 0.2),
      abstract: range(rng, 0.6, 0.8),
      line_art: range(rng, 0.88, 1),
      halftone_raster: 0.03,
      density,
      contrast: 0.4 + sw * 0.15,
      dark_industrial: range(rng, 0.12, 0.3),
      clean_minimal: 0.75 - density * 0.35,
    },
  };
};

const continuousLine: Generator = (rng, ink) => {
  const strokes = int(rng, 1, 3);
  const sw = pick(rng, [2, 3, 4, 6]);
  let body = "";
  for (let s = 0; s < strokes; s++) {
    const n = int(rng, 5, 10);
    const p: [number, number][] = Array.from({ length: n }, () => [range(rng, X0 + 20, X0 + IW - 20), range(rng, Y0 + 20, Y0 + IH - 20)]);
    body += `<path d="${smooth(p)}"/>`;
  }
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`,
    variant: "gesture",
    sig: { key: `gesture-${strokes}`, vec: [(sw - 2) / 4] },
    description: `${strokes === 1 ? "A single continuous" : `${strokes} continuous`} gestural line${strokes > 1 ? "s" : ""}.`,
    complexity: 0.15 + strokes * 0.08,
    features: {
      geometric: range(rng, 0.03, 0.12),
      typography: 0,
      architectural: range(rng, 0.02, 0.08),
      abstract: range(rng, 0.8, 0.95),
      line_art: range(rng, 0.85, 0.98),
      halftone_raster: 0,
      density: 0.08 + strokes * 0.07,
      contrast: 0.45 + sw * 0.07,
      dark_industrial: range(rng, 0.05, 0.2),
      clean_minimal: range(rng, 0.82, 0.97),
    },
  };
};

const GENERATORS: Record<ShirtCategory, Generator[]> = {
  architectural: [facadeGrid, perspectiveCorridor, skyline, slabStack],
  geometric: [monoForm, scatter, concentric, truchet],
  typography: [bigWord, coordinates, repeatStack, manifesto],
  halftone: [radialHalftone, linearHalftone, dotMatrix, stipple],
  waves: [ridgeLines, waveInterference, contours, continuousLine],
};

/* ------------------------------------------------------------------ */
/* Titles                                                              */
/* ------------------------------------------------------------------ */

const TITLE_WORDS: Record<ShirtCategory, [string[], string[]]> = {
  architectural: [
    ["Concrete", "Brutal", "Monolith", "Facade", "Structural", "Civic", "Steel", "Tectonic", "Transit", "Pillar"],
    ["Lattice", "Elevation", "Section", "Frame", "Plan", "Module", "Stack", "Corridor", "Array", "Bay"],
  ],
  geometric: [
    ["Prime", "Solid", "Vector", "Orbit", "Pivot", "Axial", "Nodal", "Inverse", "Kinetic", "Euclid"],
    ["Form", "Polygon", "Sphere", "Vertex", "Cluster", "Arc", "Prism", "Tile", "Unit", "Shape"],
  ],
  typography: [
    ["Coordinate", "Index", "Manifest", "Transmit", "Serial", "Datum", "Header", "Glyph", "Caption", "Bulletin"],
    ["Log", "Sheet", "Stamp", "Code", "Report", "Series", "Notation", "Ledger", "Type", "Archive"],
  ],
  halftone: [
    ["Raster", "Grain", "Dot", "Static", "Pulse", "Dither", "Screen", "Noise", "Matrix", "Pixel"],
    ["Field", "Fade", "Bloom", "Gradient", "Sun", "Moon", "Scan", "Plate", "Haze", "Burst"],
  ],
  waves: [
    ["Drift", "Tide", "Flow", "Contour", "Echo", "Current", "Ripple", "Phase", "Fluid", "Loop"],
    ["Lines", "Study", "Wave", "Map", "Pattern", "Motion", "Stream", "Weave", "Rhythm", "Trace"],
  ],
};

const SKU_CODE: Record<ShirtCategory, string> = {
  architectural: "ARC",
  geometric: "GEO",
  typography: "TYP",
  halftone: "HLF",
  waves: "WAV",
};

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

function frame(rng: Rng, ink: string): { svg: string; kind: "frame" | "corners" | "none" } {
  const roll = rng();
  if (roll < 0.22) {
    const inset = 10;
    return { svg: `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" fill="none" stroke="${ink}" stroke-width="1.5"/>`, kind: "frame" };
  }
  if (roll < 0.36) {
    const L = 14;
    const i = 10;
    const d = `M${i},${i + L}V${i}H${i + L} M${W - i - L},${i}H${W - i}V${i + L} M${W - i},${H - i - L}V${H - i}H${W - i - L} M${i + L},${H - i}H${i}V${H - i - L}`;
    return { svg: `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.5"/>`, kind: "corners" };
  }
  return { svg: "", kind: "none" };
}

/**
 * RMS distance between signature vectors (both in ~[0,1] per dimension).
 * Below this, two designs of the same kind read as variations of one print.
 * Signatures only carry parameters the eye actually notices (tuned against
 * contact sheets), so e.g. ring count or stroke weight don't split families.
 */
const FAMILY_THRESHOLD = 0.25;

function sigDistance(a: number[], b: number[]) {
  if (a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
}

/**
 * Leader clustering: each design joins the nearest existing family leader
 * with the same key within FAMILY_THRESHOLD, else it founds a new family.
 * Comparing against leaders only (not every member) stops similarity from
 * chaining across a whole algorithm. Deterministic in catalog order.
 */
function assignFamilies(sigs: Signature[]): number[] {
  const leaders: { key: string; vec: number[]; family: number }[] = [];
  return sigs.map((sig) => {
    let best: (typeof leaders)[number] | null = null;
    let bestD = Infinity;
    for (const l of leaders) {
      if (l.key !== sig.key) continue;
      const d = sigDistance(l.vec, sig.vec);
      if (d < FAMILY_THRESHOLD && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) return best.family;
    const family = leaders.length;
    leaders.push({ key: sig.key, vec: sig.vec, family });
    return family;
  });
}

function main() {
  const rng = mulberry32(SEED);

  // Exactly 70% black / 30% white, spread evenly across categories.
  const colors: BaseColor[] = shuffle(rng, [
    ...Array<BaseColor>(Math.round(TOTAL * BLACK_SHARE)).fill("black"),
    ...Array<BaseColor>(TOTAL - Math.round(TOTAL * BLACK_SHARE)).fill("white"),
  ]);

  rmSync(PRINTS_DIR, { recursive: true, force: true });
  mkdirSync(PRINTS_DIR, { recursive: true });
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  const counters: Record<ShirtCategory, number> = { architectural: 0, geometric: 0, typography: 0, halftone: 0, waves: 0 };
  const shirts: Omit<ShirtProduct, "family">[] = [];
  const sigs: Signature[] = [];
  let bytes = 0;

  for (let i = 0; i < TOTAL; i++) {
    const n = i + 1;
    // Interleave categories so neighbouring ids differ in style.
    const category = SHIRT_CATEGORIES[i % SHIRT_CATEGORIES.length];
    const index = ++counters[category];
    const gens = GENERATORS[category];
    const gen = gens[(index - 1) % gens.length];

    const baseColor = colors[i];
    const ink = baseColor === "black" ? "#FFFFFF" : "#000000";
    const ground = baseColor === "black" ? "#000000" : "#FFFFFF";
    const designRng = mulberry32(SEED ^ Math.imul(n, 0x9e3779b1));

    // ~12% of prints are knocked out of a solid ink block (a bold rectangle).
    const knockout = designRng() < 0.12;
    const [dInk, dGround] = knockout ? [ground, ink] : [ink, ground];
    const design = gen(designRng, dInk, dGround);
    const fr = knockout ? { svg: "", kind: "none" as const } : frame(designRng, ink);

    const f = { ...design.features };
    if (fr.kind !== "none") {
      f.geometric += 0.05;
      f.clean_minimal += 0.04;
      f.architectural += 0.03;
    }
    if (knockout) {
      f.contrast += 0.15;
      f.density += 0.25;
      f.clean_minimal -= 0.1;
      f.dark_industrial += 0.1;
    }
    // White ink on black reads heavier and more industrial; black on white cleaner.
    if (baseColor === "black") {
      f.dark_industrial += 0.12;
      f.clean_minimal -= 0.05;
    } else {
      f.clean_minimal += 0.12;
      f.dark_industrial -= 0.08;
    }
    const features = vector(f);

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${ground}"/>` +
      (knockout ? `<rect x="${M / 2}" y="${M / 2}" width="${W - M}" height="${H - M}" fill="${ink}"/>` : "") +
      design.body +
      fr.svg +
      `</svg>`;
    writeFileSync(path.join(PRINTS_DIR, `print_${n}.svg`), svg);
    // A knocked-out block reads completely differently from the plain print.
    sigs.push({ key: `${design.sig.key}|${knockout ? "ko" : "std"}`, vec: design.sig.vec });
    bytes += svg.length;

    const [adjs, nouns] = TITLE_WORDS[category];
    const title = `${adjs[(index - 1) % adjs.length]} ${nouns[Math.floor((index - 1) / adjs.length) % nouns.length]} ${String(index).padStart(3, "0")}`;
    const price = Math.min(59, 39 + Math.round(clamp01(design.complexity) * 14) + int(designRng, 0, 6));

    shirts.push({
      id: `mono-${String(n).padStart(4, "0")}`,
      sku: `MN-${SKU_CODE[category]}-${baseColor === "black" ? "B" : "W"}-${String(n).padStart(4, "0")}`,
      title,
      price,
      baseColor,
      backPrintUrl: `/prints/print_${n}.svg`,
      category,
      variant: design.variant,
      // No ink colour here: every design is sold in both colourways (the app
      // shows the ink for the chosen tee).
      description: `${design.description}${knockout ? " Knocked out of a solid ink block." : ""}`,
      features,
    });
  }

  const familyIndex = assignFamilies(sigs);
  const catalog: ShirtProduct[] = shirts.map((s, i) => ({
    ...s,
    family: `fam-${String(familyIndex[i] + 1).padStart(4, "0")}`,
  }));

  // One object per line: diff-friendly but compact.
  writeFileSync(DATA_FILE, `[\n${catalog.map((s) => JSON.stringify(s)).join(",\n")}\n]\n`);

  const sizes = new Map<string, number>();
  for (const s of catalog) sizes.set(s.family, (sizes.get(s.family) ?? 0) + 1);
  const hist = new Map<number, number>();
  for (const n of sizes.values()) hist.set(n, (hist.get(n) ?? 0) + 1);
  const black = shirts.filter((s) => s.baseColor === "black").length;
  const titles = new Set(shirts.map((s) => s.title)).size;
  console.log(`Generated ${shirts.length} shirts → ${path.relative(ROOT, DATA_FILE)}`);
  console.log(`  prints: ${shirts.length} SVGs in ${path.relative(ROOT, PRINTS_DIR)} (${(bytes / 1024 / 1024).toFixed(2)} MB, avg ${(bytes / shirts.length / 1024).toFixed(1)} KB)`);
  console.log(`  colours: ${black} black / ${shirts.length - black} white · unique titles: ${titles}`);
  console.log(
    `  families: ${sizes.size} (sizes: ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join(", ")})`,
  );
  console.log(`  price range: $${Math.min(...shirts.map((s) => s.price))}–$${Math.max(...shirts.map((s) => s.price))}`);
}

main();
