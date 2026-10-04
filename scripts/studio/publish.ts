/**
 * The studio's designs into the catalogue (docs/content/studio.md, step 5):
 * each delivered folder (data/studio/<NN>-<slug>, data/studio/run50/<KK>-<slot>-<slug>,
 * data/studio/run50b/<KK>-<slot>-<slug>, data/studio/sdxl50/<KK>-<slot>-<slug>)
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
 *
 * Runs after sdxl50 are gated (scripts/studio/briefs/rules.md, review-designers.md): only the
 * designs five designer reviews approved (data/studio/<run>/review/approved.json, written by
 * scripts/studio/approve.ts) are published; their quality is the reviews' average × 10, their
 * tee colours come from print.json (the designer's tees / teeDefault; without them, the print's own
 * measures: only an outline drawing prints in white ink on a black tee), the full-resolution print is kept for production
 * (assets/prints-hd), a print under 20 cm wide and 30 cm tall stays out, and a run may not
 * bring more than two designs of one family. The runs before stay exactly as they were.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { CATEGORY_LABELS, SHIRT_CATEGORIES, type BaseColor, type FeatureKey, type ShirtCategory } from "../../types/shirt";
import { assessPrint, rasterInk } from "../gen/quality";

const ROOT = path.resolve(__dirname, "..", "..");
const STUDIO = path.join(ROOT, "data", "studio");
export const STUDIO_FIRST_N = 20001;
export const STUDIO_MANIFEST = path.join(STUDIO, "catalogue.json");
/** The screen's record (scripts/photos/halftone.py's): every raster print's original and the print made from it. */
const HALFTONE = path.join(ROOT, "data", "curation", "halftone.json");
const MASTERS = path.join(ROOT, "assets", "masters");
/** The full-resolution print (300 DPI, 1-bit) of a gated run's design, for production: the shop's 1500 × 2000 is for the screen. */
const PRINTS_HD = path.join(ROOT, "assets", "prints-hd");
/** The runs published before the designers' gate: they stay exactly as they were (no back-fixing). */
export const UNGATED_RUNS = ["run50", "run50b", "sdxl50"];
/** A gated run's design is approved at this average review score or above (and fewer than three DELETE votes). */
export const APPROVE_AVERAGE = 6.5;
/** At most this many designs of one family per run. */
export const PER_FAMILY = 2;
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
  /** The model that drew it when it isn't the studio's first (SSD-1B): "sdxl" for SDXL base 1.0 with SDXL-Lightning; "code" for a drawing made in code (no image model); "gemini" for Google Gemini (Gemini 3 Pro Image); "archive" for a public-domain work traced and set by MONO (no image model; the details' Credit line names the work and the museum). */
  model?: "sdxl" | "code" | "gemini" | "archive";
  /** An archive work's source and licence, from its details' "Credit and source" and "Licence" lines (an open licence such as CC BY needs the credit shown). */
  credit?: string;
  licence?: string;
  /** The designer's own taste features (print.json "features"), over the studio's defaults in the generator. */
  features?: Partial<Record<FeatureKey, number>>;
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

/**
 * A gated design offered on both tees (an outline drawing) leads with the one it reads best on: dense pen work
 * (ink over 15% of the print) the white tee, as ink drawn on paper; sparse line work the black, a chalk line on
 * dark cloth. The other tee stays on offer.
 */
export const BOTH_WHITE_ABOVE = 0.15;

/** A gated run's review decision (scripts/studio/approve.ts). */
export interface Approval {
  run: string;
  approvedAt: string;
  designs: Record<string, { average: number; deleteVotes: number; family: string; approved: boolean; why: string }>;
}

/** What oneink.py measured on the print (delivered beside it). */
export interface PrintMeasures {
  mode: string;
  coverage: number;
  solid: number;
  sizeCm: [number, number];
  blackTee: boolean;
  fails: string[];
  /**
   * The designer's call, from this build process on (older deliveries lack it and keep the rule below):
   * "both" when the print still reads in white ink on black (type, silhouettes, line drawings — ink is
   * shape, not shadow), "white" or "black" when it is made for one tee only.
   */
  tees?: "both" | "white" | "black";
  /** With tees "both": the tee it leads with, picked to keep the shop's defaults balanced (scripts/studio/teeBalance.ts). */
  teeDefault?: BaseColor;
  /**
   * What the design is, for the recommender (0..1 per feature): the designer's call, over the studio's defaults
   * (which describe an archive plate: classic, pictorial, no type, no wit). Only the keys that differ are needed.
   */
  features?: Partial<Record<FeatureKey, number>>;
}

/**
 * A gated design's tees: the designer's call when print.json carries one (tees, teeDefault); otherwise the
 * earlier rule — an outline drawing on both (dense ink leads with white), anything shaded on white alone.
 */
export function gatedTees(m: Pick<PrintMeasures, "blackTee" | "coverage" | "tees" | "teeDefault">): { baseColor: BaseColor; single: boolean } {
  if (m.tees === "both") return { baseColor: m.teeDefault ?? "white", single: false };
  if (m.tees === "white" || m.tees === "black") return { baseColor: m.tees, single: true };
  if (!m.blackTee) return { baseColor: "white", single: true };
  return { baseColor: m.coverage > BOTH_WHITE_ABOVE ? "white" : "black", single: false };
}

/** A gated design's shop category from its details' Category line (a shop label or key); Botanical & Nature otherwise. */
export function gatedCategory(label: string): ShirtCategory {
  const l = label.trim().toLowerCase();
  const byKey = SHIRT_CATEGORIES.find((c) => c === l);
  if (byKey) return byKey;
  const byLabel = SHIRT_CATEGORIES.find((c) => CATEGORY_LABELS[c].toLowerCase() === l);
  return byLabel ?? "specimens";
}

/** Too small to sell: under 20 cm wide and under 30 cm tall. */
export const tooSmall = ([w, h]: [number, number]) => w < 20 && h < 30;

/** An SDXL design's category: slot 1 study sheet, 2 elevation, 3 street, 4 patent sheet on black. */
function sdxlCategory(dir: string, label: string): ShirtCategory {
  const slot = /^\d{2}-(\d)-/.exec(path.basename(dir))?.[1];
  if (slot === "1") return "specimens";
  if (slot === "3") return "architecture";
  if (slot === "2") return /architecture/i.test(label) ? "architecture" : /sky/i.test(label) ? "sky" : "etched";
  return /sky/i.test(label) ? "sky" : "etched";
}

/** The details file (guidelines, section 08) as fields. */
function details(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Za-z ]+):\s*(.*)$/.exec(line.trim());
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

const runFolders = (name: string) =>
  existsSync(path.join(STUDIO, name))
    ? readdirSync(path.join(STUDIO, name)).filter((d) => /^\d{2}-\d-/.test(d)).sort().map((d) => path.join("data", "studio", name, d))
    : [];

/** A gated run's review decision, if the designers have reviewed it. */
export function approvalOf(run: string): Approval | null {
  const file = path.join(STUDIO, run, "review", "approved.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Approval) : null;
}

/** The gated runs with a review decision, in the order they were approved (so a new run never moves an older run's ids). */
export function gatedRuns(): string[] {
  return readdirSync(STUDIO, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !UNGATED_RUNS.includes(e.name) && !/^\d{2}-/.test(e.name) && runFolders(e.name).length)
    .map((e) => ({ run: e.name, approval: approvalOf(e.name) }))
    .filter((r): r is { run: string; approval: Approval } => r.approval !== null)
    .sort((a, b) => a.approval.approvedAt.localeCompare(b.approval.approvedAt) || a.run.localeCompare(b.run))
    .map((r) => r.run);
}

/**
 * The delivered folders, in a fixed order: the trial's, then the run of fifty's, the second run's, SDXL's fifty
 * (all as they were), then each gated run's approved designs, runs in the order they were approved.
 */
export function folders(): string[] {
  const trial = readdirSync(STUDIO).filter((d) => /^\d{2}-/.test(d)).sort().map((d) => path.join("data", "studio", d));
  const gated = gatedRuns().flatMap((run) => {
    const approval = approvalOf(run)!;
    return runFolders(run).filter((dir) => approval.designs[path.basename(dir)]?.approved);
  });
  return [...trial, ...UNGATED_RUNS.flatMap(runFolders), ...gated];
}

/** A gated run brings at most PER_FAMILY designs of one family (approve.ts keeps the best; this guards a hand-edited decision). */
function checkFamilies(list: string[]) {
  const count = new Map<string, number>();
  for (const dir of list) {
    const run = runOf(dir);
    if (run === null || UNGATED_RUNS.includes(run)) continue;
    const family = approvalOf(run)!.designs[path.basename(dir)].family;
    const key = `${run}|${family}`;
    count.set(key, (count.get(key) ?? 0) + 1);
    if (count.get(key)! > PER_FAMILY) throw new Error(`${run}: more than ${PER_FAMILY} designs of the family "${family}"`);
  }
}

/** The run a folder belongs to (null for the trial's), and whether it is gated. */
const runOf = (dir: string) => (dir.split(path.sep).length > 3 ? dir.split(path.sep)[2] : null);

async function main() {
  const entries: StudioEntry[] = [];
  const halftone = JSON.parse(readFileSync(HALFTONE, "utf8")) as Record<string, Record<string, unknown>>;
  const list = folders();
  checkFamilies(list);
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
    const sdxl = dir.split(path.sep).includes("sdxl50");
    // SDXL's fifty go by their family (the folder's slot): study sheets of animals and plants, elevations and
    // streets as buildings (or engravings of machines), patent sheets of objects as engravings.
    const run = runOf(dir);
    const gated = run !== null && !UNGATED_RUNS.includes(run);
    const measures = gated ? (JSON.parse(readFileSync(path.join(abs, "print.json"), "utf8")) as PrintMeasures) : null;
    const review = gated ? approvalOf(run!)!.designs[path.basename(dir)] : null;
    if (measures && measures.fails.length) throw new Error(`${dir}: print.json fails ${measures.fails.join("; ")}`);
    if (measures && tooSmall(measures.sizeCm)) throw new Error(`${dir}: ${measures.sizeCm.join(" × ")} cm, too small to sell (20 cm wide or 30 cm tall)`);
    const category = gated ? gatedCategory(d.category ?? "") : (CATEGORY[slug] ?? (sdxl ? sdxlCategory(dir, d.category ?? "") : "specimens"));
    // The print at its own resolution (300 DPI on the 28 × 37 cm area), kept for the printer.
    if (gated) {
      mkdirSync(PRINTS_HD, { recursive: true });
      copyFileSync(src, path.join(PRINTS_HD, `print_${n}.png`));
    }
    if (!SHIRT_CATEGORIES.includes(category)) throw new Error(`${dir}: category ${category}`);
    const tees = (d["tee colours"] ?? "").replace(/\s*\(.*$/, "").trim();
    // An SDXL line design its maker offered on the white tee only (its negative on black didn't hold up).
    const whiteTee = sdxl && !tone && /^white$/i.test(tees);
    const tees2 = measures ? gatedTees(measures) : null;
    // Tonal work, or line work its maker offered on one tee only ("Black (printed in white …)"; SDXL's "White").
    const single = tees2 ? tees2.single : tone || whiteTee || /^black$/i.test(tees);
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
      baseColor: tees2 ? tees2.baseColor : whiteOnly || whiteTee ? "white" : "black",
      single,
      mode: tone ? "tone" : "line",
      quality: review ? Math.round(review.average * 10) : a.quality,
      printCm: a.printCm,
      coverage: Math.round(a.ink * 1000) / 1000,
      briefUrl: `${REPO}/${dir}/sources/brief.txt`,
      ...(measures?.features ? { features: measures.features } : {}),
      ...(gated && /^code$/i.test(d.model ?? "") ? { model: "code" as const } : gated && /^gemini$/i.test(d.model ?? "") ? { model: "gemini" as const } : gated && /^archive$/i.test(d.model ?? "") ? { model: "archive" as const, credit: d["credit and source"], licence: d.licence } : sdxl || (gated && /sdxl/i.test(d.model ?? "sdxl")) ? { model: "sdxl" as const } : {}),
    });
    console.log(`${n} ${dir} ${whiteOnly ? "tone/white" : tone ? "tone/black" : entries[entries.length - 1].single ? "line/black" : "line/both"} q${entries[entries.length - 1].quality} ${category} ${a.flags.length ? `flags ${a.flags.join(",")}` : ""}`);
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
