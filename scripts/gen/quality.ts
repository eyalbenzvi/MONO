/**
 * Print quality and real size, measured by rendering each print small with
 * resvg (deterministic: fixed font files, fixed size).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { BaseColor, Medium } from "../../types/shirt";

/** measurePrint's old score under which a generated print is too faint to make at all (the fifth set's sparse constellations). */
export const FAINT = 35;
/**
 * Below this quality score (assessPrint, 0–100) a print is weak: never in
 * the taste test, the shop window, "picked for you" rows or the default
 * link preview. Calibrated so about the bottom tenth of the catalogue is weak.
 */
export const WEAK_QUALITY = 53;
/** Weak: a low score, or a flag (a sliver, a paper edge or vignette, a flat picture). */
export const isWeak = (s: { quality: number; flags: readonly string[] }) => s.quality < WEAK_QUALITY || s.flags.length > 0;
/** The printed area on the tee, cm (the 300×400 print; matches PRINT_SIZE_CM). */
const PRINT_CM = { width: 28, height: 37 };

// Fixed font files (the same on every run and on the CI runner's Ubuntu).
const FONT_FILES = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"]
  .flatMap((d) =>
    ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSansMono.ttf", "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSerif-Regular.ttf", "LiberationSerif-Italic.ttf", "LiberationSerif-Bold.ttf", "LiberationMono-Regular.ttf", "LiberationMono-Bold.ttf"].map((f) =>
      path.join(d, f),
    ),
  )
  .filter((f) => existsSync(f));

/**
 * Quality 0–100 from the print itself, rendered at 150 px wide: how much
 * ink it carries (coverage, 40%), how much of the print it spans (ink
 * bounding box, 30%) and how much is going on (edge transitions, 30%). A
 * lone small shape scores low. The bounding box also gives the print's real
 * size on the tee.
 */
export function measurePrint(svg: string, baseColor: BaseColor): { quality: number; printCm: { width: number; height: number }; ink: number } {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: 150 }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" } }).render();
  const px = img.pixels;
  const { width: w, height: h } = img;
  // Ink amount per pixel (the ground is black on black tees, white on white).
  const ink = (i: number) => (baseColor === "black" ? px[i * 4] / 255 : 1 - px[i * 4] / 255);
  let sum = 0;
  let edges = 0;
  let [minX, minY, maxX, maxY] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = ink(y * w + x);
      sum += a;
      const on = a > 0.2;
      if (on) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
      if (x > 0 && ink(y * w + x - 1) > 0.2 !== on) edges++;
      if (y > 0 && ink((y - 1) * w + x) > 0.2 !== on) edges++;
    }
  const bw = maxX < 0 ? 0 : (maxX - minX + 1) / w;
  const bh = maxY < 0 ? 0 : (maxY - minY + 1) / h;
  const cover = Math.min(1, sum / (w * h) / 0.2);
  const quality = Math.round(100 * (0.4 * cover + 0.3 * Math.sqrt(bw * bh) + 0.3 * Math.min(1, edges / 2500)));
  return { quality, printCm: { width: Math.max(1, Math.round(bw * PRINT_CM.width)), height: Math.max(1, Math.round(bh * PRINT_CM.height)) }, ink: sum / (w * h) };
}


/* ------------------------------------------------------------------ */
/* Ink masks and the solid-block check (content overhaul, Part 0)       */
/* ------------------------------------------------------------------ */

/** Ink per pixel (0–1) of a print as it lands on its tee: white ink on black, black on white — the same shape either way. */
export interface InkRaster {
  w: number;
  h: number;
  ink: Float32Array;
}

/** The check runs at the print's own size (300 × 400, about 1 mm a pixel on the tee). */
export const CHECK_W = 300;
export const CHECK_H = 400;

/** A drawn print's ink: the SVG rendered, its ground dropping out. */
export function svgInk(svg: string, baseColor: BaseColor, w = CHECK_W): InkRaster {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: w }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" } }).render();
  const px = img.pixels;
  const ink = new Float32Array(img.width * img.height);
  for (let i = 0; i < ink.length; i++) ink[i] = baseColor === "black" ? px[i * 4] / 255 : 1 - px[i * 4] / 255;
  return { w: img.width, h: img.height, ink };
}

/**
 * A WebP print's ink, from its RGBA pixels (any size): an ink print is black
 * ink whose alpha is its strength; a photograph lands on its tee as the
 * picture's lights (black tee) or darks (white tee), never inverted.
 */
export function rasterInk(rgba: Uint8Array | Buffer, w: number, h: number, medium: Medium, baseColor: BaseColor): InkRaster {
  const ink = new Float32Array(w * h);
  for (let i = 0; i < ink.length; i++) {
    const l = rgba[i * 4] / 255;
    const a = rgba[i * 4 + 3] / 255;
    ink[i] = medium === "ink" ? a * (1 - l) : baseColor === "black" ? l * a : a * (1 - l);
  }
  return { w, h, ink };
}

export interface BlockCheck {
  /** Why the print is refused (it prints as a slab of ink), or null. */
  reject: null | "block" | "panel" | "edges";
  /** Ink inside the ink's bounding box (0–1) and how much of that box's outline is ink. */
  boxFill: number;
  perimeter: number;
  /** The most panel-like connected ink region: its box's share of the print, outline ink, and solid (thick) ink in its box. */
  panel: { area: number; perimeter: number; solid: number };
  /** Share of each print edge (top, right, bottom, left) that is ink. */
  edges: [number, number, number, number];
}

/** Rule (a): ink fills over this share of its own bounding box… */
export const BLOCK_FILL = 0.45;
/** …and at least this share of that box's outline is ink (a rectangle-edged mass). */
export const BLOCK_PERIMETER = 0.8;
/** Rule (b): one connected ink region whose box covers over this share of the print… */
export const PANEL_AREA = 0.25;
/** …with its box's outline this much ink (axis-aligned, rectangle-edged)… */
export const PANEL_PERIMETER = 0.9;
/** …and this much solid ink in its box (ink at least 5 px, ~5 mm, thick): a filled panel, not a thin frame or line grid. */
export const PANEL_SOLID = 0.05;
/** Rule (c): all four print edges carry this much ink. */
export const EDGE_SOLID = 0.9;
/** A pixel counts as ink from this much (0–1). */
const ON = 0.35;

/**
 * Refuses a print that lands on the tee as a rectangle of ink — a slab
 * with the motif knocked out of it or sitting inside it, a filled panel, a
 * photograph or scan with its backdrop still on (content overhaul, Part 0).
 * Tuned on the whole catalogue: every knockout fails; open line art, line
 * grids in a thin frame, dotted halftones and cut-out pictures pass.
 */
export function solidBlock({ w, h, ink }: InkRaster): BlockCheck {
  const on = new Uint8Array(w * h);
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (ink[y * w + x] > ON) {
        on[y * w + x] = 1;
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
  const none: BlockCheck = { reject: null, boxFill: 0, perimeter: 0, panel: { area: 0, perimeter: 0, solid: 0 }, edges: [0, 0, 0, 0] };
  if (x1 < 0) return none;
  // Solid ink: the pixel and its whole 5×5 neighbourhood (scaled with size) are ink.
  const r = Math.max(1, Math.round((2 * w) / CHECK_W));
  const rows = new Uint16Array(w * h); // horizontal run of ink ending at each pixel
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows[y * w + x] = on[y * w + x] ? (x > 0 ? rows[y * w + x - 1] : 0) + 1 : 0;
  const solid = new Uint8Array(w * h);
  for (let y = r; y < h - r; y++)
    for (let x = r; x < w - r; x++) {
      let ok = 1;
      for (let dy = -r; dy <= r && ok; dy++) if (rows[(y + dy) * w + x + r] < 2 * r + 1) ok = 0;
      solid[y * w + x] = ok;
    }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  let inBox = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) inBox += on[y * w + x];
  const ring = (at: (x: number, y: number) => boolean, a: number, b: number, c: number, d: number) => {
    let n = 0;
    let k = 0;
    for (let x = a; x <= c; x++) (n += 2), (k += +at(x, b) + +at(x, d));
    for (let y = b + 1; y < d; y++) (n += 2), (k += +at(a, y) + +at(c, y));
    return k / n;
  };
  const perimeter = ring((x, y) => on[y * w + x] === 1, x0, y0, x1, y1);
  // Connected ink regions (4-neighbour) whose box covers over a tenth of the print.
  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  let panel = { area: 0, perimeter: 0, solid: 0 };
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!on[s0] || label[s0] >= 0) continue;
    let [cx0, cy0, cx1, cy1, sol] = [w, h, -1, -1, 0];
    label[s0] = s0;
    stack.push(s0);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      sol += solid[p];
      [cx0, cy0, cx1, cy1] = [Math.min(cx0, x), Math.min(cy0, y), Math.max(cx1, x), Math.max(cy1, y)];
      if (x > 0 && on[p - 1] && label[p - 1] < 0) (label[p - 1] = s0), stack.push(p - 1);
      if (x < w - 1 && on[p + 1] && label[p + 1] < 0) (label[p + 1] = s0), stack.push(p + 1);
      if (y > 0 && on[p - w] && label[p - w] < 0) (label[p - w] = s0), stack.push(p - w);
      if (y < h - 1 && on[p + w] && label[p + w] < 0) (label[p + w] = s0), stack.push(p + w);
    }
    const box = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
    if (box / (w * h) < 0.1) continue;
    const c = { area: box / (w * h), perimeter: ring((x, y) => label[y * w + x] === s0, cx0, cy0, cx1, cy1), solid: sol / box };
    if (c.area * c.perimeter * c.solid > panel.area * panel.perimeter * panel.solid || !panel.area) panel = c;
  }
  const share = (n: number, f: (k: number) => number) => {
    let k = 0;
    for (let i = 0; i < n; i++) k += f(i);
    return k / n;
  };
  const edges: BlockCheck["edges"] = [share(w, (x) => on[x]), share(h, (y) => on[y * w + w - 1]), share(w, (x) => on[(h - 1) * w + x]), share(h, (y) => on[y * w])];
  const boxFill = inBox / (bw * bh);
  const reject =
    boxFill > BLOCK_FILL && perimeter >= BLOCK_PERIMETER
      ? "block"
      : panel.area > PANEL_AREA && panel.perimeter >= PANEL_PERIMETER && panel.solid >= PANEL_SOLID
        ? "panel"
        : edges.every((e) => e >= EDGE_SOLID)
          ? "edges"
          : null;
  return { reject, boxFill, perimeter, panel, edges };
}

/* ------------------------------------------------------------------ */
/* Quality score (content overhaul, Part 6)                             */
/* ------------------------------------------------------------------ */

export interface Assessment {
  /** 0–100: how well the print carries on a tee (see assessPrint). */
  quality: number;
  /** The ink's real size on the tee, cm (its bounding box on the 28 × 37 cm area). */
  printCm: { width: number; height: number };
  /** Mean ink over the print area (0–1). */
  ink: number;
  /** The ink's bounding box as a share of the print area. */
  extent: number;
  /** What's wrong with it: a sliver of a picture, a paper edge or vignette, a flat snapshot. */
  flags: ("sliver" | "vignette" | "flat")[];
}

/** Below this share of the print area, the picture is a sliver on the tee. */
/** A sliver: the ink's box under this share of the print's width or height (a strip across the chest). */
export const SLIVER = 0.3;

/**
 * Quality 0–100 for any print — drawn, ink or halftone photograph — from
 * its ink as it lands on the tee:
 * - coverage (35%): too sparse or too solid both lose;
 * - extent (25%): how much of the print area the ink's box spans;
 * - detail (40%): how much the ink density changes from place to place,
 *   measured on a coarse density map (so a dot screen reads by the picture
 *   it makes, not by its dots).
 * Flags: a sliver (box under SLIVER of the width or height), a vignette or paper edge
 * (ink crowding the box's outline around an empty middle), a flat picture
 * (almost no change in density: a dim interior snapshot).
 */
export function assessPrint({ w, h, ink }: InkRaster): Assessment {
  let sum = 0;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = ink[y * w + x];
      sum += a;
      if (a > ON) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  const cover = sum / (w * h);
  const bw = x1 < 0 ? 0 : (x1 - x0 + 1) / w;
  const bh = y1 < 0 ? 0 : (y1 - y0 + 1) / h;
  const extent = bw * bh;
  // Coarse density map: 4 × 4 px cells (~4 mm on the tee).
  const C = 4;
  const cw = Math.floor(w / C);
  const ch = Math.floor(h / C);
  const dens = new Float32Array(cw * ch);
  for (let y = 0; y < ch * C; y++) for (let x = 0; x < cw * C; x++) dens[Math.floor(y / C) * cw + Math.floor(x / C)] += ink[y * w + x] / (C * C);
  let grad = 0;
  for (let y = 0; y < ch - 1; y++)
    for (let x = 0; x < cw - 1; x++) {
      const d = dens[y * cw + x];
      grad += Math.abs(dens[y * cw + x + 1] - d) + Math.abs(dens[(y + 1) * cw + x] - d);
    }
  // Change per cell of the ink's own box (not the print): a small dense print isn't penalised twice.
  const boxCells = Math.max(1, extent * cw * ch);
  const detail = grad / boxCells;
  // Sparse line work (a star chart, a diagram) is full marks from 4% ink; a print mostly ink loses them.
  const coverScore = cover < 0.04 ? cover / 0.04 : cover <= 0.32 ? 1 : Math.max(0.2, 1 - (cover - 0.32) / 0.4);
  const extentScore = Math.min(1, Math.sqrt(extent) / 0.72);
  const detailScore = Math.min(1, detail / 0.35);
  const quality = Math.round(100 * (0.35 * coverScore + 0.25 * extentScore + 0.4 * detailScore));
  // Vignette / paper edge: the outer ring of the box carries far more ink than its middle.
  const flags: Assessment["flags"] = [];
  if (x1 >= 0 && Math.min(bw, bh) < SLIVER) flags.push("sliver");
  if (x1 >= 0) {
    const ring = Math.max(2, Math.round(Math.min(x1 - x0, y1 - y0) * 0.06));
    let [rin, rn, min, mn] = [0, 0, 0, 0];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const edge = x - x0 < ring || x1 - x < ring || y - y0 < ring || y1 - y < ring;
        if (edge) (rin += ink[y * w + x]), rn++;
        else (min += ink[y * w + x]), mn++;
      }
    if (rn && mn && rin / rn > 0.25 && rin / rn > 3 * (min / mn)) flags.push("vignette");
  }
  if (detail < 0.06 && cover > 0.02) flags.push("flat");
  return {
    quality,
    printCm: { width: Math.max(1, Math.round(bw * PRINT_CM.width)), height: Math.max(1, Math.round(bh * PRINT_CM.height)) },
    ink: cover,
    extent,
    flags,
  };
}

/** Share of a raster's inked pixels that are neither ink nor ground (must be 0 for a one-ink print). */
export function midtones({ ink }: InkRaster): number {
  let on = 0;
  let mid = 0;
  for (let i = 0; i < ink.length; i++) {
    if (ink[i] > 0.02) on++;
    if (ink[i] > 0.02 && ink[i] < 0.98) mid++;
  }
  return on ? mid / on : 0;
}
