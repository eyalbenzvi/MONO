/**
 * An upload's place in the taste space (brief 6.6): the 17 feature axes,
 * seven measured from the print, photographic from its class, the other
 * nine from the catalogue's mean for the category it lands in
 * (data/upload/priors.json, scripts/tools/uploadPriors.ts). Pure. This is
 * the seam where a learned model would plug in later: same inputs, same
 * FeatureVector out.
 *
 * The measures are simple and real, on the print as it lands (1 = ink,
 * 1500 × 2000) and its 300 × 400 check raster (about 1 mm a pixel):
 * - density: coverage scaled to the catalogue's 5th–95th percentile;
 * - contrast: 1 − the upload's midtone share before conversion;
 * - halftone_raster: 1 for Dots, else regularity: the strongest repeat in
 *   the print's autocorrelation (a stand-in for an FFT peak);
 * - line_art: the share of inked cells on an edge (thin lines are all
 *   edge, a filled shape mostly inside), less when line widths vary a lot;
 * - clean_minimal: empty space × (1 − edge complexity);
 * - geometric: straightness (the share of gradient strength in the two
 *   strongest of 18 orientations, a coarse stand-in for a Hough transform:
 *   ruled lines and grids pile up there, organic shapes spread out) with
 *   mirror symmetry, where circles and rosettes score;
 * - typography: 1 for words, else the ink share of letter-like marks
 *   (letter-sized and shaped components standing in rows).
 */
import { FEATURE_KEYS, type FeatureKey, type FeatureVector, type ShirtCategory } from "@/types/shirt";
import PRIORS from "@/data/upload/priors.json";
import { MM_PER_PX, OUT_H, OUT_W, type Converted } from "./convert";
import { checkRaster, type Measures } from "./measure";

export interface Priors {
  categories: Record<ShirtCategory, FeatureVector>;
  coverage: { p5: number; p95: number };
}

export interface UploadMeta {
  /** The catalogue's priors (default: data/upload/priors.json). */
  priors?: Priors;
}

/** The axes the print itself decides (the rest come from the category's catalogue mean). */
export const MEASURED: readonly FeatureKey[] = ["density", "contrast", "halftone_raster", "line_art", "clean_minimal", "geometric", "typography", "photographic"];

const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** The raster's cells counted as ink (the check's threshold), and those on an edge (a 4-neighbour not ink). */
function edges(r: { w: number; h: number; ink: Float32Array }) {
  let [on, edge, flips] = [0, 0, 0];
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < r.w && y < r.h && r.ink[y * r.w + x] > 0.35;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const v = at(x, y);
      if (x > 0 && v !== at(x - 1, y)) flips++;
      if (y > 0 && v !== at(x, y - 1)) flips++;
      if (!v) continue;
      on++;
      if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) edge++;
    }
  return { on, edge, flips };
}

/** The strongest repeat: the highest autocorrelation at a lag of 3–12 cells that is a peak among its neighbours (a 150 × 200 map, ~2 mm cells). */
export function regularity(r: { w: number; h: number; ink: Float32Array }): number {
  const [w, h] = [r.w >> 1, r.h >> 1];
  const m = new Float32Array(w * h);
  for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) m[(y >> 1) * w + (x >> 1)] += r.ink[y * r.w + x] / 4;
  let mean = 0;
  for (const v of m) mean += v;
  mean /= m.length;
  let vari = 0;
  for (let i = 0; i < m.length; i++) (m[i] -= mean), (vari += m[i] * m[i]);
  if (vari < 1e-9) return 0;
  const L = 12;
  const S = 2 * L + 1;
  const ac = new Float32Array(S * S);
  for (let dy = 0; dy <= L; dy++)
    for (let dx = -L; dx <= L; dx++) {
      let s = 0;
      for (let y = 0; y < h - dy; y++)
        for (let x = Math.max(0, -dx); x < Math.min(w, w - dx); x++) s += m[y * w + x] * m[(y + dy) * w + x + dx];
      ac[(dy + L) * S + dx + L] = ac[(L - dy) * S + L - dx] = s / vari;
    }
  let best = 0;
  for (let dy = -L + 1; dy < L; dy++)
    for (let dx = -L + 1; dx < L; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) continue;
      const v = ac[(dy + L) * S + dx + L];
      let peak = true;
      for (let j = -1; j <= 1 && peak; j++) for (let i = -1; i <= 1; i++) if ((i || j) && ac[(dy + j + L) * S + dx + i + L] > v) peak = false;
      if (peak && v > best) best = v;
    }
  return clamp(best);
}

/** Straightness and symmetry (see the header). */
export function geometry(r: { w: number; h: number; ink: Float32Array }): { straight: number; symmetry: number } {
  const bins = new Float64Array(18);
  let total = 0;
  const { w, h, ink } = r;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (ink[i] > 0.35) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      const gx = ink[i - w + 1] + 2 * ink[i + 1] + ink[i + w + 1] - ink[i - w - 1] - 2 * ink[i - 1] - ink[i + w - 1];
      const gy = ink[i + w - 1] + 2 * ink[i + w] + ink[i + w + 1] - ink[i - w - 1] - 2 * ink[i - w] - ink[i - w + 1];
      const m = Math.hypot(gx, gy);
      if (m < 0.1) continue;
      const a = (Math.atan2(gy, gx) + Math.PI) % Math.PI;
      bins[Math.min(17, Math.floor((a / Math.PI) * 18))] += m;
      total += m;
    }
  const top = [...bins].sort((a, b) => b - a);
  const straight = total ? clamp(((top[0] + top[1]) / total - 2 / 18) / (1 - 2 / 18)) : 0;
  if (x1 < 0) return { straight, symmetry: 0 };
  // Mirror agreement across the ink box's own middle, left–right and top–bottom (the better of the two): the share
  // of inked cells whose mirror image lands on ink or next to it (a cell's slack, so a thin line isn't lost to rounding).
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && ink[y * w + x] > 0.35;
  const near = (x: number, y: number) => on(x, y) || on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1);
  let [lr, ud, n] = [0, 0, 0];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!on(x, y)) continue;
      n++;
      if (near(x0 + x1 - x, y)) lr++;
      if (near(x, y0 + y1 - y)) ud++;
    }
  return { straight, symmetry: n ? Math.max(lr, ud) / n : 0 };
}

/**
 * The ink share of letter-like marks: connected components (8-neighbour,
 * on the print pooled 2 × 2) 2–30 mm tall, no wider than 1.5 × their
 * height, a quarter to three quarters filled, standing with at least two
 * others of a like height on a like line within three heights of them.
 */
export function textLike(ink: Uint8Array, w = OUT_W, h = OUT_H): number {
  const [pw, ph] = [w >> 1, h >> 1];
  const m = new Uint8Array(pw * ph);
  for (let y = 0; y < ph * 2; y++) for (let x = 0; x < pw * 2; x++) if (ink[y * w + x]) m[(y >> 1) * pw + (x >> 1)] = 1;
  const mm = MM_PER_PX * 2;
  const seen = new Uint8Array(m.length);
  const comps: { x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
  let total = 0;
  const stack: number[] = [];
  for (let s0 = 0; s0 < m.length; s0++) {
    if (!m[s0] || seen[s0]) continue;
    const c = { x0: pw, y0: ph, x1: -1, y1: -1, n: 0 };
    seen[s0] = 1;
    stack.push(s0);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % pw;
      const y = (p - x) / pw;
      c.n++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= pw || ny >= ph) continue;
          const q = ny * pw + nx;
          if (m[q] && !seen[q]) (seen[q] = 1), stack.push(q);
        }
    }
    total += c.n;
    const [cw, ch] = [c.x1 - c.x0 + 1, c.y1 - c.y0 + 1];
    const fill = c.n / (cw * ch);
    if (ch * mm >= 2 && ch * mm <= 30 && cw <= 1.5 * ch && fill >= 0.25 && fill <= 0.75) comps.push(c);
  }
  if (!total) return 0;
  let text = 0;
  for (const a of comps) {
    const ah = a.y1 - a.y0 + 1;
    const ay = (a.y0 + a.y1) / 2;
    let mates = 0;
    for (const b of comps) {
      if (a === b) continue;
      const bh = b.y1 - b.y0 + 1;
      const gap = Math.max(b.x0 - a.x1, a.x0 - b.x1);
      if (Math.abs(bh - ah) < 0.35 * ah && Math.abs((b.y0 + b.y1) / 2 - ay) < 0.3 * ah && gap < 3 * ah) mates++;
    }
    if (mates >= 2) text += a.n;
  }
  return text / total;
}

/** The measured axes (MEASURED), from the print as converted and its measures. */
export function measured(conv: Converted, m: Measures, priors: Priors = PRIORS as Priors): Partial<FeatureVector> {
  const r = checkRaster(conv.ink, conv.w, conv.h);
  const e = edges(r);
  const { straight, symmetry } = geometry(r);
  const spread = m.strokes ? (m.strokes.p95 - m.strokes.p5) / Math.max(1e-3, m.strokes.p50) : 1;
  const { p5, p95 } = priors.coverage;
  return {
    density: clamp((m.coverage - p5) / Math.max(1e-3, p95 - p5)),
    contrast: clamp(1 - conv.midtones),
    halftone_raster: conv.mode === "dots" ? 1 : regularity(r),
    line_art: conv.mode === "dots" ? clamp(0.3 * (e.on ? e.edge / e.on : 0)) : clamp(0.7 * (e.on ? e.edge / e.on : 0) + 0.3 * (1 - Math.min(1, spread / 2))),
    clean_minimal: clamp((1 - Math.min(1, m.coverage / 0.45)) * (1 - Math.min(1, e.flips / (r.w * r.h) / 0.15))),
    geometric: clamp(0.6 * straight + 0.4 * Math.max(0, (symmetry - 0.5) / 0.5)),
    typography: conv.cls === "words" ? 1 : clamp(textLike(conv.ink, conv.w, conv.h) * 1.2),
    photographic: conv.cls === "photo" ? 0.95 : 0,
  };
}

/** The shop category an upload lands in (brief 6.6). */
export function category(conv: Converted, f: Pick<FeatureVector, "typography" | "geometric">, m: Pick<Measures, "detail">): ShirtCategory {
  if (conv.cls === "photo") return "photographs";
  if (f.typography >= 0.5) return "type";
  if (f.geometric >= 0.6) return "systems";
  if (m.detail >= 0.5) return "etched";
  return "pattern";
}

/** The upload's full feature vector: the measured axes, the rest from its category's catalogue mean. */
export function features(conv: Converted, m: Measures, meta: UploadMeta = {}): FeatureVector {
  const priors = meta.priors ?? (PRIORS as Priors);
  const own = measured(conv, m, priors);
  const cat = category(conv, { typography: own.typography ?? 0, geometric: own.geometric ?? 0 }, m);
  const base = priors.categories[cat];
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, clamp(own[k] ?? base[k] ?? 0)])) as FeatureVector;
}
