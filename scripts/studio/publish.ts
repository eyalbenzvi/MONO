/**
 * The studio's designs into the catalogue (docs/content/studio.md, step 5):
 * each delivered folder (data/studio/<NN>-<slug>, data/studio/run50/<KK>-<slot>-<slug>,
 * data/studio/run50b/<KK>-<slot>-<slug>)
 * becomes a print the shop serves, public/prints/print_<n>.webp (1500 × 2000, black
 * ink whose alpha is the ink, as the archive's), and an entry in
 * data/studio/catalogue.json that scripts/generateCatalog.ts reads (studioSet).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio/publish.ts
 *
 * Line work is one file, offered on both tees. Tonal work has two positives and the
 * shop one print a design: it is offered on the black tee (its -black positive), as
 * the studio's previews show it; a scene its maker delivered for the white tee alone
 * (only a -white positive: on black its ending reads as a bright patch) on the white tee. Numbers are fixed by the folder's order (20001 on,
 * scripts/sources/ranges.ts), so a re-run gives the same ids.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { SHIRT_CATEGORIES, type BaseColor, type ShirtCategory } from "../../types/shirt";
import { assessPrint, rasterInk, solidBlock } from "../gen/quality";

const ROOT = path.resolve(__dirname, "..", "..");
const STUDIO = path.join(ROOT, "data", "studio");
export const STUDIO_FIRST_N = 20001;
export const STUDIO_MANIFEST = path.join(STUDIO, "catalogue.json");
/** The screen's record (scripts/photos/halftone.py's): every raster print's original and the print made from it. */
const HALFTONE = path.join(ROOT, "data", "curation", "halftone.json");
const MASTERS = path.join(ROOT, "assets", "masters");
const sha16 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);
const REPO = "https://github.com/eyalbenzvi/MONO/blob/claude/tshirt-discovery-mvp-pc6mk9";

export interface StudioEntry {
  n: number;
  /** The delivery folder, from the repo root. */
  dir: string;
  title: string;
  category: ShirtCategory;
  subject: string;
  style: string;
  description: string;
  keywords: string[];
  baseColor: BaseColor;
  /** Line work prints on both tees; a tonal positive on its own. */
  single: boolean;
  mode: "line" | "tone";
  quality: number;
  printCm: { width: number; height: number };
  coverage: number;
  /** The brief behind it (prompt, seed, model). */
  briefUrl: string;
}

/**
 * The shop category of each design, by what it shows (the helpers' own Category lines
 * were loose: "Nature", "Maritime", a lantern filed as Photographs). Landscapes are
 * engravings, the sky is the sky, buildings architecture, the woodblock wave brush work.
 */
const CATEGORY: Record<string, ShirtCategory> = {
  patagonia: "etched", "pine-on-the-cliff": "etched", lighthouse: "architecture",
  "alpine-peak": "etched", "alpine-lake": "etched", "desert-cliffs": "etched", waterfall: "etched", "pine-forest-in-mist": "etched",
  "sea-stacks": "etched", "breaking-wave": "brush", "rocky-islet": "etched", "chalk-cliffs": "etched", "fishing-hut-on-stilts": "architecture",
  "full-moon": "sky", jupiter: "sky", iceberg: "etched", glacier: "etched",
  anchor: "etched", "oil-lantern": "etched", hourglass: "etched",
  // run50b
  volcano: "etched", "terraced-valley": "etched", savanna: "etched", "rock-pinnacles": "etched", "aurora-over-mountains": "etched",
  "lightning-storm": "etched", "meteor-shower": "sky", "total-solar-eclipse": "sky", "rocky-planet": "sky",
  windmill: "architecture", "hilltop-monastery": "architecture", "stone-cottage": "architecture", "old-castle": "architecture", "mountain-hut": "architecture",
  "vintage-camera": "etched", "coffee-pot": "etched", "aviator-goggles": "etched", "rope-knot": "etched",
};

/** The details file (guidelines, section 08) as fields. */
function details(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Za-z ]+):\s*(.*)$/.exec(line.trim());
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

/** The delivered folders, in a fixed order: the trial's, then the run of fifty's, then the second run's. */
export function folders(): string[] {
  const trial = readdirSync(STUDIO).filter((d) => /^\d{2}-/.test(d)).sort().map((d) => path.join("data", "studio", d));
  const run = (name: string) =>
    existsSync(path.join(STUDIO, name))
      ? readdirSync(path.join(STUDIO, name)).filter((d) => /^\d{2}-\d-/.test(d)).sort().map((d) => path.join("data", "studio", name, d))
      : [];
  return [...trial, ...run("run50"), ...run("run50b")];
}

async function main() {
  const entries: StudioEntry[] = [];
  const halftone = JSON.parse(readFileSync(HALFTONE, "utf8")) as Record<string, Record<string, unknown>>;
  const list = folders();
  for (const [k, dir] of list.entries()) {
    const abs = path.join(ROOT, dir);
    const files = readdirSync(abs);
    const txt = files.find((f) => f.endsWith(".txt"));
    if (!txt) throw new Error(`${dir}: no details file`);
    const d = details(path.join(abs, txt));
    const slug = txt.replace(/\.txt$/, "");
    // A tonal design's positive: the black tee's, or the white tee's when that is all its maker delivered.
    const whiteOnly = !files.includes(`${slug}-black.png`) && files.includes(`${slug}-white.png`);
    const tone = whiteOnly || files.includes(`${slug}-black.png`);
    const src = path.join(abs, whiteOnly ? `${slug}-white.png` : tone ? `${slug}-black.png` : `${slug}.png`);
    if (!existsSync(src)) throw new Error(`${dir}: no print file`);
    const n = STUDIO_FIRST_N + k;
    // The print area (28 × 37 cm at 300 DPI) to the shop's 1500 × 2000: ink is the alpha (either positive), the colour black.
    const alpha = await sharp(src).ensureAlpha().extractChannel("alpha").resize(1500, 2000, { fit: "fill", kernel: "lanczos3" }).raw().toBuffer();
    const rgba = Buffer.alloc(1500 * 2000 * 4);
    // Ink or no ink, nothing between (the catalogue's rule for a raster print): the resampled edge thresholded at half.
    for (let i = 0; i < 1500 * 2000; i++) rgba[i * 4 + 3] = alpha[i] >= 128 ? 255 : 0;
    const printFile = path.join(ROOT, "public", "prints", `print_${n}.webp`);
    await sharp(rgba, { raw: { width: 1500, height: 2000, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(printFile);
    // The original kept beside it (assets/masters, as every raster print's is): the picture the model made.
    const original = readdirSync(path.join(abs, "sources")).find((f) => f.endsWith(".png"));
    if (!original) throw new Error(`${dir}: no source picture in sources/`);
    const master = path.join(MASTERS, `print_${n}.webp`);
    await sharp(path.join(abs, "sources", original)).webp({ quality: 92, effort: 6 }).toFile(master);
    halftone[n] = { mode: tone ? "halftone" : "line", paper: 0, sha: sha16(printFile), src: sha16(master), via: "scripts/studio/oneink.py" };
    // The measures the generator scores a raster print by (the 300 × 400 check).
    const small = await sharp(rgba, { raw: { width: 1500, height: 2000, channels: 4 } }).resize(300, 400, { fit: "fill", kernel: "cubic" }).ensureAlpha().raw().toBuffer();
    const raster = rasterInk(small, 300, 400, "ink", "black");
    const a = assessPrint(raster);
    // The solid-block check at the print's own size, as the catalogue runs it (scripts/tools/blockCheck): shrunk, a halftone's mesh averages into a false slab.
    const block = solidBlock(rasterInk(rgba, 1500, 2000, "ink", "black"));
    if (block.reject) throw new Error(`${dir}: the solid-block check refuses it (${block.reject})`);
    const category = CATEGORY[slug] ?? "specimens";
    if (!SHIRT_CATEGORIES.includes(category)) throw new Error(`${dir}: category ${category}`);
    const keywords = (d.keywords ?? "").split(/[,;]/).map((w) => w.trim()).filter(Boolean);
    entries.push({
      n,
      dir,
      title: d.title,
      category,
      subject: d.subject || d.title,
      style: d.style || "Illustration",
      description: d.description,
      keywords,
      baseColor: whiteOnly ? "white" : "black",
      // Tonal work, or line work its maker offered on black only ("Black (printed in white …)").
      single: tone || /^black$/i.test((d["tee colours"] ?? "").replace(/\s*\(.*$/, "").trim()),
      mode: tone ? "tone" : "line",
      quality: a.quality,
      printCm: a.printCm,
      coverage: Math.round(a.ink * 1000) / 1000,
      briefUrl: `${REPO}/${dir}/sources/brief.txt`,
    });
    console.log(`${n} ${dir} ${whiteOnly ? "tone/white" : tone ? "tone/black" : entries[entries.length - 1].single ? "line/black" : "line/both"} q${a.quality} ${category} ${a.flags.length ? `flags ${a.flags.join(",")}` : ""}`);
  }
  writeFileSync(STUDIO_MANIFEST, `${JSON.stringify(entries, null, 1)}\n`);
  // The record is scripts/photos/halftone.py's (json.dump, indent 0, keys sorted as strings, floats as 0.0): every other
  // entry is kept as its text, the studio's are written in the same form, so neither tool's run diffs the other's.
  const blocks = new Map<string, string>();
  for (const m of readFileSync(HALFTONE, "utf8").matchAll(/"(\d+)": \{[^}]*\}/g)) blocks.set(m[1], m[0]);
  for (const e of entries) {
    const r = halftone[e.n] as Record<string, unknown>;
    const fields = Object.keys(r).sort().map((k) => `${JSON.stringify(k)}: ${k === "paper" ? "0.0" : JSON.stringify(r[k])}`);
    blocks.set(String(e.n), `"${e.n}": {\n${fields.join(",\n")}\n}`);
  }
  writeFileSync(HALFTONE, `{\n${[...blocks.keys()].sort().map((k) => blocks.get(k)).join(",\n")}\n}`);
  console.log(`${entries.length} studio designs → ${path.relative(ROOT, STUDIO_MANIFEST)}`);
}

if (require.main === module) void main();
