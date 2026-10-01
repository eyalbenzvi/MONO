/**
 * The prints' ink analysis, pure (the generator, the audit and the browser's
 * personalised prints judge a print by the same numbers): the solid-block
 * check and the quality score, both on an InkRaster. Rasterising a print
 * happens elsewhere: resvg in scripts/gen/quality.ts, a canvas in the browser.
 */
import type { BaseColor, Medium } from "../../types/shirt";

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
  reject: null | "block" | "panel" | "edges" | "slab";
  /** Ink inside the ink's bounding box (0–1) and how much of that box's outline is ink. */
  boxFill: number;
  perimeter: number;
  /** The most panel-like connected ink region: its box's share of the print, outline ink, and solid (thick) ink in its box. */
  panel: { area: number; perimeter: number; solid: number };
  /** Share of each print edge (top, right, bottom, left) that is ink. */
  edges: [number, number, number, number];
  /** Solid ink (a pixel whose whole neighbourhood, ~4 mm across, is ink) as a share of the print. */
  solid: number;
  /** The largest connected patch of solid ink, as a share of the print. */
  slab: number;
  /** The largest connected dense area (rule f), as a share of the print. */
  mass: number;
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
/** Rule (d): solid ink covers this share of the print, whatever its outline (towers with windows, a dark mass)… */
export const SLAB_SOLID = 0.1;
/** …or one connected patch of it does (a filled bar among outlines); bold letters and small filled cells stay far below. */
export const SLAB_REGION = 0.03;
/**
 * Rule (f), a dense area: ink averaged over a window MASS_MM across (the box with the variance of oneink.py's
 * Gaussian of σ 3 mm, so the two agree) (mesh and dots included) above
 * MASS_DENSE, in one connected piece larger than MASS_AREA of the print. It lands on the tee as a slab of light
 * (or dark) though no part of it is solid: a pale sky printed in white ink on a black tee, an oval of mesh round a
 * scene (Design Guidelines, section 04: "Dense areas"; the studio's oneink.py uses the same rule).
 */
export const MASS_MM = 10;
export const MASS_DENSE = 0.55;
export const MASS_AREA = 0.15;
/**
 * A new design with a dense area (rule f) is held back: the studio's prints, the content waves' candidates and an
 * upload offered to the catalogue. Not a refusal of the catalogue already on sale (84 of its prints, mostly dark
 * archive etchings, have one; whether they stay is the owner's call) nor of an upload printed for its owner.
 */
export const denseArea = (c: Pick<BlockCheck, "mass">) => c.mass > MASS_AREA;
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
        // Plain comparisons: this runs for every ink pixel (a destructured array here was a new array each time).
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const none: BlockCheck = { reject: null, boxFill: 0, perimeter: 0, panel: { area: 0, perimeter: 0, solid: 0 }, edges: [0, 0, 0, 0], solid: 0, slab: 0, mass: 0 };
  if (x1 < 0) return none;
  // Solid ink: the pixel and its whole 5×5 neighbourhood at the check's size (scaled with size: at a raster print's own
  // size the window is wider than a halftone cell, so a mesh of dots is never solid) are ink. Summed-area table: O(1) a pixel.
  const r = Math.max(1, Math.round((2 * w) / CHECK_W));
  const W1 = w + 1;
  const sat = new Uint32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) (row += on[y * w + x]), (sat[(y + 1) * W1 + x + 1] = sat[y * W1 + x + 1] + row);
  }
  const full = (2 * r + 1) ** 2;
  const solid = new Uint8Array(w * h);
  let solidCount = 0;
  for (let y = r; y < h - r; y++)
    for (let x = r; x < w - r; x++) {
      const [a, b] = [(y - r) * W1 + x - r, (y + r + 1) * W1 + x - r];
      if (sat[b + 2 * r + 1] - sat[b] - sat[a + 2 * r + 1] + sat[a] === full) (solid[y * w + x] = 1), solidCount++;
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
  const solidShare = solidCount / (w * h);
  // The largest connected patch of solid ink (4-neighbour).
  let slab = 0;
  if (solidCount) {
    const seen = new Uint8Array(w * h);
    const q: number[] = [];
    for (let s0 = 0; s0 < w * h; s0++) {
      if (!solid[s0] || seen[s0]) continue;
      let n = 0;
      seen[s0] = 1;
      q.push(s0);
      while (q.length) {
        const p = q.pop()!;
        n++;
        const x = p % w;
        if (x > 0 && solid[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), q.push(p - 1);
        if (x < w - 1 && solid[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), q.push(p + 1);
        if (p >= w && solid[p - w] && !seen[p - w]) (seen[p - w] = 1), q.push(p - w);
        if (p < w * (h - 1) && solid[p + w] && !seen[p + w]) (seen[p + w] = 1), q.push(p + w);
      }
      slab = Math.max(slab, n / (w * h));
    }
  }
  // Rule (f): dense areas, on a grid of about 1 mm (the raster spans the 28 cm print area), each cell the ink's mean
  // over a window MASS_MM across (the summed-area table), then the largest connected dense piece (4-neighbour).
  const pxMm = w / (PRINT_CM.width * 10);
  const step = Math.max(1, Math.round(pxMm));
  const half = Math.max(1, Math.round((MASS_MM / 2) * pxMm));
  const gw = Math.ceil(w / step);
  const gh = Math.ceil(h / step);
  const dense = new Uint8Array(gw * gh);
  // The ink's own strength (a downsampled mesh is grey, not on or off), summed.
  const isat = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) (row += ink[y * w + x]), (isat[(y + 1) * W1 + x + 1] = isat[y * W1 + x + 1] + row);
  }
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const [cx, cy] = [Math.min(w - 1, gx * step), Math.min(h - 1, gy * step)];
      const [ax, ay, bx, by] = [Math.max(0, cx - half), Math.max(0, cy - half), Math.min(w, cx + half + 1), Math.min(h, cy + half + 1)];
      const sum = isat[by * W1 + bx] - isat[ay * W1 + bx] - isat[by * W1 + ax] + isat[ay * W1 + ax];
      if (sum > MASS_DENSE * (bx - ax) * (by - ay)) dense[gy * gw + gx] = 1;
    }
  let mass = 0;
  {
    const seen = new Uint8Array(gw * gh);
    const q: number[] = [];
    for (let s0 = 0; s0 < gw * gh; s0++) {
      if (!dense[s0] || seen[s0]) continue;
      let n = 0;
      seen[s0] = 1;
      q.push(s0);
      while (q.length) {
        const p = q.pop()!;
        n++;
        const x = p % gw;
        if (x > 0 && dense[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), q.push(p - 1);
        if (x < gw - 1 && dense[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), q.push(p + 1);
        if (p >= gw && dense[p - gw] && !seen[p - gw]) (seen[p - gw] = 1), q.push(p - gw);
        if (p < gw * (gh - 1) && dense[p + gw] && !seen[p + gw]) (seen[p + gw] = 1), q.push(p + gw);
      }
      mass = Math.max(mass, n / (gw * gh));
    }
  }
  const reject =
    boxFill > BLOCK_FILL && perimeter >= BLOCK_PERIMETER
      ? "block"
      : panel.area > PANEL_AREA && panel.perimeter >= PANEL_PERIMETER && panel.solid >= PANEL_SOLID
        ? "panel"
        : edges.every((e) => e >= EDGE_SOLID)
          ? "edges"
          : solidShare >= SLAB_SOLID || slab >= SLAB_REGION
            ? "slab"
            : null;
  return { reject, boxFill, perimeter, panel, edges, solid: solidShare, slab, mass };
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
/**
 * Detail: how much the ink's density changes across a coarse map (4 × 4 px
 * cells, ~4 mm on the tee), per cell of the ink's own box (`extent`, its
 * share of the print), so a small dense print isn't penalised twice. Shared
 * with the upload checks (lib/upload/measure detailOf).
 */
export function densityDetail(ink: ArrayLike<number>, w: number, h: number, extent: number): number {
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
  return grad / Math.max(1, extent * cw * ch);
}

export function assessPrint({ w, h, ink }: InkRaster): Assessment {
  let sum = 0;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = ink[y * w + x];
      sum += a;
      if (a > ON) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const cover = sum / (w * h);
  const bw = x1 < 0 ? 0 : (x1 - x0 + 1) / w;
  const bh = y1 < 0 ? 0 : (y1 - y0 + 1) / h;
  const extent = bw * bh;
  const detail = densityDetail(ink, w, h, extent);
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
