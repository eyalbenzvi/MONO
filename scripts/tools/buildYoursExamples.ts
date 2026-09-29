/**
 * "From yours" examples, made honestly: the real converter (lib/upload
 * convert, measure, teeRule) run on three inputs, the outputs written as
 * they come out, never retouched.
 * - A photograph: Fennec Fox by Clyde Nishimura, FONZ Photo Club,
 *   Smithsonian's National Zoo (CC0), the catalogue's master of mono-3266.
 * - A drawing: a sketch drawn here (seeded wobbly strokes of a house and a
 *   tree) on paper with grain and uneven light, so the clean-up has work.
 * - Words: "SUNDAY / BEST" in the print font (DejaVu Sans Mono Bold).
 * Writes public/make/yours/<kind>-before.webp and -after.webp (the print in
 * its tee's inks) and data/upload/examples.json (mode, tee, quality, the
 * ink's hash, the credit); tests/upload/examples.test.ts checks the hashes.
 *
 *   npx tsx scripts/tools/buildYoursExamples.ts
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { convert, inkFor, type Converted, type Pixels, type Tee } from "../../lib/upload/convert";
import { measure } from "../../lib/upload/measure";
import { chooseTee } from "../../lib/upload/teeRule";
import { mulberry32 } from "../gen/core";

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "public", "make", "yours");
const FONT_FILES = ["DejaVuSansMono-Bold.ttf", "DejaVuSansMono.ttf"].map((f) => path.join("/usr/share/fonts/truetype/dejavu", f)).filter((f) => fs.existsSync(f));

export interface Example {
  kind: "photo" | "drawing" | "words";
  mode: string;
  tee: Tee;
  quality: number;
  hash: string;
  credit?: string;
}

/** The sketch: a house and a tree in wobbly strokes on uneven, grainy paper (1600 × 1200). */
export async function sketch(): Promise<Buffer> {
  const r = mulberry32(0x5e7c4);
  const wob = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${(x + (r() - 0.5) * 6).toFixed(1)} ${(y + (r() - 0.5) * 6).toFixed(1)}`).join("");
  const seg = (a: [number, number], b: [number, number], n = 8) => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as [number, number]);
  const strokes = [
    wob([...seg([380, 900], [380, 560]), ...seg([380, 560], [620, 380]), ...seg([620, 380], [860, 560]), ...seg([860, 560], [860, 900]), ...seg([860, 900], [380, 900])]),
    wob([...seg([560, 900], [560, 740]), ...seg([560, 740], [660, 740]), ...seg([660, 740], [660, 900])]),
    wob([...seg([440, 620], [520, 620]), ...seg([520, 620], [520, 690]), ...seg([520, 690], [440, 690]), ...seg([440, 690], [440, 620])]),
    wob([...seg([720, 620], [800, 620]), ...seg([800, 620], [800, 690]), ...seg([800, 690], [720, 690]), ...seg([720, 690], [720, 620])]),
    wob([...seg([1150, 900], [1150, 640])]),
    wob(Array.from({ length: 40 }, (_, i) => [1150 + Math.cos((i / 39) * Math.PI * 2) * 150, 520 + Math.sin((i / 39) * Math.PI * 2) * 130] as [number, number])),
    wob([...seg([300, 905], [1320, 905], 20)]),
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><defs><radialGradient id="l" cx="30%" cy="25%" r="90%"><stop offset="0" stop-color="#f4f1ea"/><stop offset="1" stop-color="#cfc9bd"/></radialGradient></defs><rect width="1600" height="1200" fill="url(#l)"/>${strokes.map((d) => `<path d="${d}" fill="none" stroke="#1d1b19" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>`;
  const { data, info } = await sharp(new Resvg(svg).render().asPng()).greyscale().raw().toBuffer({ resolveWithObject: true });
  // Paper grain: a little seeded noise over everything.
  const g = mulberry32(0x9a1);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, data[i] + Math.round((g() - 0.5) * 22)));
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
}

/** The words set in the print font, black on white. */
export async function words(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760"><rect width="1400" height="760" fill="#fff"/><g font-family="DejaVu Sans Mono" font-weight="bold" font-size="220" text-anchor="middle"><text x="700" y="320">SUNDAY</text><text x="700" y="590">BEST</text></g></svg>`;
  return Buffer.from(new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans Mono" } }).render().asPng());
}

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

/** The three conversions (the test runs this too). */
export async function examples(): Promise<{ ex: Example; before: Buffer; conv: Converted; ink: Uint8Array }[]> {
  const photo = fs.readFileSync(path.join(ROOT, "assets", "masters", "print_3266.webp"));
  const inputs: [Example["kind"], Buffer, string | undefined][] = [
    ["photo", photo, "Fennec Fox · Clyde Nishimura, FONZ Photo Club, Smithsonian's National Zoo · CC0"],
    ["drawing", await sketch(), undefined],
    ["words", await words(), undefined],
  ];
  const out = [];
  for (const [kind, buf, credit] of inputs) {
    const px = await pixels(buf);
    const conv = convert(kind === "words" ? { pixels: px, words: ["SUNDAY", "BEST"] } : { pixels: px }, { mode: "dots", size: "full" });
    const on = (t: Tee) => measure(inkFor(conv, t), conv.w, conv.h, t, { screened: conv.mode === "dots", size: conv.size });
    const { tee } = chooseTee(conv, on);
    const ink = inkFor(conv, tee);
    out.push({ ex: { kind, mode: conv.mode, tee, quality: on(tee).quality, hash: hashOf(ink), ...(credit ? { credit } : {}) }, before: buf, conv, ink });
  }
  return out;
}

/** The print in its tee's inks, 600 × 800 (area-averaged from 1500 × 2000). */
function printImage(ink: Uint8Array, tee: Tee) {
  const [W, H, w, h] = [1500, 2000, 600, 800];
  const out = Buffer.alloc(w * h);
  const k = W / w;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) s += ink[Math.floor(y * k + dy) * W + Math.floor(x * k + dx)];
      const a = s / (k * k);
      out[y * w + x] = Math.round(255 * (tee === "black" ? a : 1 - a));
    }
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).webp({ quality: 82 }).toBuffer();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const list = await examples();
  for (const { ex, before, ink } of list) {
    fs.writeFileSync(path.join(OUT, `${ex.kind}-before.webp`), await sharp(before).resize({ width: 480, height: 480, fit: "inside" }).webp({ quality: 78 }).toBuffer());
    fs.writeFileSync(path.join(OUT, `${ex.kind}-after.webp`), await printImage(ink, ex.tee));
    console.log(`${ex.kind}: ${ex.mode} on ${ex.tee}, quality ${ex.quality}, ${ex.hash}`);
  }
  fs.mkdirSync(path.join(ROOT, "data", "upload"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data", "upload", "examples.json"), JSON.stringify(list.map((l) => l.ex), null, 2) + "\n");
}

if (require.main === module) void main();
