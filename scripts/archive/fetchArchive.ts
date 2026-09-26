/**
 * Builds the archive designs from Smithsonian Open Access (CC0). Needs the
 * network; run by hand, then commit data/archive/archive.json and the
 * prints public/prints/print_<n>.webp. The generator never fetches.
 *
 *   npx tsx scripts/archive/fetchArchive.ts candidates  # metadata → candidates per group
 *   npx tsx scripts/archive/fetchArchive.ts prep        # download, print, delete the download
 *   python scripts/photos/cutout.py <cut.txt> <cache>  # patent models: cut-outs (rembg)
 *   npx tsx scripts/archive/fetchArchive.ts prep        # again, with the cut-outs
 *   npx tsx scripts/archive/fetchArchive.ts sheet       # numbered contact sheets for review
 *   npx tsx scripts/archive/fetchArchive.ts select      # curation.ts → data/archive + prints
 *   npx tsx scripts/tools/topAlignPrints.ts             # every picture at the top of its print area
 *
 * Metadata and prints are cached in node_modules/.cache/mono-archive.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BUCKET } from "../photos/source";
import { ARCHIVE_FIRST_N, ARCHIVE_GROUPS, ARCHIVE_H, ARCHIVE_UNITS, ARCHIVE_W, type ArchiveGroup, type ArchiveSource, type ArchiveUnit } from "./source";
import { NAMES, REVIEWED, archiveOrder } from "./curation";
import { mulberry32, shuffle } from "../gen/core";

sharp.cache(false);
sharp.concurrency(2);

const ROOT = path.resolve(__dirname, "..", "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "mono-archive");
const OUT = path.join(ROOT, "data", "archive");
const mkdir = (d: string) => (mkdirSync(d, { recursive: true }), d);

type Measures = "tone" | "contrast" | "coverage" | "detail" | "box" | "name";
interface Candidate extends Omit<ArchiveSource, Measures> {
  media: string;
}
interface Prepped extends Candidate, Omit<Pick<ArchiveSource, Measures>, "name"> {
  score: number;
}

async function get(url: string, tries = 4): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404 || r.status === 403 || i >= tries) return r;
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
  }
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }));
}

/* ------------------------------------------------------------------ */
/* candidates                                                          */
/* ------------------------------------------------------------------ */

interface Rec {
  title: string;
  types: string[];
  topics: string[];
  blob: string;
  names: { label: string; content: string }[];
  date: string | null;
  credit: string;
  record: string;
  ids: string[];
}

function* records(unit: ArchiveUnit): Generator<Rec> {
  const dir = path.join(CACHE, "meta", unit);
  for (const f of readdirSync(dir).sort()) {
    for (const line of readFileSync(path.join(dir, f), "utf8").split("\n")) {
      if (!line) continue;
      let r: any;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const c = r.content ?? {};
      const d = c.descriptiveNonRepeating ?? {};
      // The image must be CC0 (the print is the image; a title is a fact).
      const ids = (d.online_media?.media ?? []).filter((m: any) => m.type === "Images" && m.usage?.access === "CC0" && m.idsId).map((m: any) => m.idsId as string);
      if (!ids.length) continue;
      const ix = c.indexedStructured ?? {};
      const ft = c.freetext ?? {};
      const text = (k: string) => (ft[k] ?? []).map((x: any) => x.content as string);
      const title = clean(d.title?.content ?? r.title ?? "");
      const types: string[] = [...(ix.object_type ?? []), ...text("objectType")];
      const topics: string[] = [...(ix.topic ?? []), ...(ix.culture ?? []), ...(ix.place ?? [])];
      const blob = [title, ...types, ...topics, ...text("setName"), ...text("physicalDescription"), ...text("notes").slice(0, 3)].join(" | ");
      yield {
        title,
        types,
        topics,
        blob,
        names: ft.name ?? [],
        date: text("date")[0] ?? null,
        credit: clean(text("creditLine")[0] ?? ""),
        record: d.record_ID,
        ids,
      };
    }
  }
}

const clean = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/** People (portraits, figures): the catalog prints no one's likeness. */
const PEOPLE = /\b(?:portrait|woman|women|man|men|girl|boy|child|children|actor|actress|courtesan|lady|ladies|nude|self-portrait|figure|beauty|buddha|bodhisattva|monk|family|couple|mr|mrs|miss|mother|father|son of|daughter|wife|husband|king|queen|emperor|empress|prince|princess|saint|madonna|christ|god|goddess|warrior|samurai|poet|scholar|sage|immortal|fisherman|farmer|peasant|dancer|bather|soldier|people|crowd|group of|staff|visitors|employees|secretary|president|dr|professor|director|luncheon|meeting|party|wedding|baby|infant|head of|bust|mask|profile|dead|death|war|battle|execution|lynch|slave)\b/i;

const has = (re: RegExp) => (r: Rec) => re.test(r.blob);
const not = (re: RegExp) => (r: Rec) => !re.test(r.blob);
const all = (...fs: ((r: Rec) => boolean)[]) => (r: Rec) => fs.every((f) => f(r));

const NATURE = /landscape|bird|flower|tree|plant|bamboo|fish|mountain|snow|river|water|moon|wave|pine|plum|blossom|animal|horse|crane|insect|autumn|winter|spring|summer|lake|sea|boat|bridge|waterfall|rock|grass|iris|lotus|chrysanthemum|peony|willow|tiger|dragon|monkey|deer|orchid|cloud|mist|shore|village|temple|pavilion|garden|duck|goose|heron|egret|sparrow|cat\b|dog\b|ox\b|buffalo/i;
const EAST_ASIA = /\b(?:china|chinese|japan|japanese|korea|korean)\b/i;
const PAINTING = /painting|album leaf|hanging scroll|handscroll|\bfan\b|ink on paper|ink on silk/i;
const PRINT = /etching|drypoint|lithograph|woodblock|woodcut|engraving|aquatint|mezzotint/i;
const PHOTO = /photograph|albumen|gelatin silver|platinum print|salted paper|cyanotype|daguerreotype|negative|lantern slide/i;
const PHOTO_SUBJECT = /landscape|architecture|boat|ship|city|building|bridge|mountain|river|tree|waterfall|street|railroad|train|tower|castle|hall|telescope|observatory|forest|zoo|animal|bird|harbor|lighthouse|canyon|geyser|glacier|desert|cactus|dam|mill|factory|locomotive|airship|balloon|aircraft|airplane|smithsonian institution building|castle|museum|exhibit hall|skeleton|fossil|specimen|shell|flower|plant|leaf|snow|ice|storm|cloud|sky|sea|ocean|shore|wave/i;

/** Which records each group draws from. */
const FILTERS: Record<ArchiveGroup, (r: Rec) => boolean> = {
  "ink-painting": all((r) => PAINTING.test(r.blob), has(NATURE), has(EAST_ASIA), not(PEOPLE), not(/calligraph|inscription only|sutra|seal|lacquer|ceramic|porcelain|bronze|jade|screen fragment/i)),
  "ukiyo-e": all(has(/woodblock|woodcut/i), has(/japan/i), not(PEOPLE), not(/calligraph|surimono.*poem/i)),
  "gallery-print": all(has(PRINT), not(EAST_ASIA), not(PEOPLE)),
  woodcut: all(has(/woodcut|wood engraving|linocut|linoleum/i), not(PEOPLE)),
  etching: all(has(/etching|lithograph|engraving|drypoint|aquatint/i), not(/woodcut|wood engraving|linocut/i), not(PEOPLE), not(PHOTO)),
  botanical: all(has(/botanical|botany|flower|plant|leaf|leaves|fern|seaweed|algae|blossom|rose|lily|tulip|orchid/i), has(/drawing|watercolor|print|engraving|lithograph|etching|graphite|ink|cyanotype|photogram|nature print/i), not(PEOPLE), not(/sculpture|painting on canvas|oil on/i)),
  "art-photo": all(has(PHOTO), has(PHOTO_SUBJECT), not(PEOPLE)),
  "archive-photo": all(has(PHOTO), has(PHOTO_SUBJECT), not(PEOPLE), not(/correspondence|\bletter\b|\bgraph\b|\bmap of\b/i)),
  locomotion: all(has(/muybridge|animal locomotion/i), has(/horse|dog|cat\b|bird|pig|mule|ox\b|deer|buffalo|elephant|camel|lion|tiger|kangaroo|goat|donkey|cockatoo|pigeon|eagle|hawk|baboon|sloth|raccoon|capybara|tapir|gnu|elk|antelope|emu|ostrich|vulture|crane|jumping|galloping|trotting|pacing|walking/i), not(/woman|man |men |child|boy|girl|nude|athlete|model|ataxia|locomotor|patient|spastic|paraplegi/i)),
  patent: all(has(/patent model/i), not(PEOPLE)),
  ornament: all(has(/lace|border|ornament|frieze|pattern|design for|engraving|etching|sidewall|textile design|drawing, design|arabesque|grotesque|rosette|trellis|scroll/i), has(/print|engraving|etching|drawing|lace|woodcut|lithograph|pen and|graphite|ink|stencil|paper/i), not(PEOPLE), not(/katagami|stencil|wallpaper|sample book|photograph|poster|advert|packaging|label|furniture|chair|table|glass|ceramic|metal|jewelry|clock|silver|textile fragment|woven|printed cotton|embroider|sampler|costume|dress|shoe/i)),
  stencil: all(has(/katagami|stencil/i), not(PEOPLE)),
};

/** How many candidates of each group are prepared for review (the best of them are kept). */
const PREP_CAP: Record<ArchiveGroup, number> = {
  "ink-painting": 520, "ukiyo-e": 160, "gallery-print": 389, woodcut: 167, etching: 700, botanical: 700, "art-photo": 308, "archive-photo": 600, locomotion: 0, patent: 150, ornament: 900, stencil: 86,
};

/** The bucket folder of an image: by its id's prefix (a museum's record can show another unit's image), else the unit's. */
function mediaDir(id: string, unit: ArchiveUnit): string {
  const prefix = id.split("-")[0].toUpperCase();
  const dirs: Record<string, string> = { SIA: "sia", NMAH: "nmah", FS: "fs", SAAM: "saam", CHSDM: "chsdm", NASM: "nasm", NPG: "npg" };
  return dirs[prefix] ?? ARCHIVE_UNITS[unit].dir;
}

function maker(r: Rec): string | null {
  const m = r.names.find((n) => /artist|photographer|maker|author|designer|engraver|inventor/i.test(n.label))?.content ?? null;
  if (!m) return null;
  const s = clean(m).replace(/,?\s*(american|japanese|chinese|french|english|german|british|dutch|italian|born|active|died|\d{4}).*$/i, "").replace(/\s*\([^)]*\)/g, "").trim();
  if (!s || /unknown|unidentified|anonymous|school|workshop|attributed|manufactur|company|inc\.|co\./i.test(s)) return null;
  // "Hokusai, Katsushika" stays as recorded; "Muybridge, Eadweard" → "Eadweard Muybridge".
  const parts = s.split(/\s*,\s*/);
  return parts.length === 2 && !/\s/.test(parts[0]) ? `${parts[1]} ${parts[0]}` : s;
}

export async function candidates() {
  const out: Candidate[] = [];
  const counts: Record<string, number> = {};
  const used = new Set<string>();
  for (const [group, g] of Object.entries(ARCHIVE_GROUPS) as [ArchiveGroup, (typeof ARCHIVE_GROUPS)[ArchiveGroup]][]) {
    const list: Candidate[] = [];
    for (const r of records(g.unit)) {
      if (!FILTERS[group](r) || used.has(r.record)) continue;
      used.add(r.record);
      list.push({
        key: r.ids[0],
        media: `media/${mediaDir(r.ids[0], g.unit)}/${r.ids[0]}.jpg`,
        group,
        unit: g.unit,
        title: r.title,
        maker: maker(r),
        date: r.date,
        credit: r.credit || ARCHIVE_UNITS[g.unit].name,
        record: r.record,
      });
    }
    counts[group] = list.length;
    out.push(...shuffle(mulberry32(0xa4c + group.length * 7919 + group.charCodeAt(0)), list.sort((a, b) => a.key.localeCompare(b.key))).slice(0, PREP_CAP[group]));
  }
  writeFileSync(path.join(mkdir(CACHE), "candidates.json"), JSON.stringify(out, null, 1));
  console.log(`candidates: ${out.length}`, counts);
}

/* ------------------------------------------------------------------ */
/* prep                                                                */
/* ------------------------------------------------------------------ */

function percentile(values: ArrayLike<number>, p: number, max = 256) {
  const hist = new Array(max).fill(0);
  for (let i = 0; i < values.length; i++) hist[values[i]]++;
  let acc = 0;
  const target = values.length * p;
  for (let i = 0; i < max; i++) if ((acc += hist[i]) >= target) return i;
  return max - 1;
}

const jpgFile = (key: string) => path.join(CACHE, "jpg", `${key}.jpg`);
const cutFile = (key: string) => path.join(CACHE, "cut", `${key}.png`);
const prepFile = (key: string) => path.join(CACHE, "prep", `${key}.webp`);

/** The picture fitted whole into the print area (never cropped), greyscale + alpha of where it is. */
async function placed(input: sharp.Sharp, fit: number): Promise<{ gray: Uint8Array; alpha: Uint8Array }> {
  const meta = await input.clone().metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const bw = (swap ? meta.height : meta.width) ?? 1;
  const bh = (swap ? meta.width : meta.height) ?? 1;
  const s = Math.min((ARCHIVE_W * fit) / bw, (ARCHIVE_H * fit) / bh);
  const tw = Math.max(1, Math.round(bw * s));
  const th = Math.max(1, Math.round(bh * s));
  const left = Math.round((ARCHIVE_W - tw) / 2);
  // Top-aligned (every picture starts the same distance below the collar; scripts/tools/topAlignPrints).
  const top = Math.round(ARCHIVE_H * 0.03);
  const { data, info } = await input
    .clone()
    .ensureAlpha()
    .resize(tw, th, { kernel: "lanczos3" })
    .extend({ top, left, bottom: ARCHIVE_H - th - top, right: ARCHIVE_W - tw - left, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = ARCHIVE_W * ARCHIVE_H;
  const ch = info.channels;
  const gray = new Uint8Array(n);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = Math.round(0.2126 * data[i * ch] + 0.7152 * data[i * ch + 1] + 0.0722 * data[i * ch + 2]);
    alpha[i] = data[i * ch + ch - 1];
  }
  return { gray, alpha };
}

/**
 * Ink: the paper's own tone, estimated locally (a wide max filter, then
 * smoothed — stains and uneven light drop out with it), is subtracted; what
 * is darker than the paper becomes ink, alpha = how much darker. The
 * faintest grain of the paper is cut, the darkest ink is full strength.
 */
function inkAlpha(gray: Uint8Array, where: Uint8Array): Uint8Array {
  const W = ARCHIVE_W, H = ARCHIVE_H, S = 10;
  const w = Math.ceil(W / S), h = Math.ceil(H / S);
  // Block maxima (the paper is the lightest thing around).
  let bg = new Float32Array(w * h);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (where[i] < 128) continue;
    const b = Math.floor(y / S) * w + Math.floor(x / S);
    bg[b] = Math.max(bg[b], percentileFree(gray[i]));
  }
  // Spread and smooth: max over 5×5 blocks, then a box blur (twice).
  const spread = (src: Float32Array, r: number, op: "max" | "mean") => {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let acc = op === "max" ? 0 : 0, cnt = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
        const v = src[yy * w + xx];
        if (v <= 0) continue;
        if (op === "max") acc = Math.max(acc, v);
        else (acc += v), cnt++;
      }
      out[y * w + x] = op === "max" ? acc : cnt ? acc / cnt : 0;
    }
    return out;
  };
  bg = spread(spread(spread(bg, 2, "max"), 3, "mean"), 3, "mean");
  const n = W * H;
  const dark = new Float32Array(n);
  const samples: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (where[i] < 128) continue;
    // Bilinear paper tone at this pixel.
    const fx = Math.min(w - 1.001, Math.max(0, x / S - 0.5)), fy = Math.min(h - 1.001, Math.max(0, y / S - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const p = bg[y0 * w + x0] * (1 - ax) * (1 - ay) + bg[y0 * w + x0 + 1] * ax * (1 - ay) + bg[(y0 + 1) * w + x0] * (1 - ax) * ay + bg[(y0 + 1) * w + x0 + 1] * ax * ay;
    const d = Math.max(0, (p - gray[i]) / Math.max(40, p));
    dark[i] = d;
    if ((x + y) % 3 === 0) samples.push(Math.round(d * 1000));
  }
  // Paper grain and the silk's own tone stay out; washes stay light, lines full strength.
  const lo = Math.max(0.08, percentile(samples, 0.5, 1001) / 1000 + 0.05);
  const hi = Math.max(lo + 0.25, percentile(samples, 0.995, 1001) / 1000);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (where[i] < 128) continue;
    const t = Math.min(1, Math.max(0, (dark[i] - lo) / (hi - lo)));
    alpha[i] = Math.round(Math.pow(t, 1.15) * 255);
  }
  return alpha;
}
const percentileFree = (v: number) => v;

/** The picture's own box (where it was placed on the print). */
function pictureBox(where: Uint8Array) {
  let x0 = ARCHIVE_W, y0 = ARCHIVE_H, x1 = -1, y1 = -1;
  for (let y = 0; y < ARCHIVE_H; y++) for (let x = 0; x < ARCHIVE_W; x++) if (where[y * ARCHIVE_W + x] > 128) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  return { x0, y0, x1, y1 };
}

/** The ground is dark when the picture's outer ring is (a light object photographed on black). */
function darkGround(gray: Uint8Array, where: Uint8Array): boolean {
  const { x0, y0, x1, y1 } = pictureBox(where);
  const ring: number[] = [];
  const b = Math.max(3, Math.round(Math.min(x1 - x0, y1 - y0) * 0.03));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < x0 + b || x > x1 - b || y < y0 + b || y > y1 - b) ring.push(gray[y * ARCHIVE_W + x]);
  return percentile(ring, 0.5) < 80;
}

/**
 * Page shadows, mounts, frames and a scan's dark edges print as bands along
 * the picture's sides. Ink connected to the picture's edge that lies mostly
 * in its outer margin is one of those, not the work: it is removed.
 */
function dropEdgeBands(alpha: Uint8Array, where: Uint8Array): Uint8Array {
  const W = ARCHIVE_W;
  const { x0, y0, x1, y1 } = pictureBox(where);
  const mx = (x1 - x0) * 0.12, my = (y1 - y0) * 0.12;
  const inMargin = (x: number, y: number) => x < x0 + mx || x > x1 - mx || y < y0 + my || y > y1 - my;
  const seen = new Uint8Array(W * ARCHIVE_H);
  const on = (i: number) => alpha[i] > 50;
  const stack: number[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!(x <= x0 + 2 || x >= x1 - 2 || y <= y0 + 2 || y >= y1 - 2)) continue;
      const start = y * W + x;
      if (seen[start] || !on(start)) continue;
      // One edge-connected component.
      const comp: number[] = [];
      let margin = 0;
      seen[start] = 1;
      stack.push(start);
      while (stack.length) {
        const i = stack.pop()!;
        comp.push(i);
        const cx = i % W, cy = (i - cx) / W;
        if (inMargin(cx, cy)) margin++;
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          const jx = j % W, jy = (j - jx) / W;
          if (jx < x0 || jx > x1 || jy < y0 || jy > y1 || seen[j] || !on(j)) continue;
          seen[j] = 1;
          stack.push(j);
        }
      }
      if (margin / comp.length > 0.6) for (const i of comp) alpha[i] = 0;
    }
  return alpha;
}

async function prepOne(c: Candidate): Promise<{ webp: Buffer; meta: Omit<Prepped, keyof Candidate> } | "needs-cut" | null> {
  const mode = ARCHIVE_GROUPS[c.group].mode;
  if (mode === "cut" && !existsSync(cutFile(c.key))) return "needs-cut";
  let gray: Uint8Array, alpha: Uint8Array;
  const n = ARCHIVE_W * ARCHIVE_H;
  if (mode === "cut") {
    // The rembg cut-out: faint residue dropped, trimmed to the solid object.
    const { data, info } = await sharp(cutFile(c.key)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, area = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const a = data[i * 4 + 3];
      data[i * 4 + 3] = a < 64 ? 0 : Math.round(((a - 64) / 191) * 255);
      if (data[i * 4 + 3] > 128) {
        const x = i % info.width, y = Math.floor(i / info.width);
        (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)), area++;
      }
    }
    if (x1 < 0 || area < info.width * info.height * 0.03) return null;
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
    ({ gray, alpha } = await placed(sharp(png), 0.9));
  } else {
    const src = sharp(jpgFile(c.key), { failOn: "none", limitInputPixels: false }).rotate();
    // Big scans: bring them down first (the print is 750 × 1000).
    const small = sharp(await src.resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 95 }).toBuffer());
    ({ gray, alpha } = await placed(small, 0.94));
  }
  let out: Uint8Array; // grey channel
  if (mode === "ink") {
    // Light marks on a dark ground (lace photographed on black): the marks are the ink.
    if (darkGround(gray, alpha)) for (let i = 0; i < n; i++) gray[i] = 255 - gray[i];
    alpha = dropEdgeBands(inkAlpha(gray, alpha), alpha);
    out = new Uint8Array(n); // black ink (the white-tee print; inverted for black)
  } else {
    const inside: number[] = [];
    for (let i = 0; i < n; i += 3) if (alpha[i] > 128) inside.push(gray[i]);
    const lo = percentile(inside, 0.005), hi = percentile(inside, 0.995);
    if (hi - lo < 50) return null;
    for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - lo) / (hi - lo)) * 255)));
    out = gray;
  }
  // Measures. For ink, "tone" is the ink's mean strength and coverage the inked share.
  let sum = 0, sq = 0, cover = 0, lap = 0, lapN = 0, pic = 0;
  let bx0 = ARCHIVE_W, by0 = ARCHIVE_H, bx1 = 0, by1 = 0;
  const W = ARCHIVE_W;
  const val = mode === "ink" ? alpha : out;
  for (let y = 1; y < ARCHIVE_H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const on = mode === "ink" ? alpha[i] > 40 : alpha[i] > 128;
    if (!on) continue;
    cover++;
    sum += val[i];
    sq += val[i] * val[i];
    (bx0 = Math.min(bx0, x)), (bx1 = Math.max(bx1, x)), (by0 = Math.min(by0, y)), (by1 = Math.max(by1, y));
    lap += Math.abs(4 * val[i] - val[i - 1] - val[i + 1] - val[i - W] - val[i + W]);
    lapN++;
  }
  for (let i = 0; i < n; i += 7) if (alpha[i] > 0 || mode === "ink") pic++;
  if (cover < n * 0.01) return null;
  const mean = sum / cover;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const la = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) (la[i * 2] = out[i]), (la[i * 2 + 1] = alpha[i]);
  // Ink is all in the alpha (the grey is flat black): a lighter alpha setting halves the file, with no visible change.
  const webp = await sharp(la, { raw: { width: ARCHIVE_W, height: ARCHIVE_H, channels: 2 } }).webp(mode === "ink" ? { quality: 50, alphaQuality: 50, effort: 6 } : { quality: 80, alphaQuality: 90, effort: 6 }).toBuffer();
  const contrast = Math.sqrt(Math.max(0, sq / cover - mean * mean)) / 255;
  const detail = Math.min(1, lap / Math.max(1, lapN) / 30);
  const coverage = cover / n;
  // Ink that is mostly a faint wash prints as a grey smear: it scores low.
  let faint = 0;
  if (mode === "ink") for (let i = 0; i < n; i += 5) if (alpha[i] > 40 && alpha[i] < 140) faint++;
  const fog = mode === "ink" ? faint / Math.max(1, cover / 5) : 0;
  const score = Math.min(1, detail * 1.5) * 0.35 + Math.min(1, contrast * 3.5) * 0.35 + Math.min(1, coverage / (mode === "ink" ? 0.15 : 0.4)) * 0.3 - fog * 0.4;
  void pic;
  return {
    webp,
    meta: {
      tone: r3(mean / 255),
      contrast: r3(contrast),
      coverage: r3(coverage),
      detail: r3(detail),
      box: [r3(bx0 / ARCHIVE_W), r3(by0 / ARCHIVE_H), r3((bx1 + 1) / ARCHIVE_W), r3((by1 + 1) / ARCHIVE_H)],
      score: r3(score),
    },
  };
}

async function prep() {
  const list: Candidate[] = JSON.parse(readFileSync(path.join(CACHE, "candidates.json"), "utf8"));
  const only = process.argv[3];
  mkdir(path.join(CACHE, "prep"));
  mkdir(path.join(CACHE, "jpg"));
  const donePath = path.join(CACHE, "prepped.json");
  const done: Record<string, Prepped | null> = existsSync(donePath) ? JSON.parse(readFileSync(donePath, "utf8")) : {};
  const needsCut: string[] = [];
  let k = 0;
  const todo = list.filter((c) => (!only || c.group === only) && !(c.key in done && (done[c.key] === null || existsSync(prepFile(c.key)))));
  console.log(`prep: ${todo.length} to do`);
  await pool(todo, 6, async (c) => {
    try {
      const mode = ARCHIVE_GROUPS[c.group].mode;
      if (!existsSync(jpgFile(c.key)) && !(mode === "cut" && existsSync(cutFile(c.key)))) {
        const r = await get(`${BUCKET}/${c.media}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        writeFileSync(jpgFile(c.key), Buffer.from(await r.arrayBuffer()));
      }
      const out = await prepOne(c);
      if (out === "needs-cut") return void needsCut.push(c.key);
      if (!out) {
        done[c.key] = null;
      } else {
        writeFileSync(prepFile(c.key), out.webp);
        done[c.key] = { ...c, ...out.meta };
      }
      // The download isn't kept (some scans are 100 MB+); cut-out sources stay until cut.
      if (mode !== "cut" || existsSync(cutFile(c.key))) rmSync(jpgFile(c.key), { force: true });
    } catch (e) {
      console.warn(`skip ${c.key}: ${(e as Error).message}`);
      done[c.key] = null;
    }
    if (++k % 50 === 0) {
      console.log(`  ${k}/${todo.length}`);
      writeFileSync(donePath, JSON.stringify(done));
    }
  });
  writeFileSync(donePath, JSON.stringify(done));
  writeFileSync(path.join(CACHE, "needs-cut.txt"), needsCut.join("\n"));
  const ok = Object.values(done).filter(Boolean).length;
  console.log(`prepped ${ok}; ${needsCut.length} need a cut-out (python scripts/photos/cutout.py ${path.relative(ROOT, path.join(CACHE, "needs-cut.txt"))} ${path.relative(ROOT, CACHE)})`);
}

/* ------------------------------------------------------------------ */
/* sheet                                                               */
/* ------------------------------------------------------------------ */

/** Prepared prints of the current candidates (their group as the candidates now have it). */
const prepped = (): Prepped[] => {
  const current = new Map((JSON.parse(readFileSync(path.join(CACHE, "candidates.json"), "utf8")) as Candidate[]).map((c) => [c.key, c]));
  return (Object.values(JSON.parse(readFileSync(path.join(CACHE, "prepped.json"), "utf8"))) as (Prepped | null)[])
    .filter((p): p is Prepped => !!p && current.has(p.key) && existsSync(prepFile(p.key)))
    .map((p) => ({ ...p, ...current.get(p.key)! }));
};

async function sheet() {
  const dir = mkdir(path.join(CACHE, "sheets"));
  const only = process.argv[3];
  for (const group of Object.keys(ARCHIVE_GROUPS) as ArchiveGroup[]) {
    if (only && only !== group) continue;
    const list = prepped().filter((p) => p.group === group).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const ink = ARCHIVE_GROUPS[group].mode === "ink";
    const cols = 10, TW = 150, TH = 200, cw = TW + 6, chh = TH + 18, per = 60;
    for (let page = 0; page * per < list.length; page++) {
      const part = list.slice(page * per, page * per + per);
      const rows = Math.ceil(part.length / cols);
      const composites = await Promise.all(part.map(async (p, i) => ({
        input: await sharp(prepFile(p.key)).flatten({ background: ink ? "#fff" : "#000" }).resize(TW, TH).png().toBuffer(),
        left: (i % cols) * cw + 3,
        top: Math.floor(i / cols) * chh + 3,
      })));
      const labels = part.map((p, i) => `<text x="${(i % cols) * cw + 4}" y="${Math.floor(i / cols) * chh + TH + 15}" font-size="10" font-family="DejaVu Sans" fill="#ff0">${page * per + i} ${p.title.replace(/[<&>"]/g, "").slice(0, 22)}</text>`).join("");
      const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * chh}"><rect width="100%" height="100%" fill="#555"/>${labels}</svg>`);
      await sharp(svg).composite(composites).png().toFile(path.join(dir, `${group}-${page}.png`));
    }
    // The numbers on the sheet → keys: the review (review.json) records keys.
    writeFileSync(path.join(dir, `${group}.json`), JSON.stringify(list.map((p, i) => [i, p.key, p.title])));
    console.log(`${group}: ${list.length} → ${Math.ceil(list.length / per)} sheets`);
  }
}

/* ------------------------------------------------------------------ */
/* select                                                              */
/* ------------------------------------------------------------------ */

/** "Landscape" (generic) or a second "Landscape": the maker, then a numeral, tells them apart. */
/** A maker as a credit: no dates, no bracketed notes, no script the card can't show ("Kano Tsunenobu 狩野常信 (1636–1713)" → "Kano Tsunenobu"). */
export function cleanMaker(m: string | null): string | null {
  if (!m) return null;
  const t = m.replace(/\s*\(.*$/, "").replace(/[^\p{Script=Latin}\s.'’-]/gu, "").replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();
  return t.length >= 3 ? t : null;
}

/**
 * The design's name from the record's title: what it shows, without
 * catalogue furniture — brackets, plate and catalogue numbers, "Untitled",
 * "Patent Model of a …" — and short enough for a card.
 */
export function archiveName(title: string, group: ArchiveGroup): string | null {
  // Latin script only (a card can't be sure to show others: "Two pheasants on a snow bank 雉図").
  let t = title.replace(/[“”]/g, '"').replace(/[^\p{Script=Latin}\p{P}\p{N}\p{Zs}]/gu, "").replace(/\s+/g, " ");
  // A title that is all brackets ("[Night-Blooming Cereus]") keeps its words.
  t = /^\[.*\]$/.test(t.trim()) ? t.trim().slice(1, -1) : t.replace(/\s*\[[^\]]*\]/g, "");
  t = t.replace(/\s*[:,]?\s*\bNo\.\s*\d+\b/gi, "").replace(/"/g, "").replace(/\s*\((?:\d+|from|plate|pl\.|no\.|recto|verso|unfinished)[^)]*\)/gi, "");
  t = t.replace(/^\(?untitled\s*(?:--|-|,|:)?\s*/i, "").replace(/^\((.*)\)$/, "$1").replace(/\)$/, (m) => (t.includes("(") ? m : ""));
  // Titles that say what the object is rather than what it shows.
  t = t.replace(/^(Album leaf|Hanging scroll|Handscroll|Fan|Folding fan|Print|Stencil|Katagami|Drawing|Design|Photograph|Photo|Negative|Lantern slide|Plate)\s*[,:;-]\s*/i, "");
  if (group === "patent") {
    t = t.replace(/^\d{4}\s*-?\s*/, "");
    const of = t.match(/^Patent Model (?:of|for) (?:an? |the )?(.+)$/i);
    if (of) t = `${of[1]} Patent Model`;
    t = t.replace(/,?\s*Patent Model$/i, " Patent Model").replace(/^(.+?)'s \d{4} /, "$1's ");
  }
  t = t.replace(/[.;:,\s-]+$/, "").trim();
  if (t.length > 44) t = t.split(/\s*[,;(]\s*|\s+--\s+/)[0];
  if (t.length > 44) t = t.split(" ").slice(0, 6).join(" ");
  t = t.replace(/[.;:,\s-]+$/, "").trim();
  if (t.length < 3 || /^(photograph|untitled|study|sketch|flower study|plant study|drawing)$/i.test(t)) return null;
  return t[0].toUpperCase() + t.slice(1);
}

/** Names for every kept print: unique; a nameless one is named for its kind and maker. */
function nameAll(list: Prepped[]): Map<string, string> {
  const base = (p: Prepped) => {
    const who = cleanMaker(p.maker)?.split(" ").slice(-1)[0];
    const kind = ARCHIVE_GROUPS[p.group].kind.replace(/^\w/, (c) => c.toUpperCase());
    return NAMES[p.key] ?? archiveName(p.title, p.group) ?? (who ? `${kind} by ${who}` : kind);
  };
  const names = new Map<string, string>();
  const taken = new Set<string>();
  const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X", " XI", " XII", " XIII", " XIV", " XV", " XVI", " XVII", " XVIII", " XIX", " XX", " XXI", " XXII", " XXIII", " XXIV", " XXV"];
  for (const p of [...list].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))) {
    const t = base(p);
    let name = t;
    for (let i = 1; taken.has(name.toLowerCase()); i++) name = `${t}${ROMAN[i] ?? ` ${i + 1}`}`;
    taken.add(name.toLowerCase());
    names.set(p.key, name);
  }
  return names;
}

function select() {
  const all = prepped();
  const chosen: ArchiveSource[] = [];
  const picked: Prepped[] = [];
  // What the review of the contact sheets kept (scripts/archive/review.json).
  const byKey = new Map(all.map((p) => [p.key, p]));
  for (const group of Object.keys(ARCHIVE_GROUPS) as ArchiveGroup[]) {
    const keys = REVIEWED[group] ?? [];
    const list = keys.map((k) => byKey.get(k)).filter((p): p is Prepped => !!p && p.group === group);
    if (list.length < keys.length) console.warn(`${group}: ${keys.length - list.length} reviewed prints are missing`);
    picked.push(...list);
  }
  const names = nameAll(picked);
  for (const p of picked) {
    const { media: _m, score: _s, ...src } = p;
    chosen.push({ ...src, maker: cleanMaker(p.maker), name: names.get(p.key)! });
  }
  chosen.sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));
  rmSync(OUT, { recursive: true, force: true });
  mkdir(OUT);
  writeFileSync(path.join(OUT, "archive.json"), `[\n${chosen.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`);
  const prints = path.join(ROOT, "public", "prints");
  for (const f of readdirSync(prints)) if (f.endsWith(".webp") && Number(f.match(/\d+/)![0]) >= ARCHIVE_FIRST_N) rmSync(path.join(prints, f));
  const order = archiveOrder(chosen);
  for (const { n, source } of order) writeFileSync(path.join(prints, `print_${n}.webp`), readFileSync(prepFile(source.key)));
  console.log(`data/archive/archive.json: ${chosen.length} · prints ${ARCHIVE_FIRST_N}…${ARCHIVE_FIRST_N + chosen.length - 1}`);
}

async function metadata() {
  // Metadata shards (EDAN, one JSON record per line), fetched once.
  for (const unit of Object.keys(ARCHIVE_UNITS) as ArchiveUnit[]) {
    const dir = mkdir(path.join(CACHE, "meta", unit));
    const want = process.argv[3] ? Number(process.argv[3]) : 256;
    const files = Array.from({ length: want }, (_, i) => i.toString(16).padStart(2, "0"));
    await pool(files, 8, async (h) => {
      const f = path.join(dir, `${h}.txt`);
      if (existsSync(f)) return;
      const r = await get(`${BUCKET}/metadata/edan/${unit}/${h}.txt`);
      writeFileSync(f, r.ok ? await r.text() : "");
    });
    console.log(unit, readdirSync(dir).length);
  }
}

const cmd = process.argv[2];
const run = { metadata, candidates, prep, sheet, select: async () => select() }[cmd as "prep"];
if (!run) {
  console.error("usage: fetchArchive.ts metadata | candidates | prep [group] | sheet [group] | select");
  process.exit(1);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
