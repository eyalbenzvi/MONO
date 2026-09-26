/**
 * Link-preview images (Open Graph, 1200×630 PNG) for every product page, plus
 * a default one for the site. WhatsApp, Facebook, Telegram, X, iMessage and
 * others show these when a MONO link is shared. They need a raster image
 * (SVG isn't accepted), so each is composed as SVG and rendered with resvg.
 *
 *   npm run og            # writes public/og/*.png (git-ignored; built in CI)
 *
 * Runs before `next build` so the images are exported with the site.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
// @ts-expect-error — upng-js ships no types
import UPNG from "upng-js";
import shirtsJson from "../data/shirts.json";
import { WEAK_QUALITY } from "./gen/quality";
import { TEE_BODY, TEE_COLLAR, TEE_COLORS, TEE_HEMS, TEE_PRINT, TEE_SEAMS, TEE_VIEW } from "../lib/teeShape";
import { CATEGORY_LABELS, COLOR_LABELS, type CatalogEntry } from "../types/shirt";

const ALL = shirtsJson as unknown as CatalogEntry[];
/**
 * Only pages that are pre-rendered get a link-preview image: the top
 * NEXT_PUBLIC_PRERENDER_LIMIT of the editorial rank (the same rule as
 * lib/catalog's isPrerendered), or every design when unset.
 */
const LIMIT = Number(process.env.NEXT_PUBLIC_PRERENDER_LIMIT) || Infinity;
const SHIRTS = ALL.filter((s) => s.rank < LIMIT);
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "og");
const W = 1200;
const H = 630;
// DejaVu ships on the CI runner (and most Linux); sizes below are measured for it.
const FONT = `font-family="'DejaVu Sans', sans-serif"`;
const MONO_FONT = `font-family="'DejaVu Sans Mono', monospace"`;
/** Average advance per character (× font size) for DejaVu Sans. */
const ADV = { bold: 0.72, regular: 0.6, mono: 0.61 };
const HOST = process.env.OG_HOST ?? "eyalbenzvi.github.io/MONO";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Print SVG body (without its outer <svg>), for nesting. */
function printInner(shirt: CatalogEntry) {
  const svg = readFileSync(path.join(ROOT, "public", shirt.backPrintUrl), "utf8");
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

/** The tee with its print, `h` px tall, top-left at (x, y). */
function tee(shirt: CatalogEntry, x: number, y: number, h: number, idPrefix: string) {
  const s = h / TEE_VIEW.h;
  const c = TEE_COLORS[shirt.baseColor];
  const blend = shirt.baseColor === "black" ? "screen" : "multiply";
  // Pattern / clip ids inside prints are short (t1, l2, c…): prefix them so
  // several prints can share one document (the default image has three).
  const inner = printInner(shirt).replace(/id="([^"]+)"/g, `id="${idPrefix}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${idPrefix}$1)`).replace(/href="#([^"]+)"/g, `href="#${idPrefix}$1"`);
  const shade = shirt.baseColor === "black" ? 0.45 : 0.16;
  return `<g transform="translate(${x - TEE_VIEW.x * s} ${y - TEE_VIEW.y * s}) scale(${s})">
    <defs>
      <clipPath id="${idPrefix}body"><path d="${TEE_BODY}"/></clipPath>
      <linearGradient id="${idPrefix}side" x1="92" x2="308" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="${shade}"/><stop offset="0.22" stop-opacity="0"/><stop offset="0.78" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${shade}"/></linearGradient>
    </defs>
    <path d="${TEE_BODY}" fill="${c.fabric}"/>
    <path d="${TEE_SEAMS}" fill="none" stroke="${c.seam}" stroke-width="1.4"/>
    <path d="${TEE_HEMS}" fill="none" stroke="${c.seam}" stroke-width="1.2" stroke-dasharray="3 3"/>
    <g style="mix-blend-mode:${blend}"><svg x="${TEE_PRINT.x}" y="${TEE_PRINT.y}" width="${TEE_PRINT.w}" height="${TEE_PRINT.h}" viewBox="0 0 300 400">${inner}</svg></g>
    <path d="${TEE_COLLAR}" fill="none" stroke="${c.collar}" stroke-width="7" stroke-linecap="round"/>
    <g clip-path="url(#${idPrefix}body)" style="mix-blend-mode:multiply"><rect width="400" height="460" fill="url(#${idPrefix}side)"/></g>
  </g>`;
}

function logo(x: number, y: number) {
  return `<rect x="${x}" y="${y}" width="150" height="54" rx="10" fill="none" stroke="#fff" stroke-width="3"/><text x="${x + 75}" y="${y + 37}" font-size="30" font-weight="800" letter-spacing="7" text-anchor="middle" ${FONT} fill="#fff">MONO</text>`;
}

const frame = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0b0b0b"/>${body}</svg>`;

/** Font size at which `text` fits `maxW`. */
const fit = (text: string, maxW: number, max: number, adv = ADV.bold) => Math.min(max, maxW / (text.length * adv));

/** Flat spotlight disc behind a tee (keeps a black tee visible on the dark ground). */
const spot = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#262626"/><circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="#303030"/>`;

function productSvg(shirt: CatalogEntry) {
  const titleSize = fit(shirt.title, 540, 60);
  const other = shirt.baseColor === "black" ? "white" : "black";
  const cta = "Swipe to find your taste →";
  const ctaW = cta.length * 25 * ADV.bold * 0.92 + 64;
  return frame(`
  ${spot(320, 315, 285)}
  ${tee(shirt, 90, 45, 540, "p")}
  ${logo(620, 92)}
  <text x="620" y="245" font-size="${titleSize.toFixed(1)}" font-weight="700" ${FONT} fill="#fff">${esc(shirt.title)}</text>
  <text x="620" y="296" font-size="27" ${FONT} fill="#fff" fill-opacity="0.75">${esc(CATEGORY_LABELS[shirt.category])} · $${shirt.price}</text>
  <text x="620" y="336" font-size="23" ${FONT} fill="#fff" fill-opacity="0.55">${COLOR_LABELS[shirt.baseColor]} tee · also in ${other}</text>
  <rect x="620" y="420" width="${ctaW.toFixed(0)}" height="64" rx="32" fill="#fff"/>
  <text x="${(620 + ctaW / 2).toFixed(0)}" y="461" font-size="25" font-weight="700" text-anchor="middle" ${FONT} fill="#000">${cta}</text>
  <text x="620" y="560" font-size="${fit(HOST, 540, 22, ADV.mono).toFixed(1)}" ${MONO_FONT} fill="#fff" fill-opacity="0.55">${esc(HOST)}</text>`);
}

function defaultSvg() {
  // Three strong prints from different categories, by editorial rank (no weak ones).
  const pick: CatalogEntry[] = [];
  for (const s of [...ALL].sort((a, b) => a.rank - b.rank)) {
    if (s.quality >= WEAK_QUALITY && s.quality >= 70 && !pick.some((p) => p.category === s.category)) pick.push(s);
    if (pick.length === 3) break;
  }
  const tees = pick.map((s, i) => tee(s, 650 + i * 180, 165 + (i % 2) * 36, 300, `d${i}`)).join("");
  return frame(`
  ${spot(920, 330, 290)}
  ${tees}
  ${logo(70, 110)}
  <text x="70" y="262" font-size="50" font-weight="700" ${FONT} fill="#fff">Swipe your taste</text>
  <text x="70" y="322" font-size="50" font-weight="700" ${FONT} fill="#fff">in tees.</text>
  <text x="70" y="386" font-size="24" ${FONT} fill="#fff" fill-opacity="0.72">${ALL.length.toLocaleString("en-US")} monochrome prints</text>
  <text x="70" y="420" font-size="24" ${FONT} fill="#fff" fill-opacity="0.72">black or white, back print</text>
  <text x="70" y="560" font-size="22" ${MONO_FONT} fill="#fff" fill-opacity="0.55">${esc(HOST)}</text>`);
}

// Fonts are loaded once from known files (fast, and the same on every run);
// generic serif / sans / mono in the prints map onto them.
const FONT_DIRS = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"];
const FONT_FILES = FONT_DIRS.flatMap((d) =>
  ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSansMono.ttf",
    "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSerif-Regular.ttf", "LiberationSerif-Italic.ttf", "LiberationSerif-Bold.ttf", "LiberationMono-Regular.ttf", "LiberationMono-Bold.ttf"]
    .map((f) => path.join(d, f)),
).filter((f) => existsSync(f));
const FONT_OPTS = FONT_FILES.length
  ? { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans", sansSerifFamily: "Liberation Sans", serifFamily: "Liberation Serif", monospaceFamily: "Liberation Mono" }
  : { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" };

/** Render, then re-encode as a 256-colour palette PNG (the art is grey anyway): ~4× smaller. */
function render(svg: string): Buffer {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: FONT_OPTS }).render();
  const rgba = img.pixels;
  const ab = rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength);
  return Buffer.from(UPNG.encode([ab], img.width, img.height, 256));
}

const outFile = (s: CatalogEntry) => path.join(OUT, `${s.id}.png`);

/** Renders the given shirts in this process (skipping finished ones unless forced). */
function renderList(list: CatalogEntry[], force: boolean) {
  for (const s of list) {
    if (!force && existsSync(outFile(s))) continue;
    writeFileSync(outFile(s), render(productSvg(s)));
  }
}

/**
 * resvg's native memory (font database + a full bitmap per image) isn't seen
 * by the JS garbage collector, so one long-lived process grows until the
 * machine runs out of memory. Each worker therefore renders one small batch
 * and exits, which returns everything to the OS.
 */
const BATCH = 120;

function runBatch(from: number, to: number) {
  return new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [...process.execArgv, __filename], { env: { ...process.env, OG_RANGE: `${from}-${to}` }, stdio: ["ignore", "ignore", "inherit"] });
    child.on("exit", (code, signal) => {
      if (code !== 0) console.warn(`OG batch ${from}-${to} stopped (${signal ?? code}); its images are retried below.`);
      resolve();
    });
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  // Worker: OG_RANGE=from-to renders that slice of the catalog.
  const range = process.env.OG_RANGE?.split("-").map(Number);
  if (range) {
    renderList(SHIRTS.slice(range[0], range[1]), false);
    return;
  }
  const only = process.argv[2] ? new Set(process.argv.slice(2)) : null;
  const list = only ? SHIRTS.filter((s) => only.has(s.id)) : SHIRTS;
  if (only) renderList(list, true);
  else {
    // Whole catalog: batches over a pool of CPU-count workers (~0.15 s per
    // image), then render anything a worker didn't finish (a few at most).
    const batches: [number, number][] = [];
    for (let k = 0; k < SHIRTS.length; k += BATCH) batches.push([k, Math.min(SHIRTS.length, k + BATCH)]);
    const pending = batches.filter(([a, b]) => SHIRTS.slice(a, b).some((s) => !existsSync(outFile(s))));
    const workers = Math.max(1, Math.min(8, os.cpus().length));
    await Promise.all(
      Array.from({ length: workers }, async () => {
        for (let job = pending.shift(); job; job = pending.shift()) await runBatch(job[0], job[1]);
      }),
    );
    const left = list.filter((s) => !existsSync(outFile(s)));
    if (left.length > 50) throw new Error(`${left.length} OG images failed to render`);
    renderList(left, true);
  }
  writeFileSync(path.join(OUT, "default.png"), render(defaultSvg()));
  const missing = list.filter((s) => !existsSync(outFile(s)));
  if (missing.length) throw new Error(`${missing.length} OG images missing, e.g. ${missing[0].id}`);
  const bytes = list.reduce((sum, s) => sum + statSync(outFile(s)).size, 0);
  console.log(`OG images: ${list.length} products + default → ${path.relative(ROOT, OUT)} (${(bytes / 1024 / 1024).toFixed(1)} MB, avg ${(bytes / Math.max(1, list.length) / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
