/**
 * Publishes the search index (npm "prebuild", after publishIndex; or
 * `npm run search:index`): public/data/search.<hash>.json — named by its
 * content like the catalog index — and data/search.manifest.json, which
 * lib/search/load reads to find it.
 *
 * Each print's visual measures (symmetry, detail, coverage, extent, aspect,
 * a 64-bit dHash) are rendered small once and cached in
 * data/search/visual.json by the print file's hash, so a build only renders
 * new or changed prints. Soft checks are printed as warnings (the content
 * pipeline is never blocked); the index format, its size and the engine's
 * tests are the hard ones.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { rasterInk, svgInk, type InkRaster } from "../gen/quality";
import { buildSearchIndex, type SearchEntry, type VisualMetrics } from "../../lib/search/build";
import { decodeIndex } from "../../lib/search/format";
import { computeSubjects } from "../../lib/search/runtime";
import { SHIRTS } from "../../lib/catalog";

const ROOT = path.resolve(__dirname, "../..");
const CATALOG = path.join(ROOT, "data", "shirts.json");
const CACHE = path.join(ROOT, "data", "search", "visual.json");
const DIR = path.join(ROOT, "public", "data");
const MANIFEST = path.join(ROOT, "data", "search.manifest.json");
/** The index budget, gzipped. */
export const BUDGET_GZIP = 100 * 1024;
/** Bump when the measures change: every cached entry is then measured again. */
const RECIPE = 1;
const W = 150;

/** The measures of one print's ink (0–1 per pixel). */
export function measureInk({ w, h, ink }: InkRaster): VisualMetrics {
  let sum = 0;
  let edges = 0;
  let diff = 0;
  let inked = 0;
  let [minX, minY, maxX, maxY] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = ink[y * w + x];
      sum += a;
      const on = a > 0.2;
      if (on) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
      if (x > 0 && ink[y * w + x - 1] > 0.2 !== on) edges++;
      if (y > 0 && ink[(y - 1) * w + x] > 0.2 !== on) edges++;
      // Left-right symmetry, over the ink on either side.
      const b = ink[y * w + (w - 1 - x)];
      if (on || b > 0.2) {
        diff += Math.abs(a - b);
        inked++;
      }
    }
  const bw = maxX < 0 ? 0 : maxX - minX + 1;
  const bh = maxY < 0 ? 0 : maxY - minY + 1;
  return {
    symmetry: inked ? 1 - diff / inked : 0,
    detail: edges / (w * h),
    coverage: sum / (w * h),
    extent: (bw * bh) / (w * h),
    aspect: bh ? bw / bh : 1,
    dhash: dHash({ w, h, ink }),
  };
}

/** Difference hash: the ink averaged down to 9 × 8, each cell brighter than its right neighbour or not. */
export function dHash({ w, h, ink }: InkRaster): string {
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

async function inkOf(e: SearchEntry & { baseColor: "black" | "white"; backPrintUrl: string }, file: string): Promise<InkRaster> {
  if (file.endsWith(".svg")) return svgInk(readFileSync(file, "utf8"), e.baseColor, W);
  const { data, info } = await sharp(file).resize(W).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return rasterInk(data, info.width, info.height, e.medium, e.baseColor);
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG, "utf8")) as (SearchEntry & { baseColor: "black" | "white"; backPrintUrl: string })[];
  const cache: { recipe: number; entries: Record<string, VisualMetrics> } = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { recipe: RECIPE, entries: {} };
  if (cache.recipe !== RECIPE) cache.entries = {};
  const used = new Set<string>();
  const visual: Record<string, VisualMetrics> = {};
  let measured = 0;
  for (const e of catalog) {
    const file = path.join(ROOT, "public", e.backPrintUrl);
    if (!existsSync(file)) continue;
    // The same file lands differently on the other tee colour: the colour is part of the key.
    const key = `${createHash("sha1").update(readFileSync(file)).digest("hex")}:${e.medium}:${e.baseColor}`;
    used.add(key);
    if (!cache.entries[key]) {
      const m = measureInk(await inkOf(e, file));
      cache.entries[key] = { ...m, symmetry: +m.symmetry.toFixed(4), detail: +m.detail.toFixed(4), coverage: +m.coverage.toFixed(4), extent: +m.extent.toFixed(4), aspect: +m.aspect.toFixed(4) };
      measured++;
    }
    visual[e.id] = cache.entries[key];
  }
  // Prints that are gone leave the cache; sorted keys keep its diffs small.
  const entries = Object.fromEntries(Object.keys(cache.entries).filter((k) => used.has(k)).sort().map((k) => [k, cache.entries[k]]));
  mkdirSync(path.dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, `${JSON.stringify({ recipe: RECIPE, entries }, null, 0).replace(/},"/g, '},\n"')}\n`);

  const { file, warnings } = buildSearchIndex(catalog, visual);
  // The SUBJECT chips, against the catalogue as the shop decodes it (lib/catalog): worked out here, once, not in every browser.
  const index = decodeIndex(file, SHIRTS.map((s) => s.id));
  if (!index) throw new Error("search: the index doesn't match the shop's catalogue (run publishIndex first)");
  file.subjects = computeSubjects(index, SHIRTS);
  const json = JSON.stringify(file);
  const gz = gzipSync(json, { level: 9 }).length;
  const name = `search.${createHash("sha256").update(json).digest("hex").slice(0, 10)}.json`;
  mkdirSync(DIR, { recursive: true });
  for (const f of readdirSync(DIR)) if (/^search\.[0-9a-f]+\.json$/.test(f) && f !== name) rmSync(path.join(DIR, f));
  writeFileSync(path.join(DIR, name), json);
  writeFileSync(MANIFEST, `${JSON.stringify({ file: name }, null, 2)}\n`);
  for (const w of warnings) console.warn(`search: warning: ${w}`);
  console.log(`search → public/data/${name} (${(json.length / 1024).toFixed(0)} KB, ${(gz / 1024).toFixed(1)} KB gzipped; ${file.vocab.length} terms; ${measured} prints measured, ${Object.keys(entries).length} cached)`);
  if (gz > BUDGET_GZIP) {
    console.error(`search: the index is ${(gz / 1024).toFixed(1)} KB gzipped, over the ${BUDGET_GZIP / 1024} KB budget`);
    process.exit(1);
  }
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
