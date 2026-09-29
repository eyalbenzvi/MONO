/**
 * Bakes the pictures the site shows (lib/images.ts), from the prints in
 * public/prints and the model photos in public/models, into public/img
 * (git-ignored; made before every build and before the link previews):
 *
 * - m/<n>-<colour>-<w>.webp  the design on its model photo, at MOCKUP_WIDTHS;
 * - p/<n>-<colour>-<w>.webp  a raster print flat on the tee colour, at PRINT_WIDTHS
 *   (p/<n>-<colour>.svg for a drawn print: the vector file in that colourway);
 * - d/<n>-<colour>.webp      the close-up for zooming: the print's area of the
 *   photo at the print file's own size.
 *
 * Every print is shrunk once, here, with a proper filter (a halftone's dots
 * average into tone instead of aliasing into blocks), and the ink is laid on
 * the fabric the way it prints: black ink multiplies onto a white tee, white
 * ink screens onto a black one. Only designs whose inputs changed are baked
 * again (a stamp per design and colour).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/images/bake.ts [id…]
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import shirtsJson from "../../data/shirts.json";
import { needsInvert } from "../../lib/catalog";
import { DETAIL_WIDTH, MOCKUP_WIDTHS, PRINT_WIDTHS, detailPath, isVector, mockupPath, printPath } from "../../lib/images";
import { modelFor } from "../../lib/models";
import type { BaseColor, CatalogEntry } from "../../types/shirt";

/** Bumped whenever the recipe below changes: every picture is baked again. */
const RECIPE = 3;
const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");
const STAMP = path.join(ROOT, "node_modules", ".cache", "mono-images.json");
const ALL = shirtsJson as unknown as CatalogEntry[];

// The prints' fonts, as the link previews load them (DejaVu ships on the CI runner).
const FONT_FILES = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"]
  .flatMap((d) => ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSansMono.ttf", "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSerif-Regular.ttf", "LiberationMono-Regular.ttf", "LiberationMono-Bold.ttf"].map((f) => path.join(d, f)))
  .filter((f) => existsSync(f));
export const FONT_OPTS = FONT_FILES.length
  ? { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans", sansSerifFamily: "Liberation Sans", serifFamily: "Liberation Serif", monospaceFamily: "DejaVu Sans Mono" }
  : { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" };

export interface Job {
  shirt: CatalogEntry;
  color: BaseColor;
}

/** A drawn print's SVG in `color`: every print is strictly #FFFFFF / #000000, so the other colourway swaps the two. */
export function svgIn(shirt: CatalogEntry, color: BaseColor): string {
  const svg = readFileSync(path.join(PUBLIC, shirt.backPrintUrl), "utf8");
  return needsInvert(shirt, color) ? svg.replace(/#FFFFFF|#000000/g, (m) => (m === "#FFFFFF" ? "#000000" : "#FFFFFF")) : svg;
}

/** A grey picture held in memory: one byte a pixel. */
export interface Grey {
  data: Buffer;
  width: number;
  height: number;
}
const raw = (g: Grey) => sharp(g.data, { raw: { width: g.width, height: g.height, channels: 1 } });

/**
 * The print flat on the tee colour at its own size (1500 × 2000), one grey
 * channel: the tee colour where there's no ink, the ink colour where there
 * is. A raster print's ink is its alpha (black ink for a white tee, white for
 * a black one, whatever colour the file carries); a drawn print is rendered.
 */
export async function flatPrint(shirt: CatalogEntry, color: BaseColor): Promise<Grey> {
  const [w, h] = [1500, 2000];
  const img = isVector(shirt)
    ? sharp(new Resvg(svgIn(shirt, color), { fitTo: { mode: "width", value: w }, font: FONT_OPTS }).render().asPng()).flatten({ background: color === "black" ? "#000" : "#fff" }).resize(w, h, { fit: "fill" }).greyscale()
    : sharp(path.join(PUBLIC, shirt.backPrintUrl)).ensureAlpha().extractChannel("alpha").resize(w, h, { fit: "fill" });
  const flat = isVector(shirt) || color === "black" ? img : img.negate();
  const { data, info } = await flat.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * The print shrunk to w × h with a proper filter (libvips' Lanczos widens its
 * kernel with the shrink): a halftone's dots average into tone, never alias
 * into blocks.
 */
const shrink = (print: Grey, w: number, h: number) => raw(print).resize(w, h, { fit: "fill", kernel: "lanczos3" });

const blend = (color: BaseColor) => (color === "black" ? "screen" : "multiply");

/** The design on its model photo, `w` px wide. */
export async function mockup(color: BaseColor, print: Grey, w: number, photo: sharp.Metadata & { buf: Buffer }, box: number[]): Promise<Buffer> {
  const h = Math.round((w * photo.height!) / photo.width!);
  const [bx, by, bw, bh] = [Math.round(box[0] * w), Math.round(box[1] * h), Math.round(box[2] * w), Math.round(box[3] * h)];
  const ink = await shrink(print, bw, bh).toColourspace("srgb").png({ compressionLevel: 1 }).toBuffer();
  return sharp(photo.buf)
    .resize(w, h, { kernel: "lanczos3" })
    .composite([{ input: ink, left: bx, top: by, blend: blend(color) }])
    .webp({ quality: 74, effort: 2 })
    .toBuffer();
}

/** The close-up: the print's area of the photo, enlarged to DETAIL_WIDTH, with the print on it. */
async function detail(color: BaseColor, print: Grey, photo: sharp.Metadata & { buf: Buffer }, box: number[]): Promise<Buffer> {
  const [W, H] = [photo.width!, photo.height!];
  const area = { left: Math.round(box[0] * W), top: Math.round(box[1] * H), width: Math.round(box[2] * W), height: Math.round(box[3] * H) };
  const h = Math.round((DETAIL_WIDTH * 4) / 3);
  const ink = await shrink(print, DETAIL_WIDTH, h).toColourspace("srgb").png({ compressionLevel: 1 }).toBuffer();
  return sharp(photo.buf)
    .extract(area)
    .resize(DETAIL_WIDTH, h, { fit: "fill", kernel: "lanczos3" })
    .composite([{ input: ink, blend: blend(color) }])
    .webp({ quality: 58, effort: 4 })
    .toBuffer();
}

const write = (rel: string, data: Buffer | string) => {
  const file = path.join(PUBLIC, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
};

export async function bake(job: Job) {
  const { shirt, color } = job;
  const model = modelFor(shirt, color);
  if (!model) throw new Error(`no model photo for ${shirt.id} in ${color}`);
  const buf = readFileSync(path.join(PUBLIC, "models", `${model.id}.webp`));
  const photo = { ...(await sharp(buf).metadata()), buf };
  const print = await flatPrint(shirt, color);
  for (const w of MOCKUP_WIDTHS) write(mockupPath(shirt, color, w), await mockup(color, print, w, photo, model.box));
  write(detailPath(shirt, color), await detail(color, print, photo, model.box));
  if (isVector(shirt)) write(printPath(shirt, color), svgIn(shirt, color));
  else
    for (const w of PRINT_WIDTHS)
      // The print's own size stays exact (two tones, lossless); smaller ones are tone.
      write(printPath(shirt, color, w), await (w === print.width ? raw(print).webp({ lossless: true, effort: 2 }) : shrink(print, w, Math.round((w * 4) / 3)).webp({ quality: 72, effort: 2 })).toBuffer());
}

/** Every design in every colour it's sold in. */
export const allJobs = (list: CatalogEntry[] = ALL): Job[] => list.flatMap((shirt) => shirt.colors.map((color) => ({ shirt, color })));

/** What a picture is made from: when none of it changed, the picture is left alone. */
function stampOf({ shirt, color }: Job): string {
  const model = modelFor(shirt, color)!;
  const h = createHash("sha1").update(`${RECIPE}|${color}|${shirt.medium}|${shirt.baseColor}|${model.id}|${model.box.join()}|`);
  h.update(readFileSync(path.join(PUBLIC, shirt.backPrintUrl)));
  h.update(readFileSync(path.join(PUBLIC, "models", `${model.id}.webp`)));
  return h.digest("hex").slice(0, 16);
}

const jobKey = (j: Job) => `${j.shirt.id}-${j.color}`;
const outputs = (j: Job) => [...MOCKUP_WIDTHS.map((w) => mockupPath(j.shirt, j.color, w)), detailPath(j.shirt, j.color), ...(isVector(j.shirt) ? [printPath(j.shirt, j.color)] : PRINT_WIDTHS.map((w) => printPath(j.shirt, j.color, w)))];

/** The jobs whose pictures are missing or out of date, with their new stamps. */
export function pending(jobs: Job[]): { todo: Job[]; stamps: Record<string, string> } {
  const old: Record<string, string> = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, "utf8")) : {};
  const stamps: Record<string, string> = {};
  const todo: Job[] = [];
  for (const j of jobs) {
    const k = jobKey(j);
    stamps[k] = stampOf(j);
    if (old[k] !== stamps[k] || !outputs(j).every((o) => existsSync(path.join(PUBLIC, o)))) todo.push(j);
  }
  return { todo, stamps };
}

/**
 * resvg's native memory isn't seen by the garbage collector (see
 * generateOgImages), so the work goes to short-lived workers, each baking
 * one batch.
 */
const BATCH = 40;

function runBatch(ids: string[]) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(process.execPath, [...process.execArgv, __filename], { env: { ...process.env, BAKE_JOBS: ids.join(",") }, stdio: ["ignore", "ignore", "inherit"] });
    child.on("exit", (code) => resolve(code === 0));
  });
}

/** Bakes whatever is out of date (all of `jobs` by default). Returns how many were baked. */
export async function bakeAll(jobs: Job[] = allJobs()): Promise<number> {
  const { todo, stamps } = pending(jobs);
  if (todo.length) {
    const batches: string[][] = [];
    for (let k = 0; k < todo.length; k += BATCH) batches.push(todo.slice(k, k + BATCH).map(jobKey));
    const workers = Math.max(1, Math.min(8, os.cpus().length));
    const failed: string[][] = [];
    await Promise.all(
      Array.from({ length: workers }, async () => {
        for (let b = batches.shift(); b; b = batches.shift()) if (!(await runBatch(b))) failed.push(b);
      }),
    );
    if (failed.length) throw new Error(`image batches failed: ${failed.map((b) => b[0]).join(", ")}`);
  }
  mkdirSync(path.dirname(STAMP), { recursive: true });
  const old: Record<string, string> = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, "utf8")) : {};
  writeFileSync(STAMP, JSON.stringify({ ...old, ...stamps }));
  return todo.length;
}

async function main() {
  const byKey = new Map(allJobs().map((j) => [jobKey(j), j]));
  // Worker: bake the listed jobs (one thread each: the workers already fill the machine).
  if (process.env.BAKE_JOBS) {
    sharp.concurrency(1);
    for (const k of process.env.BAKE_JOBS.split(",")) await bake(byKey.get(k)!);
    return;
  }
  const only = new Set(process.argv.slice(2));
  const jobs = only.size ? allJobs(ALL.filter((s) => only.has(s.id))) : allJobs();
  const t0 = Date.now();
  const n = await bakeAll(jobs);
  console.log(`images: ${n} of ${jobs.length} design-colours baked (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
