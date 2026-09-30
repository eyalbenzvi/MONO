/**
 * Artwork for the Make prints (Your Dinosaur's plates, Your Landmarks'
 * drawings): a named list of pictures, each fetched, prepared and traced to
 * one-ink vector outlines the templates draw as SVG paths, then measured.
 * Numbers only in the output; no picture is looked at here (docs/content/waves.md):
 * which page is the plate, which way up it goes and which marks are its
 * printed words all come from the scan's own OCR record.
 *
 *   tsx scripts/sources/makeArt.ts <set>        dinosaurs | landmarks
 *
 * Per item: the Internet Archive book's OCR (djvu.xml) finds the page whose
 * words hold the item's caption; the caption's words say which way the plate
 * is printed (a caption running down the left edge: the plate turned a
 * quarter clockwise on the page) and every printed word is blanked; the page
 * image (archive.org/download/<id>/page/n<i>) is turned upright; the master
 * is made as every ink print's is (scripts/archive prepImage); vectorise.py
 * traces it; the tracing drawn alone is measured by the catalogue's checks
 * (assessPrint, solidBlock). Writes data/art/<set>/<id>.json (the outlines)
 * and data/art/<set>.json (each item's source, licence and numbers), which
 * scripts/tools/publishCustom.ts publishes and scripts/review/artPage.ts shows
 * the owner.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prepImage } from "../archive/fetchArchive";
import { WEAK_QUALITY, assessPrint, solidBlock, svgInk } from "../gen/quality";
import { LICENSE_LABEL, judgeLicense } from "./_license";
import { ROOT, UA, cacheDir, download, getJson, logger } from "./_pipeline";
import { ART_SETS, type ArtItem } from "./artSets";
import { artSvg, type ArtFile } from "../../lib/custom/art";

const dir = (...p: string[]) => (mkdirSync(path.join(...p), { recursive: true }), path.join(...p));
const CACHE = dir(cacheDir("archiveorg"), "art");

/** A text file, cached like getJson's (the OCR records are large and never change). */
async function getText(url: string): Promise<string | null> {
  const file = path.join(CACHE, `${Buffer.from(url).toString("base64url").slice(-80)}.txt`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null);
    if (r?.ok) {
      const t = await r.text();
      writeFileSync(file, t);
      return t;
    }
    await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
  }
  return null;
}

interface Word { x0: number; y0: number; x1: number; y1: number; t: string }
interface Page { i: number; w: number; h: number; words: Word[] }

/** The book's pages from its OCR record: size and every word with its box (y down). */
function pagesOf(xml: string): Page[] {
  return [...xml.matchAll(/<OBJECT[^>]*>[\s\S]*?<\/OBJECT>/g)].map(([o], i) => {
    const w = Number(/width="(\d+)"/.exec(o)?.[1] ?? 0), h = Number(/height="(\d+)"/.exec(o)?.[1] ?? 0);
    const words = [...o.matchAll(/<WORD coords="(\d+),(\d+),(\d+),(\d+)[^"]*"[^>]*>([^<]*)<\/WORD>/g)].map((m) => {
      const [l, b, r, t] = m.slice(1, 5).map(Number);
      return { x0: Math.min(l, r), x1: Math.max(l, r), y0: Math.min(b, t), y1: Math.max(b, t), t: m[5] };
    });
    return { i, w, h, words };
  });
}

/** A printed word, not OCR's reading of line work: two or more letters, mostly letters. */
const isWord = (t: string) => (t.match(/[A-Za-z]/g)?.length ?? 0) >= 2 && (t.match(/[A-Za-z]/g)?.length ?? 0) / t.length >= 0.6;

/**
 * Which way the plate stands, from its caption's first word: wider than tall
 * reads across (upright); taller than wide runs down an edge, and that edge
 * is the plate's foot. Degrees for sharp (clockwise) to turn it upright.
 */
function uprightTurn(page: Page, caption: Word): 0 | 90 | 270 {
  if (caption.x1 - caption.x0 >= caption.y1 - caption.y0) return 0;
  return (caption.x0 + caption.x1) / 2 < page.w / 2 ? 270 : 90;
}

/** The share of a page's pixels that are marks (40 levels under the paper) outside its printed words' boxes. */
async function markShare(file: string, page: Page): Promise<number> {
  const { data, info } = await sharp(file).greyscale().resize(600).raw().toBuffer({ resolveWithObject: true });
  const k = info.width / page.w;
  const inWord = (x: number, y: number) => page.words.some((w) => x >= w.x0 * k - 3 && x <= w.x1 * k + 3 && y >= w.y0 * k - 3 && y <= w.y1 * k + 3);
  const paper = [...data].sort((a, b) => a - b)[Math.floor(data.length * 0.9)];
  let marks = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] < paper - 40 && !inWord(x, y)) marks++;
  return marks / data.length;
}

/** The box of a page's marks (40 levels or more under the paper's tone), leaving out the outer 0.5% of them on every side. */
async function inkBox(jpg: Buffer): Promise<{ left: number; top: number; width: number; height: number }> {
  const { data, info } = await sharp(jpg).greyscale().raw().toBuffer({ resolveWithObject: true });
  const paper = [...data].sort((a, b) => a - b)[Math.floor(data.length * 0.9)];
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < info.height; y += 2) for (let x = 0; x < info.width; x += 2) if (data[y * info.width + x] < paper - 40) xs.push(x), ys.push(y);
  const q = (v: number[], p: number) => v.sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * p))];
  const pad = 12;
  const left = Math.max(0, q(xs, 0.005) - pad), top = Math.max(0, q(ys, 0.005) - pad);
  const right = Math.min(info.width, q(xs, 0.995) + pad), bottom = Math.min(info.height, q(ys, 0.995) + pad);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/**
 * Which way a plate without its caption's words stands: from the printed
 * marks OCR read along its edges. A column of them down the left or right
 * margin (each box taller than wide, or stacked one under another) is a
 * caption printed sideways, and that side is the plate's foot; otherwise
 * it stands as printed.
 */
function edgeTurn(page: Page): 0 | 90 | 270 {
  const side = (left: boolean) => page.words.filter((w) => (left ? w.x1 < page.w * 0.15 : w.x0 > page.w * 0.85));
  const column = (ws: Word[]) => ws.length >= 3 && Math.max(...ws.map((w) => w.x1)) - Math.min(...ws.map((w) => w.x0)) < Math.max(...ws.map((w) => w.y1)) - Math.min(...ws.map((w) => w.y0));
  const [l, r] = [side(true), side(false)];
  if (column(r) && r.length >= l.length) return 90;
  if (column(l)) return 270;
  return 0;
}

async function makeItem(set: string, item: ArtItem, log: (m: string) => void) {
  const xml = await getText(`https://archive.org/download/${item.ia}/${item.ia}_djvu.xml`);
  if (!xml) return { id: item.id, error: "no OCR record" };
  const pages = pagesOf(xml);
  const terms = item.find.map((f) => f.toUpperCase());
  // The plate's own page: of the pages holding the caption (the list of plates and the page facing a plate hold it too),
  // the three with fewest words, and of those the one with the most marks once its words are blanked (measured).
  const textOf = (p: Page) => p.words.map((w) => w.t.toUpperCase()).join(" ").replace(/\s+/g, " ");
  const holding = pages.filter((p) => terms.every((f) => textOf(p).includes(f))).sort((a, b) => a.words.length - b.words.length).slice(0, 3);
  // A plate printed on its own leaf, its explanation facing it: the pages either side are candidates too.
  const found = [...new Set(holding.flatMap((p) => [p.i, p.i - 1, p.i + 1]))].filter((i) => pages[i]).map((i) => pages[i]);
  const best = async (list: Page[]) => {
    let page: Page | undefined, most = -1;
    for (const p of list) {
      const file = path.join(dir(CACHE, "jpg"), `${item.ia}-${p.i}.jpg`);
      if (!(await download(`https://archive.org/download/${item.ia}/page/n${p.i}_w2400.jpg`, file))) continue;
      const marks = await markShare(file, p);
      if (marks > most) (most = marks), (page = p);
    }
    return { page, most };
  };
  // A page holding the caption with a drawing on it (1% of it marks, or more) is the plate; failing that, the busiest page beside one.
  const own = await best(holding);
  const page = own.most >= 0.01 ? own.page : (await best(found)).page;
  if (!page) return { id: item.id, error: `no page with ${item.find.join(" ")}` };
  const first = terms[0].split(" ")[0];
  const caption = holding.includes(page) ? page.words.find((w) => w.t.toUpperCase().includes(first)) : undefined;
  const turn = caption ? uprightTurn(page, caption) : edgeTurn(page);
  const meta = await getJson<{ metadata: Record<string, unknown> }>("archiveorg", `https://archive.org/metadata/${item.ia}`);
  const md = meta?.metadata ?? {};
  const lic = judgeLicense("archiveorg", { license: (md.licenseurl as string) ?? null, rights: item.rights });
  if (!lic.ok) return { id: item.id, error: `licence: ${lic.reason}` };
  const jpg = path.join(dir(CACHE, "jpg"), `${item.ia}-${page.i}.jpg`);
  // Every printed word blanked (the scan's size may differ from the OCR's), then upright.
  const img = sharp(jpg);
  const { width = 0, height = 0 } = await img.metadata();
  const k = width / page.w;
  const pad = 8;
  const rects = page.words.filter((w) => isWord(w.t) || w.x0 < page.w * 0.1 || w.x1 > page.w * 0.9 || w.y0 < page.h * 0.08 || w.y1 > page.h * 0.92)
    .map((w) => `<rect x="${Math.round(w.x0 * k - pad)}" y="${Math.round(w.y0 * k - pad)}" width="${Math.round((w.x1 - w.x0) * k + 2 * pad)}" height="${Math.round((w.y1 - w.y0) * k + 2 * pad)}" fill="#fff"/>`);
  const cleaned = path.join(dir(CACHE, "clean"), `${item.id}.jpg`);
  const upright = await sharp(await img.composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects.join("")}</svg>`), top: 0, left: 0 }]).jpeg({ quality: 95 }).toBuffer())
    .rotate(turn)
    .jpeg({ quality: 95 })
    .toBuffer();
  // Cropped to the drawing (the box of the page's marks, their outer half-percent left out: dust, the gutter's shadow),
  // its tones stretched so a lightly printed plate's lines read as ink (the darkest half-percent black, the paper white).
  const box = await inkBox(upright);
  await sharp(upright).extract(box).normalise({ lower: 0.5, upper: 60 }).jpeg({ quality: 95 }).toFile(cleaned);
  const prepped = await prepImage("ink", cleaned, "");
  if (!prepped || prepped === "needs-cut") return { id: item.id, error: "no print from the page" };
  const master = path.join(dir(CACHE, "prep"), `${item.id}.webp`);
  writeFileSync(master, prepped.webp);
  const out = path.join(dir(ROOT, "data", "art", set), `${item.id}.json`);
  const traced = JSON.parse(execFileSync(process.env.PYTHON ?? "python3", [path.join(ROOT, "scripts", "sources", "vectorise.py"), master, out, "--min-area", String(item.minArea ?? 6), "--eps", String(item.eps ?? 0.7), "--grow", String(item.grow ?? 0)], { encoding: "utf8" }).trim().split("\n").pop()!);
  const art = JSON.parse(readFileSync(out, "utf8")) as ArtFile;
  // The tracing alone, as big as a print carries it, on both tees.
  const svg = (color: "black" | "white") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400"><rect width="300" height="400" fill="${color === "black" ? "#000" : "#fff"}"/>${artSvg(art, 20, 60, 260, 280).replaceAll("#FFFFFF", color === "black" ? "#FFFFFF" : "#000000")}</svg>`;
  const numbers = (["black", "white"] as const).map((c) => {
    const r = svgInk(svg(c), c);
    const a = assessPrint(r);
    return { color: c, quality: a.quality, flags: a.flags, solid: solidBlock(r).reject };
  });
  log(`${set}/${item.id}: page ${page.i}, turned ${turn}, ${JSON.stringify(traced)}, ${JSON.stringify(numbers)}`);
  return {
    id: item.id,
    name: item.name,
    source: { title: String(md.title ?? item.ia), author: item.author, year: item.year, plate: item.plate, record: `https://archive.org/details/${item.ia}/page/n${page.i}`, ia: item.ia, page: page.i },
    license: lic.license,
    licenseLabel: LICENSE_LABEL[lic.license],
    rights: item.rights,
    turned: turn,
    traced,
    bytes: readFileSync(out).length,
    checks: numbers,
    passes: numbers.every((n) => n.quality >= WEAK_QUALITY && !n.flags.length && !n.solid),
  };
}

async function main() {
  const set = process.argv[2] as keyof typeof ART_SETS;
  const items = ART_SETS[set];
  if (!items) throw new Error(`no set ${set}`);
  const log = logger("archiveorg");
  const rows = [];
  for (const item of items) {
    const r = await makeItem(set, item, log).catch((e) => ({ id: item.id, error: String(e).slice(0, 160) }));
    rows.push(r);
    console.log("error" in r ? `${item.id}: ${r.error}` : `${item.id}: ${r.traced.rings} rings, ${r.traced.points} points, ${(r.bytes / 1024).toFixed(0)} KB, quality ${r.checks.map((c) => c.quality).join("/")}${r.passes ? "" : " (refused by the checks)"}`);
  }
  writeFileSync(path.join(ROOT, "data", "art", `${set}.json`), `${JSON.stringify(rows, null, 1)}\n`);
}
main().catch((e) => (console.error(e), process.exit(1)));
