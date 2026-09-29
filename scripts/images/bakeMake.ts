/**
 * Bakes the Make index's cards (lib/custom/makeCards): each product's example
 * print on its model photo, laid as bake.ts lays the catalogue's (and as the
 * page's canvas draws a live one: black ink multiplied onto a white tee,
 * white ink screened onto a black one), then the chest crop the cards show
 * (CustomMockup chestCrop), at CARD_WIDTHS, into public/img/make/.
 * Unchanged cards are skipped (a stamp per card: the print, the photo, the recipe).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/images/bakeMake.ts
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import shirtsJson from "../../data/shirts.json";
import { chestBox } from "../../lib/custom/chest";
import { decodeCities, type CitiesFile } from "../../lib/custom/data";
import { CARD_WIDTHS, TWO_KEY, TWO_SPEC, cardPath } from "../../lib/custom/makeCards";
import { MADE, madeBySlug, type MadeProduct } from "../../lib/custom/products";
import { loadRenderer, prepareData } from "../../lib/custom/renderers";
import type { CustomSpec } from "../../lib/custom/spec";
import { modelFor } from "../../lib/models";
import type { BaseColor, CatalogEntry } from "../../types/shirt";
import { FONT_OPTS, mockup, type Grey } from "./bake";

/** Bumped whenever the recipe changes: every card is baked again. */
const RECIPE = 1;
const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");
const STAMP = path.join(ROOT, "node_modules", ".cache", "mono-make-cards.json");
const ALL = shirtsJson as unknown as CatalogEntry[];

interface Card {
  key: string;
  made: MadeProduct;
  spec: CustomSpec;
}

const cards = (): Card[] => [...MADE.map((made) => ({ key: made.slug, made, spec: made.example })), { key: TWO_KEY, made: madeBySlug("monogram") as MadeProduct, spec: TWO_SPEC }];

/** The data the example prints need (a sky's stars and city, the world's cities), read from disk as the link previews read it. */
function baseData() {
  const read = (f: string) => JSON.parse(readFileSync(path.join(ROOT, "data", f), "utf8"));
  const sky = { stars: read("sky/stars.json"), lines: (read("sky/constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines) };
  return { sky, places: decodeCities(read("cities/cities.json") as CitiesFile) };
}

/** The print flat on the tee colour at 1500 × 2000, one grey channel (bake.ts flatPrint, for a drawn print in its colour's inks). */
async function flat(svg: string, color: BaseColor): Promise<Grey> {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1500 }, font: FONT_OPTS }).render().asPng();
  const { data, info } = await sharp(png).flatten({ background: color === "black" ? "#000" : "#fff" }).resize(1500, 2000, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** The templates load their data as the page does (fetch "/data/…"): here it's read from public/. */
function serveLocalFetch() {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("/")) return real(input, init);
    // The page's URLs carry the Pages base path (assetUrl: /MONO/data/…); the file is under public/ without it.
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const file = base && url.startsWith(`${base}/`) ? url.slice(base.length) : url;
    return new Response(readFileSync(path.join(PUBLIC, file.split("?")[0])));
  }) as typeof fetch;
}

async function main() {
  const t0 = Date.now();
  serveLocalFetch();
  const data = baseData();
  const old: Record<string, string> = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, "utf8")) : {};
  const stamps: Record<string, string> = {};
  let baked = 0;
  for (const { key, made, spec } of cards()) {
    const base = ALL.find((s) => s.variant === made.base);
    if (!base) throw new Error(`${key}: no base design ${made.base}`);
    const color = base.baseColor;
    const model = modelFor(base, color);
    if (!model) throw new Error(`${key}: no model photo in ${color}`);
    const c = (spec.p as { c?: number }).c;
    const svg = (await loadRenderer(spec.t))(spec, color, { sky: data.sky, city: c !== undefined ? data.places.byId(c) : undefined, places: data.places.list, ...(await prepareData(spec)) });
    const photoFile = path.join(PUBLIC, "models", `${model.id}.webp`);
    const buf = readFileSync(photoFile);
    stamps[key] = createHash("sha1").update(`${RECIPE}|${color}|${model.id}|${model.box.join()}|`).update(svg).update(buf).digest("hex").slice(0, 16);
    const outs = CARD_WIDTHS.map((w) => path.join(PUBLIC, cardPath(key, w)));
    if (old[key] === stamps[key] && outs.every((o) => existsSync(o))) continue;
    const photo = { ...(await sharp(buf).metadata()), buf };
    const print = await flat(svg, color);
    const crop = chestBox(model.box);
    for (const [i, w] of CARD_WIDTHS.entries()) {
      // The whole picture at the size that makes the crop w wide, then the crop.
      const full = Math.round(w / crop.w);
      const fullH = Math.round((full * photo.height!) / photo.width!);
      const pic = await mockup(color, print, full, photo, model.box);
      const h = Math.round((w * 4) / 3);
      const left = Math.min(full - w, Math.max(0, Math.round(crop.x * full)));
      const top = Math.min(fullH - h, Math.max(0, Math.round(crop.y * fullH)));
      const out = await sharp(pic).extract({ left, top, width: Math.min(w, full), height: Math.min(h, fullH) }).resize(w, h, { fit: "cover" }).webp({ quality: 76, effort: 4 }).toBuffer();
      mkdirSync(path.dirname(outs[i]), { recursive: true });
      writeFileSync(outs[i], out);
    }
    baked++;
  }
  mkdirSync(path.dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, JSON.stringify(stamps));
  console.log(`make cards: ${baked} of ${cards().length} baked (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
