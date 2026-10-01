/**
 * An upload's print, measured on the final 1500 × 2000 raster (1 px ≈
 * 0.187 mm at Full and Small alike), and its tier (brief 6.4): refused,
 * printed for the customer, or good enough to offer to the catalogue.
 * Pure. The quality score is the catalogue's own (lib/custom/quality), read
 * the way the catalogue reads a raster print: on the print averaged down to
 * 300 × 400 (about 1 mm a pixel).
 */
import { assessPrint, CHECK_H, CHECK_W, densityDetail, type Assessment, type InkRaster } from "@/lib/custom/quality";
import { MM_PER_PX, type PrintSize, type Tee } from "./convert";
import { REASONS, strokeReason, gapReason } from "./reasons";

export interface Measures {
  /** assessPrint's score, 0–100. */
  quality: number;
  /** Ink as a share of the print area. */
  coverage: number;
  /** assessPrint's detail: how much the ink's density changes across its box (before scoring). */
  detail: number;
  flags: Assessment["flags"];
  /** The thinnest line and the narrowest gap between ink (5th percentiles, mm), or null when not measured (a dot screen, or nothing to measure). */
  minStrokeMm: number | null;
  minGapMm: number | null;
  /** Line widths along the skeleton, mm: 5th, 50th and 95th percentiles (null as above). */
  strokes: { p5: number; p50: number; p95: number } | null;
  /** A photograph's dots: their size is the screen's, not the upload's, so stroke and gap aren't judged. */
  screened: boolean;
  size: PrintSize;
}

/** The print averaged down to the check's 300 × 400 (5 × 5 px blocks), as the catalogue scores a raster print. */
export function checkRaster(ink: Uint8Array, w: number, h: number): InkRaster {
  const [cw, ch] = [CHECK_W, CHECK_H];
  const out = new Float32Array(cw * ch);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(ch - 1, Math.floor((y * ch) / h));
    for (let x = 0; x < w; x++) if (ink[y * w + x]) out[cy * cw + Math.min(cw - 1, Math.floor((x * cw) / w))]++;
  }
  const k = (cw * ch) / (w * h);
  for (let i = 0; i < out.length; i++) out[i] *= k;
  return { w: cw, h: ch, ink: out };
}

/**
 * assessPrint's detail term before it's scored (lib/custom/quality keeps
 * it inside the score): the change in ink density between neighbouring
 * 4 × 4 cells, per cell of the ink's own box (lib/custom/quality
 * densityDetail, the same code); the tests check the score rebuilt from it
 * matches assessPrint's.
 */
export function detailOf({ w, h, ink }: InkRaster): number {
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (ink[y * w + x] > 0.35) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const extent = x1 < 0 ? 0 : ((x1 - x0 + 1) / w) * ((y1 - y0 + 1) / h);
  return densityDetail(ink, w, h, extent);
}

/* ------------------------------------------------------------------ */
/* Line width and gap: distance transform along the skeleton             */
/* ------------------------------------------------------------------ */

const INF = 1e20;

/** Felzenszwalb–Huttenlocher's exact squared distance transform in one dimension (lower envelope of parabolas). */
function dt1(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Exact Euclidean distance from every pixel to the nearest target pixel (w × h), columns then rows. */
export function edt(target: Uint8Array, w: number, h: number): Float32Array {
  const n = Math.max(w, h);
  const [f, d, z] = [new Float64Array(n), new Float64Array(n), new Float64Array(n + 1)];
  const v = new Int32Array(n);
  const sq = new Float64Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = target[y * w + x] ? 0 : INF;
    dt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) sq[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = sq[y * w + x];
    dt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** Ridge points deeper than this (px from their edge, lines over about 3 mm) are far above every threshold: counted at their own depth, without the disc stamping or the spur check. */
const DEEP = 8;
/** A ridge point this much shallower than the deepest point near it is a corner's spur, not a line. */
const SPUR = 0.6;

/**
 * Local widths (px) along the skeleton of the set pixels (1 = in the set)
 * inside the box, from the exact distance transform D (to the nearest
 * pixel outside the set):
 * 1. Ridge: a pixel at least as deep as both its neighbours across one of
 *    four directions, D bending down there.
 * 2. Its half-width P: the ridge's height read to the sub-pixel by fitting
 *    D's tent across that direction (a line of even width peaks between
 *    two pixels), the lowest over the directions it's a ridge in (an axis
 *    cuts a diagonal line long).
 * 3. Local thickness: every ridge point stamps P on the disc it's the
 *    centre of, keeping the largest, so a stray ridge point on a digital
 *    line's staircase takes the width of the line it sits in.
 * 4. Spurs (the ridge running into a square corner, where D shrinks to
 *    nothing) are dropped: a ridge point under SPUR of the deepest point
 *    within its depth + 2 px. A tapering tip goes with them; a print loses
 *    its last fraction of a millimetre there anyway.
 * The width is 2T − ½: D runs between pixel centres, so 2T − 1 is the
 * whole pixels the line covers across, and a line W px wide covers ⌊W⌋ or
 * ⌈W⌉ of them depending on where it falls on the grid, so its thinnest
 * stretches (the low percentiles) are ⌊W⌋ and W is best read as ⌊W⌋ + ½.
 * A line lying exactly along the grid reads up to half a pixel (0.09 mm)
 * wide.
 */
export function widths(set: Uint8Array, w: number, h: number, box: { x: number; y: number; w: number; h: number }, open = false): Float32Array {
  // The box and a one-pixel margin: outside the set for ink (so the transform of the crop is exact), inside it for
  // the ground (open space: every ink pixel is in the box, so distances to the ink are exact too, and the ground
  // between the ink and the box's edge never reads as a gap).
  const [cw, ch] = [box.w + 2, box.h + 2];
  const s = new Uint8Array(cw * ch);
  const out = new Uint8Array(cw * ch);
  for (let y = 0; y < box.h; y++)
    for (let x = 0; x < box.w; x++) {
      const v = set[(box.y + y) * w + box.x + x];
      s[(y + 1) * cw + x + 1] = v;
      out[(y + 1) * cw + x + 1] = 1 - v;
    }
  const m = open ? 0 : 1;
  for (let x = 0; x < cw; x++) (out[x] = m), (out[(ch - 1) * cw + x] = m), (s[x] = 1 - m), (s[(ch - 1) * cw + x] = 1 - m);
  for (let y = 0; y < ch; y++) (out[y * cw] = m), (out[y * cw + cw - 1] = m), (s[y * cw] = 1 - m), (s[y * cw + cw - 1] = 1 - m);
  const D = edt(out, cw, ch);
  const dirs = [1, cw, cw + 1, cw - 1];
  const steps = [1, 1, Math.SQRT2, Math.SQRT2];
  const ridge: number[] = [];
  const res: number[] = [];
  const T = new Float32Array(cw * ch);
  for (let y = 1; y < ch - 1; y++)
    for (let x = 1; x < cw - 1; x++) {
      const p = y * cw + x;
      const d = D[p];
      if (!s[p]) continue;
      // A ridge across some direction (D bends down there and no neighbour across is deeper); the half-width is
      // the lowest tent peak over those directions (along a diagonal line the axes cut it long).
      let P = Infinity;
      for (let q = 0; q < 4; q++) {
        const a = D[p - dirs[q]], c = D[p + dirs[q]];
        if (d < a || d < c || 2 * d - a - c <= 0) continue;
        const k = (d - Math.min(a, c)) / steps[q];
        P = Math.min(P, d + 0.5, d + (Math.max(a, c) - d + k * steps[q]) / 2);
      }
      if (P === Infinity) continue;
      if (d > DEEP) {
        res.push(2 * P - 0.5);
        continue;
      }
      ridge.push(p);
      const r = Math.floor(d);
      for (let yy = Math.max(0, y - r); yy <= Math.min(ch - 1, y + r); yy++)
        for (let xx = Math.max(0, x - r); xx <= Math.min(cw - 1, x + r); xx++) {
          const q = yy * cw + xx;
          if ((xx - x) ** 2 + (yy - y) ** 2 < d * d && T[q] < P) T[q] = P;
        }
    }
  for (const p of ridge) {
    const d = D[p];
    const [x, y] = [p % cw, Math.floor(p / cw)];
    const r = Math.ceil(d) + 2;
    let deep = 0;
    for (let yy = Math.max(0, y - r); yy <= Math.min(ch - 1, y + r); yy++)
      for (let xx = Math.max(0, x - r); xx <= Math.min(cw - 1, x + r); xx++) if (s[yy * cw + xx] && D[yy * cw + xx] > deep) deep = D[yy * cw + xx];
    if (d >= SPUR * deep) res.push(2 * T[p] - 0.5);
  }
  return Float32Array.from(res);
}

function quantile(v: Float32Array, q: number): number {
  const s = Float32Array.from(v).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

/** The ink's box, or null. */
function inkBox(ink: Uint8Array, w: number, h: number) {
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (ink[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Every measure of a print for a tee. Stroke width: the 5th percentile of
 * the skeleton's widths (widths); the reversed gap: the same over the
 * ground between the ink, inside the ink's box.
 */
export function measure(ink: Uint8Array, w: number, h: number, tee: Tee, opts: { screened?: boolean; size?: PrintSize; shapes?: Uint8Array } = {}): Measures {
  void tee; // the ink is the same shapes on either tee; the tee only moves the thresholds (tier)
  const screened = !!opts.screened;
  const raster = checkRaster(ink, w, h);
  const a = assessPrint(raster);
  let count = 0;
  for (let i = 0; i < ink.length; i++) count += ink[i];
  let [minStrokeMm, minGapMm, strokes] = [null as number | null, null as number | null, null as Measures["strokes"]];
  // Strokes and gaps: of the shapes as drawn (line work whose solid areas print as a mesh: the mesh's holes aren't gaps).
  const shapes = opts.shapes ?? ink;
  const box = inkBox(shapes, w, h);
  if (!screened && box) {
    const sw = widths(shapes, w, h, box);
    if (sw.length) {
      strokes = { p5: quantile(sw, 0.05) * MM_PER_PX, p50: quantile(sw, 0.5) * MM_PER_PX, p95: quantile(sw, 0.95) * MM_PER_PX };
      minStrokeMm = strokes.p5;
    }
    const ground = new Uint8Array(ink.length);
    for (let i = 0; i < ink.length; i++) ground[i] = 1 - shapes[i];
    const gw = widths(ground, w, h, box, true);
    if (gw.length) minGapMm = quantile(gw, 0.05) * MM_PER_PX;
  }
  return { quality: a.quality, coverage: count / ink.length, detail: detailOf(raster), flags: a.flags, minStrokeMm, minGapMm, strokes, screened, size: opts.size ?? "full" };
}

/* ------------------------------------------------------------------ */
/* Tiers (brief 6.4)                                                    */
/* ------------------------------------------------------------------ */

/** The table, per check: refused under the first number, offered to the catalogue from the second. */
export const BAR = {
  quality: [53, 68],
  /** Ink coverage: refused outside the first range, catalogue inside the second. */
  coverage: { print: [0.01, 0.45], catalogue: [0.04, 0.32] },
  detail: [0.06, 0.35],
  /** The thinnest line, mm: black ink on a white tee, white ink on a black tee (white ink spreads less, so it needs more). */
  stroke: { white: [0.4, 0.6], black: [0.5, 0.7] },
  gap: [0.6, 0.8],
  /**
   * dHash near a catalogue design: at most this Hamming distance, the print
   * passes a person first (near), who can refuse a copy. Never refused on the
   * hash alone: a sparse or wide print (a photograph's lines, a line of text,
   * a panorama padded to 3:4) hashes within 0–4 of designs it's nothing like.
   */
  nearDuplicate: 6,
} as const;
/** Within this share of a threshold it passed, a check is near (the simulated review's "person" stage). */
export const NEAR = 0.1;

export type Tier = "refuse" | "print" | "catalogue";

/**
 * The tier for a tee, from the table exactly: any refusal refuses (the
 * first in the table's order gives the reason), all catalogue bars passed
 * is the catalogue, otherwise it prints. near: a measure within 10% of a
 * refusal threshold it passed.
 */
export function tier(m: Measures, tee: Tee, dupDistance?: number): { tier: Tier; reason?: string; near: boolean } {
  const judged = !m.screened;
  const [lo, hi] = BAR.coverage.print;
  const minStroke = BAR.stroke[tee][0];
  let near = m.quality < BAR.quality[0] * (1 + NEAR) || m.coverage < lo * (1 + NEAR) || m.coverage > hi * (1 - NEAR) || m.detail < BAR.detail[0] * (1 + NEAR);
  if (judged && m.minStrokeMm !== null) near ||= m.minStrokeMm < minStroke * (1 + NEAR);
  if (judged && m.minGapMm !== null) near ||= m.minGapMm < BAR.gap[0] * (1 + NEAR);
  if (dupDistance !== undefined) near ||= dupDistance <= BAR.nearDuplicate;
  const refuse = (reason: string) => ({ tier: "refuse" as const, reason, near });
  if (m.coverage < lo) return refuse(REASONS.faint);
  if (m.coverage > hi) return refuse(m.screened ? REASONS.denseDots : REASONS.dense);
  if (m.detail < BAR.detail[0]) return refuse(REASONS.plain);
  if (m.quality < BAR.quality[0]) return refuse(REASONS.weak);
  if (judged && m.minStrokeMm !== null && m.minStrokeMm < minStroke) return refuse(strokeReason(minStroke));
  if (judged && m.minGapMm !== null && m.minGapMm < BAR.gap[0]) return refuse(gapReason(BAR.gap[0]));
  // A copy of a catalogue design: judged only on a print that would otherwise print (an empty or faint picture matches anything sparse).
  const [clo, chi] = BAR.coverage.catalogue;
  const catalogue =
    m.quality >= BAR.quality[1] &&
    m.coverage >= clo &&
    m.coverage <= chi &&
    m.detail >= BAR.detail[1] &&
    (!judged || m.minStrokeMm === null || m.minStrokeMm >= BAR.stroke[tee][1]) &&
    (!judged || m.minGapMm === null || m.minGapMm >= BAR.gap[1]);
  return { tier: catalogue ? "catalogue" : "print", near };
}

/* ------------------------------------------------------------------ */
/* Near-duplicates: the catalogue's dHash (scripts/tools/searchIndex)    */
/* ------------------------------------------------------------------ */

/**
 * Difference hash, the catalogue's own (scripts/tools/searchIndex dHash,
 * whose hashes lib/search's index carries): the ink averaged over a 9 × 8
 * grid, each cell denser than its right neighbour or not, 16 hex. Cell
 * averages don't depend on the raster's size, so the 1500 × 2000 print
 * hashes as the catalogue's prints do at 150 px.
 */
export function dhash(ink: ArrayLike<number>, w: number, h: number): string {
  const cells = new Float64Array(9 * 8);
  for (let cy = 0; cy < 8; cy++)
    for (let cx = 0; cx < 9; cx++) {
      const [x0, x1, y0, y1] = [Math.floor((cx * w) / 9), Math.max(Math.floor((cx * w) / 9) + 1, Math.floor(((cx + 1) * w) / 9)), Math.floor((cy * h) / 8), Math.max(Math.floor((cy * h) / 8) + 1, Math.floor(((cy + 1) * h) / 8))];
      let s = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += ink[y * w + x];
      cells[cy * 9 + cx] = s / ((x1 - x0) * (y1 - y0));
    }
  let hex = "";
  for (let cy = 0; cy < 8; cy++) {
    let byte = 0;
    for (let cx = 0; cx < 8; cx++) byte = (byte << 1) | (cells[cy * 9 + cx] > cells[cy * 9 + cx + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function popcount(x: number) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/**
 * The Hamming distance from a hash to the nearest catalogue design. The
 * hashes are lib/search's index (SearchIndex.hash: two 32-bit halves per
 * design), passed in so the page can load the index lazily; 64 when there
 * are none.
 */
/**
 * The hash an upload is compared with the catalogue by: the ink's own box,
 * widened (centred) or deepened (from its top) to the catalogue's 3 : 4 and
 * hashed as a print laid out the catalogue's way (top-aligned, centred). A
 * Small print is then its design, not a mostly empty sheet, which would
 * match every sparse catalogue print.
 */
export function designHash(ink: Uint8Array, w: number, h: number): string {
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (ink[y * w + x]) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  if (x1 < 0) return dhash(ink, w, h);
  let [bw, bh] = [x1 - x0 + 1, y1 - y0 + 1];
  if (bw * 4 < bh * 3) {
    const nw = Math.ceil((bh * 3) / 4);
    x0 -= Math.floor((nw - bw) / 2);
    bw = nw;
  } else bh = Math.ceil((bw * 4) / 3);
  const crop = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const [sx, sy] = [x0 + x, y0 + y];
      if (sx >= 0 && sx < w && sy < h) crop[y * bw + x] = ink[sy * w + sx];
    }
  return dhash(crop, bw, bh);
}

/** The nearest catalogue design: its position in the hashes (the catalogue's order) and the distance. */
export function nearestIndex(hash: string, hashes: Uint32Array): { index: number; distance: number } {
  const [a, b] = [parseInt(hash.slice(0, 8), 16), parseInt(hash.slice(8, 16), 16)];
  let best = { index: -1, distance: 64 };
  for (let i = 0; i + 1 < hashes.length; i += 2) {
    const d = popcount((a ^ hashes[i]) >>> 0) + popcount((b ^ hashes[i + 1]) >>> 0);
    if (d < best.distance) best = { index: i / 2, distance: d };
  }
  return best;
}

export function nearestCatalogue(hash: string, hashes: Uint32Array): number {
  const [a, b] = [parseInt(hash.slice(0, 8), 16), parseInt(hash.slice(8, 16), 16)];
  let best = 64;
  for (let i = 0; i + 1 < hashes.length; i += 2) best = Math.min(best, popcount((a ^ hashes[i]) >>> 0) + popcount((b ^ hashes[i + 1]) >>> 0));
  return best;
}
