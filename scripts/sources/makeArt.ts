/**
 * Artwork for the Make prints (Your Dinosaur's plates, Your Landmarks'
 * drawings): a named list of pictures, each fetched, prepared and traced to
 * one-ink vector outlines the templates draw as SVG paths, then measured.
 * Numbers only in the output; no picture is looked at here (docs/content/waves.md):
 * which page is the plate, which way up it goes and which marks are its
 * printed words all come from the scan's own OCR record.
 *
 *   tsx scripts/sources/makeArt.ts <set> [id…]        dinosaurs | landmarks; only the ids given, when any
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
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  if (!item.ia) return { id: item.id, error: "no source" };
  const xml = await getText(`https://archive.org/download/${item.ia}/${item.ia}_djvu.xml`);
  if (!xml) return { id: item.id, error: "no OCR record" };
  const pages = pagesOf(xml);
  const find = item.find ?? [];
  const terms = find.map((f) => f.toUpperCase());
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
  if (!page) return { id: item.id, error: `no page with ${find.join(" ")}` };
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
  const t = await traceAndMeasure(set, item, cleaned, "ink", path.join(dir(ROOT, "data", "art", set), `${item.id}.json`));
  if ("error" in t) return { id: item.id, error: t.error };
  const { traced, numbers, out } = t;
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
    passes: passes(numbers),
  };
}

type Checks = { color: "black" | "white"; quality: number; flags: string[]; solid: unknown }[];
const passes = (numbers: Checks) => numbers.every((n) => n.quality >= WEAK_QUALITY && !n.flags.length && !n.solid);

/**
 * A cleaned picture to its master (prepImage, as every print's), traced (a
 * line picture: vectorise.py) or screened (a photograph: dots.py), and the
 * result measured alone on both tees (for a landmark, in the frame its print
 * gives it).
 */
async function traceAndMeasure(set: string, item: ArtItem, cleaned: string, mode: "ink" | "photo", out: string) {
  const prepped = await prepImage(mode, cleaned, "");
  if (!prepped || prepped === "needs-cut") return { error: "no print from the picture" };
  const master = path.join(dir(CACHE, "prep"), `${path.basename(out, ".json")}-${mode}.webp`);
  writeFileSync(master, prepped.webp);
  const py = (script: string, extra: string[]) => JSON.parse(execFileSync(process.env.PYTHON ?? "python3", [path.join(ROOT, "scripts", "sources", script), master, out, ...extra], { encoding: "utf8" }).trim().split("\n").pop()!);
  // A picture that traces to nothing (all paper after the threshold) is no candidate.
  let traced;
  try {
    traced = mode === "ink" ? py("vectorise.py", ["--min-area", String(item.minArea ?? 6), "--eps", String(item.eps ?? 0.7), "--grow", String(item.grow ?? 0), "--scale", String(item.scale ?? 1)]) : py("dots.py", ["--pitch", "18"]);
  } catch {
    return { error: "nothing to trace" };
  }
  const art = JSON.parse(readFileSync(out, "utf8")) as ArtFile;
  const framed = set === "landmarks";
  const svg = (color: "black" | "white") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400"><rect width="300" height="400" fill="${color === "black" ? "#000" : "#fff"}"/>${framed ? `<rect x="40" y="60" width="220" height="240" fill="none" stroke="#FFFFFF" stroke-width="1.4"/>` : ""}${artSvg(art, framed ? 52 : 20, framed ? 72 : 60, framed ? 196 : 260, framed ? 216 : 280)}</svg>`.replaceAll("#FFFFFF", color === "black" ? "#FFFFFF" : "#000000");
  const numbers: Checks = (["black", "white"] as const).map((c) => {
    const r = svgInk(svg(c), c);
    const a = assessPrint(r);
    return { color: c, quality: a.quality, flags: a.flags, solid: solidBlock(r).reject };
  });
  return { traced, numbers, out };
}

const API = "https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&origin=*";
const strip = (s: unknown) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
/** Drawn, not photographed: the metadata's words for an engraving, an etching, a drawing. */
const DRAWN = /engrav|gravure|etching|eau-forte|lithograph|woodcut|holzstich|kupferstich|stahlstich|drawing|dessin|line art|illustration/i;
/** Not the landmark whole, by day, alone: plans, details, interiors, night views, souvenirs, signs, people and boats. */
const AVOID = /tramway|locomotive|railway|baldwin|portret|portrait|retrato|kardinaal|cardinal|\bmule|donkey|\bdial\b|são joão|baptist|catarina|worker|\bchart\b|admiralty|columns?\b|capital|fragment|relief|\bjews\b|\bmen\b|women|figures|ascent|climb|opening of|ferry|passes|passing|steamer|immigrant|\bbell\b|found[a-z]*ry|lego|stereo|headlights|multiview|pool of|fleet|warship|election|pageant|queen|king|opens|visitors|pilgrim|soldier|family|children|camel|caravan|\bboats?\b|ships?\b|khirbet|painting|oil on|canvas|google art project|fresco|battle|neemt|takes the city|holy family|virgin|madonna|saint|praying|prayer|procession|market|\bplans?\b|\bmaps?\b|interior|inside|\bsection|montage|compar|stamp|postcard|carte postale|\bcoin|medal|ticket|poster|advert|night|nuit|illuminat|fireworks|portrait|crowd|people|tourists|construction|escalier|ascenseur|detail|close-?up|souvenir|logo|\bsign\b|model|lego|replica|miniature|aerial|satellite|panorama|\bmenu\b|cover/i;

interface Found { title: string; url: string; record: string; w: number; h: number; mime: string; license: string; artist: string; date: string; desc: string; score: number; drawn: boolean }

/** Commons files for a landmark, by the numbers only: licence first, then the words (drawn, old, whole, named), then size. */
async function commonsCandidates(item: ArtItem): Promise<Found[]> {
  const must = new RegExp(item.commons!.must, "i");
  const seen = new Map<string, Found>();
  for (const q of item.commons!.queries) {
    const url = `${API}&action=query&generator=search&gsrnamespace=6&gsrlimit=40&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1400&iiextmetadatafilter=LicenseShortName|UsageTerms|License|Artist|DateTimeOriginal|ImageDescription|Copyrighted`;
    const r = await getJson<any>("wikimedia", url);
    // Commons asks for a slow pace: a request every few seconds (a cached one costs nothing).
    await new Promise((res) => setTimeout(res, 1500));
    for (const p of r?.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      if (!ii || seen.has(p.title) || !/^image\/(jpeg|png|tiff)$/.test(ii.mime) || Math.min(ii.width, ii.height) < 700) continue;
      const m = ii.extmetadata ?? {};
      const v = (k: string) => strip(m[k]?.value);
      const lic = judgeLicense("wikimedia", { license: v("LicenseShortName") || v("License"), rights: [v("UsageTerms"), v("Copyrighted") === "False" && !(v("LicenseShortName") || v("License")) ? "public domain" : ""].filter(Boolean).join(" | ") });
      if (!lic.ok) continue;
      const words = `${p.title} ${v("ImageDescription")}`;
      if (!must.test(words)) continue;
      const year = Number(/\b(1[5-9]\d\d|20\d\d)\b/.exec(v("DateTimeOriginal"))?.[1] ?? 9999);
      const aspect = ii.width / ii.height;
      const drawn = DRAWN.test(words);
      const view = /\b(view|vue|ansicht|veduta|elevation|facade|fa[cç]ade|general)\b/i.test(words) ? 1 : 0;
      if (AVOID.test(words)) continue;
      // Filed under the landmark's own category (deepcat, incategory): the subject as Commons' editors see it.
      const filed = /cat:"/.test(q) ? 2 : 0;
      const score = filed + view + (drawn ? 3 : 0) + (year < 1930 ? 2 : 0) + (must.test(p.title) ? 2 : 0) + (ii.width >= 1500 ? 1 : 0) - (aspect > 2.2 || aspect < 0.4 ? 2 : 0);
      seen.set(p.title, { title: p.title, url: ii.thumburl ?? ii.url, record: ii.descriptionurl, w: ii.width, h: ii.height, mime: ii.mime, license: lic.license, artist: v("Artist").slice(0, 80), date: v("DateTimeOriginal").slice(0, 40), desc: v("ImageDescription").slice(0, 160), score, drawn });
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/** A landmark from Commons: its best few candidates by the words, each converted and measured, the best by the checks kept. */
async function makeCommons(set: string, item: ArtItem, log: (m: string) => void) {
  const found = (await commonsCandidates(item)).filter((f) => f.score > 0).slice(0, 3);
  if (!found.length) return { id: item.id, error: "no public-domain or CC0 picture found" };
  const tried = [];
  for (const [k, f] of found.entries()) {
    // The download cached by the file (its title), so a later run with other candidates never reads the wrong one.
    const jpg = path.join(dir(CACHE, "jpg"), `commons-${createHash("sha1").update(f.title).digest("hex").slice(0, 16)}.jpg`);
    if (!(await download(f.url, jpg))) continue;
    await new Promise((res) => setTimeout(res, 3000));
    const cleaned = path.join(dir(CACHE, "clean"), `${item.id}-${k}.jpg`);
    const buf = await sharp(jpg).flatten({ background: "#ffffff" }).jpeg({ quality: 95 }).toBuffer();
    // A drawing is cropped to its marks and its tones stretched, as a plate is; a photograph goes whole.
    if (f.drawn) await sharp(buf).extract(await inkBox(buf)).normalise({ lower: 0.5, upper: 60 }).jpeg({ quality: 95 }).toFile(cleaned);
    else writeFileSync(cleaned, buf);
    const out = path.join(dir(CACHE, "try"), `${item.id}-${k}.json`);
    const t = await traceAndMeasure(set, { ...item, grow: f.drawn ? 1 : 0 }, cleaned, f.drawn ? "ink" : "photo", out);
    if ("error" in t) continue;
    tried.push({ k, f, ...t, bytes: readFileSync(out).length });
    log(`${set}/${item.id}: candidate ${k} ${f.title} score ${f.score} ${JSON.stringify(t.traced)} ${JSON.stringify(t.numbers)}`);
  }
  // Passing the checks first, then a drawing before a photograph (the print is a journal of drawings), then the stronger print, then the lighter file.
  const best = tried.sort((a, b) => Number(passes(b.numbers)) - Number(passes(a.numbers)) || Number(b.f.drawn) - Number(a.f.drawn) || Math.min(...b.numbers.map((n) => n.quality)) - Math.min(...a.numbers.map((n) => n.quality)) || a.bytes - b.bytes)[0];
  if (!best) return { id: item.id, error: "no candidate converted" };
  const out = path.join(dir(ROOT, "data", "art", set), `${item.id}.json`);
  writeFileSync(out, readFileSync(best.out));
  copyFileSync(path.join(CACHE, "clean", `${item.id}-${best.k}.jpg`), path.join(CACHE, "clean", `${item.id}.jpg`));
  const f = best.f;
  return {
    id: item.id,
    name: item.name,
    source: { title: f.title.replace(/^File:/, ""), author: f.artist, year: Number(/\b(1[5-9]\d\d|20\d\d)\b/.exec(f.date)?.[1] ?? 0) || undefined, plate: f.drawn ? "drawing" : "photograph", record: f.record, commons: f.title },
    license: f.license,
    licenseLabel: LICENSE_LABEL[f.license as keyof typeof LICENSE_LABEL],
    turned: 0,
    traced: best.traced,
    bytes: readFileSync(out).length,
    checks: best.numbers,
    passes: passes(best.numbers),
    candidates: tried.map((c) => ({ title: c.f.title, score: c.f.score, quality: c.numbers.map((n) => n.quality), bytes: c.bytes })),
  };
}

async function main() {
  const set = process.argv[2] as keyof typeof ART_SETS;
  const items = ART_SETS[set];
  if (!items) throw new Error(`no set ${set}`);
  const log = logger("archiveorg");
  // Only these, merged into the set's record (the rest kept as they were).
  const only = process.argv.slice(3);
  const file = path.join(ROOT, "data", "art", `${set}.json`);
  const rows: { id: string }[] = only.length && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  for (const item of items.filter((i) => !only.length || only.includes(i.id))) {
    const r = await (item.commons ? makeCommons(set, item, log) : makeItem(set, item, log)).catch((e) => ({ id: item.id, error: String(e).slice(0, 160) }));
    // A picture that failed this time leaves nothing of an earlier run behind.
    if ("error" in r) rmSync(path.join(ROOT, "data", "art", set, `${item.id}.json`), { force: true });
    const at = rows.findIndex((x) => x.id === item.id);
    if (at >= 0) rows[at] = r;
    else rows.push(r);
    console.log("error" in r ? `${item.id}: ${r.error}` : `${item.id}: ${r.traced.rings} rings, ${r.traced.points} points, ${(r.bytes / 1024).toFixed(0)} KB, quality ${r.checks.map((c) => c.quality).join("/")}${r.passes ? "" : " (refused by the checks)"}`);
  }
  rows.sort((a, b) => items.findIndex((i) => i.id === a.id) - items.findIndex((i) => i.id === b.id));
  writeFileSync(file, `${JSON.stringify(rows, null, 1)}\n`);
}
main().catch((e) => (console.error(e), process.exit(1)));
