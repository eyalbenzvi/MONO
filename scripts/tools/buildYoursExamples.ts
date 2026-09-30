/**
 * "From yours" examples, made honestly: the real converter (lib/upload
 * convert, measure, teeRule) run on two inputs a customer could bring, the
 * outputs written as they come out, never retouched.
 * - A photograph: Miniature Mediterranean Donkey, Smithsonian's National Zoo
 *   (nzp_NZP-20050528-363AB, Smithsonian Open Access, CC0), the master
 *   assets/masters/print_2882.webp (not a catalogue design). Taken out of the
 *   master's print layout (its transparent margin) and enlarged to a 1100 px
 *   short side, so it passes the Full size gate as a customer's file must.
 * - A drawing: an olive sprig in pen, drawn here (seeded strokes), on a
 *   sketchbook page photographed on a table: warm paper, a shadow across a
 *   corner, grain, ink that isn't quite black.
 * Every input passes what a customer's would have to: the size gate, the
 * quality bar, and no near-duplicate of a catalogue design (the dHash index).
 *
 * They are the converter's regression check (the page no longer shows them:
 * its empty stage is the tee with the print area marked). Writes
 * data/upload/examples.json (mode, tee, quality, the ink's hash, the credit);
 * tests/upload/examples.test.ts regenerates and compares.
 *
 *   npx tsx scripts/tools/buildYoursExamples.ts
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { convert, inkFor, type Converted, type Pixels, type Tee } from "../../lib/upload/convert";
import { designHash, measure, nearestCatalogue, type Measures } from "../../lib/upload/measure";
import { chooseTee } from "../../lib/upload/teeRule";
import { mulberry32 } from "../gen/core";

const ROOT = path.join(__dirname, "..", "..");

export interface Example {
  kind: "photo" | "drawing";
  mode: string;
  tee: Tee;
  quality: number;
  hash: string;
  credit?: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Input {
  kind: Example["kind"];
  /** What the converter is given. */
  pixels: Pixels;
  /** The picture as given, and the subject's box in it (null: the whole picture). */
  before: Buffer;
  box: Box | null;
  credit?: string;
}

/* ------------------------------------------------------------------ */
/* The photograph                                                       */
/* ------------------------------------------------------------------ */

const PHOTO = { master: "print_2882.webp", credit: "Miniature Mediterranean Donkey · Smithsonian's National Zoo · CC0" };
/** A customer's file for Full must be at least this on its short side (lib/upload/convert MIN_SHORT.full). */
const PHOTO_SHORT = 1100;

/** The photograph out of its master: the transparent print margin trimmed, enlarged (Lanczos) to PHOTO_SHORT on the short side. */
export async function photo(): Promise<Buffer> {
  const { data, info } = await sharp(path.join(ROOT, "assets", "masters", PHOTO.master)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [x0, y0, x1, y1] = [info.width, info.height, -1, -1];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 250) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  // One pixel in from the edge: the master's own antialiased border isn't the photograph.
  const crop = { left: x0 + 1, top: y0 + 1, width: x1 - x0 - 1, height: y1 - y0 - 1 };
  const k = PHOTO_SHORT / Math.min(crop.width, crop.height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(crop)
    .removeAlpha()
    .resize(Math.round(crop.width * k), Math.round(crop.height * k), { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------------ */
/* The drawing                                                          */
/* ------------------------------------------------------------------ */

type Pt = [number, number];
const [PW, PH] = [1500, 2000];
/** The pen: a fine felt tip, its line widths below scaled by this. */
const NIB = 1.4;

/** An olive sprig in pen on a photographed sketchbook page (PW × PH), and the drawing's box. */
export async function sketch(): Promise<{ png: Buffer; box: Box }> {
  const r = mulberry32(0x0117e);
  const rand = (a: number, b: number) => a + (b - a) * r();
  const strokes: { pts: Pt[]; w: number }[] = [];
  let [bx0, by0, bx1, by1] = [PW, PH, 0, 0];

  /** A pen line: the points given a slow, smooth wobble across the line (a hand, not jitter). */
  const pen = (pts: Pt[], w: number, amp = 2.2) => {
    const [f1, f2, p1, p2] = [rand(0.008, 0.014), rand(0.03, 0.05), rand(0, 6.28), rand(0, 6.28)];
    let s = 0;
    const out: Pt[] = pts.map((p, i) => {
      if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const a = i ? i - 1 : 0;
      const b = i ? i : Math.min(1, pts.length - 1);
      const [dx, dy] = [pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]];
      const len = Math.hypot(dx, dy) || 1;
      const off = amp * (Math.sin(f1 * s + p1) + 0.5 * Math.sin(f2 * s + p2));
      return [p[0] - (dy / len) * off, p[1] + (dx / len) * off];
    });
    for (const [x, y] of out) (bx0 = Math.min(bx0, x)), (by0 = Math.min(by0, y)), (bx1 = Math.max(bx1, x)), (by1 = Math.max(by1, y));
    strokes.push({ pts: out, w });
  };

  // The stem: a cubic from the cut end up to the tip.
  const P: Pt[] = [
    [400, 1800],
    [520, 1280],
    [1020, 1060],
    [1160, 360],
  ];
  const stemAt = (t: number): Pt => {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]) as Pt;
  };
  const tangent = (t: number): Pt => {
    const [a, b] = [stemAt(Math.max(0, t - 0.005)), stemAt(Math.min(1, t + 0.005))];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const along = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => stemAt(a + ((b - a) * i) / n));
  pen(along(0, 1, 90), 12);
  // The cut end, and a second pass where a pen thickens the old wood.
  pen([stemAt(0).map((v, k) => v + [-15, 4][k]) as Pt, stemAt(0).map((v, k) => v + [15, -4][k]) as Pt], 9, 0.5);
  pen(along(0.015, 0.36, 40).map(([x, y]) => [x + 9, y + 1] as Pt), 8, 1.2);

  /** A leaf: base, angle (radians), length, width, the bend, hatched or not. */
  const leaf = (base: Pt, ang: number, L: number, W: number, bend: number, hatch: boolean) => {
    const d: Pt = [Math.cos(ang), Math.sin(ang)];
    const n: Pt = [-d[1], d[0]];
    const c = (u: number): Pt => [base[0] + d[0] * L * u + n[0] * bend * L * u * (1 - u), base[1] + d[1] * L * u + n[1] * bend * L * u * (1 - u)];
    const wid = (u: number) => W * 2.1 * Math.pow(u, 0.7) * Math.pow(1 - u, 1.1);
    const N = 36;
    const side = (s: number) =>
      Array.from({ length: N + 1 }, (_, i) => {
        const u = i / N;
        const p = c(u);
        return [p[0] + n[0] * wid(u) * s, p[1] + n[1] * wid(u) * s] as Pt;
      });
    // One side up and the other back, as a pen goes round a leaf, stopping just short of the base.
    pen([...side(1), ...side(-1).reverse().slice(1, N - 1)], rand(9, 10.5));
    pen(Array.from({ length: 20 }, (_, i) => c(0.05 + (0.8 * i) / 19)), 8, 1.2);
    if (hatch)
      for (let u = 0.2; u < 0.8; u += 0.09) {
        const a = c(u);
        const e = c(u + 0.06);
        const w = wid(u + 0.06) * 0.74;
        pen([a, [e[0] - n[0] * w, e[1] - n[1] * w]], 7.5, 0.5);
      }
  };

  // Leaves in near-opposite pairs up the stem, smaller and closer to it toward the tip.
  const pairs = [0.1, 0.25, 0.4, 0.56, 0.7, 0.83];
  pairs.forEach((t0, k) => {
    for (const s of [-1, 1]) {
      if (k === 0 && s === 1) continue;
      const t = t0 + (s === 1 ? 0.03 : 0) + rand(-0.015, 0.015);
      const [tx, ty] = tangent(t);
      const ang = Math.atan2(ty, tx) + s * (0.95 - 0.45 * t + rand(-0.16, 0.16));
      const L = 440 - 220 * t + rand(-30, 30);
      const p = stemAt(t);
      const petiole: Pt = [p[0] + Math.cos(ang) * 24, p[1] + Math.sin(ang) * 24];
      pen([p, petiole], 8, 0.4);
      leaf(petiole, ang, L, L * rand(0.15, 0.18), -s * rand(0.02, 0.14), (k + (s > 0 ? 1 : 0)) % 3 === 0);
    }
  });
  // The tip: one leaf on along the stem.
  const [tx, ty] = tangent(1);
  leaf(stemAt(1), Math.atan2(ty, tx) - 0.08, 210, 34, 0.08, false);

  // Three olives hanging from one stalk low on the right, a crescent of light left in each and the far side hatched.
  const at = stemAt(0.15);
  const [ux, uy] = tangent(0.15);
  const hang: Pt = [0.75, 0.66];
  const hl = Math.hypot(hang[0], hang[1]);
  const knot: Pt = [at[0] + (hang[0] / hl) * 60, at[1] + (hang[1] / hl) * 60];
  pen([at, [at[0] + (hang[0] / hl) * 30 + ux * 5, at[1] + (hang[1] / hl) * 30 + uy * 5], knot], 7.5, 0.8);
  for (const [da, len] of [
    [-0.7, 55],
    [0.1, 85],
    [0.85, 50],
  ] as [number, number][]) {
    const a0 = Math.atan2(hang[1], hang[0]) + da;
    const [cx, cy] = [Math.cos(a0), Math.sin(a0)];
    const stalk: Pt = [knot[0] + cx * len, knot[1] + cy * len];
    pen([knot, stalk], 7, 0.6);
    const [rx, ry] = [46, 62];
    const ctr: Pt = [stalk[0] + cx * ry * 0.95, stalk[1] + cy * ry * 0.95];
    const ell = (t0: number, t1: number, k = 1): Pt[] =>
      Array.from({ length: 41 }, (_, i) => {
        const th = t0 + ((t1 - t0) * i) / 40;
        const [ex, ey] = [Math.cos(th) * ry * k, Math.sin(th) * rx * k];
        return [ctr[0] + ex * cx - ey * cy, ctr[1] + ex * cy + ey * cx];
      });
    const from = rand(0, Math.PI * 2);
    pen(ell(from, from + Math.PI * 2.1), 9.5, 1);
    pen(ell(-2.5, -1.4, 0.6), 7.5, 0.3);
    for (let k = -0.6; k <= 0.61; k += 0.2) {
      const a = ell(0.7 + k, 0.7 + k, 0.9)[0];
      const b = ell(0.7 + k + 1.5, 0.7 + k + 1.5, 0.9)[0];
      pen([a, [a[0] + (b[0] - a[0]) * 0.32, a[1] + (b[1] - a[1]) * 0.32]], 7, 0.2);
    }
  }

  const d = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const ink = strokes.map((s) => `<path d="${d(s.pts)}" fill="none" stroke="#181614" stroke-width="${(s.w * NIB).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  // The page: warm paper lit from the top left, a soft shadow over the bottom right corner (the phone, or a hand).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}"><defs>
<linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1eee7"/><stop offset="0.6" stop-color="#e6e2d9"/><stop offset="1" stop-color="#d5d0c5"/></linearGradient>
<radialGradient id="s" cx="1.05" cy="1.1" r="0.85"><stop offset="0" stop-color="#8f897d" stop-opacity="0.25"/><stop offset="0.6" stop-color="#a39d91" stop-opacity="0.1"/><stop offset="1" stop-color="#b8b2a6" stop-opacity="0"/></radialGradient>
</defs><rect width="${PW}" height="${PH}" fill="url(#l)"/>${ink}<rect width="${PW}" height="${PH}" fill="url(#s)"/></svg>`;
  const { data, info } = await sharp(new Resvg(svg).render().asPng()).greyscale().blur(0.7).raw().toBuffer({ resolveWithObject: true });
  // Paper grain and the phone's noise.
  const g = mulberry32(0x9a1);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, data[i] + Math.round((g() - 0.5) * 14)));
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
  const pad = 6;
  return { png, box: { x: bx0 - pad, y: by0 - pad, w: bx1 - bx0 + 2 * pad, h: by1 - by0 + 2 * pad } };
}

/* ------------------------------------------------------------------ */
/* Converting                                                           */
/* ------------------------------------------------------------------ */

const pixels = async (buf: Buffer): Promise<Pixels> => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data) };
};

/** FNV-1a over the ink's packed bits (lib/upload/bitmap inkHash). */
export function hashOf(ink: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ink.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (ink[i + b] ? 1 : 0);
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The catalogue's dHashes (lib/search's index, as the page loads them). */
export function catalogueHashes(): Uint32Array {
  const { file } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "search.manifest.json"), "utf8")) as { file: string };
  const { n, visual } = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", file), "utf8")) as { n: number; visual: { h: string } };
  const out = new Uint32Array(n * 2);
  for (let i = 0; i < n * 2; i++) out[i] = parseInt(visual.h.slice(i * 8, i * 8 + 8), 16);
  return out;
}

async function inputs(): Promise<Input[]> {
  const ph = await photo();
  const pm = await sharp(ph).metadata();
  const sk = await sketch();
  return [
    { kind: "photo", pixels: await pixels(ph), before: ph, box: { x: 0, y: 0, w: pm.width!, h: pm.height! }, credit: PHOTO.credit },
    { kind: "drawing", pixels: await pixels(sk.png), before: sk.png, box: sk.box },
  ];
}

export interface Made {
  ex: Example;
  input: Input;
  conv: Converted;
  ink: Uint8Array;
  measures: Measures;
  /** Hamming distance to the nearest catalogue design (a near-duplicate is 6 or under). */
  dup: number;
}

/** The two conversions (the test runs this too). */
export async function examples(): Promise<Made[]> {
  const hashes = catalogueHashes();
  const out: Made[] = [];
  for (const input of await inputs()) {
    const conv = convert({ pixels: input.pixels }, { mode: "dots", size: "full" });
    const on = (t: Tee) => measure(inkFor(conv, t), conv.w, conv.h, t, { screened: conv.mode === "dots", size: conv.size });
    const { tee } = chooseTee(conv, on);
    const ink = inkFor(conv, tee);
    const measures = on(tee);
    const dup = nearestCatalogue(designHash(ink, conv.w, conv.h), hashes);
    out.push({ ex: { kind: input.kind, mode: conv.mode, tee, quality: measures.quality, hash: hashOf(ink), ...(input.credit ? { credit: input.credit } : {}) }, input, conv, ink, measures, dup });
  }
  return out;
}

async function main() {
  const list = await examples();
  for (const m of list) {
    console.log(`${m.ex.kind}: ${m.conv.cls} → ${m.ex.mode} on ${m.ex.tee}, quality ${m.ex.quality}, coverage ${m.measures.coverage.toFixed(3)}, nearest catalogue design ${m.dup}, ${m.ex.hash}`);
  }
  fs.mkdirSync(path.join(ROOT, "data", "upload"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data", "upload", "examples.json"), JSON.stringify(list.map((l) => l.ex), null, 2) + "\n");
}

if (require.main === module) void main();
