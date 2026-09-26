/**
 * Builds the photo designs' sources from Smithsonian Open Access (CC0).
 * Needs the network; run by hand, then commit data/photos/photos.json and
 * public/prints/print_<n>.webp. The generator never fetches.
 *
 *   npx tsx scripts/photos/fetchPhotos.ts candidates   # metadata → candidate list
 *   npx tsx scripts/photos/fetchPhotos.ts prep         # download, grey, fit whole
 *   python scripts/photos/cutout.py <needs-cut.txt>    # studio shots: cut-outs (rembg)
 *   npx tsx scripts/photos/fetchPhotos.ts prep         # again, with the cut-outs
 *   npx tsx scripts/photos/fetchPhotos.ts sheet        # contact sheets for review
 *   npx tsx scripts/photos/fetchPhotos.ts select       # curation.ts → data/photos + prints
 *
 * Downloads are cached in node_modules/.cache/mono-photos.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BUCKET, PHOTO_FIRST_N, PHOTO_UNITS, PRINT_H, PRINT_W, photoOrder, type PhotoSource, type PhotoUnit } from "./source";
import { EXCLUDE, SUBJECTS, PER_CATEGORY_PHOTOS, fixSubject } from "./curation";

const ROOT = path.resolve(__dirname, "..", "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "mono-photos");
const OUT = path.join(ROOT, "data", "photos");
type Category = PhotoSource["category"];

type Measures = "mode" | "tone" | "contrast" | "coverage" | "detail" | "box";
interface Candidate extends Omit<PhotoSource, Measures> {
  media: string;
  keywords: string;
}
interface Prepped extends Candidate, Pick<PhotoSource, Measures> {
  score: number;
}

const mkdir = (d: string) => (mkdirSync(d, { recursive: true }), d);

async function get(url: string, tries = 4): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404 || i >= tries) return r;
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

async function metadata(unit: PhotoUnit): Promise<any[]> {
  const dir = mkdir(path.join(CACHE, "meta", unit));
  const files = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  await pool(files, 16, async (h) => {
    const f = path.join(dir, `${h}.txt`);
    if (existsSync(f)) return;
    const r = await get(`${BUCKET}/metadata/edan/${unit}/${h}.txt`);
    writeFileSync(f, r.ok ? await r.text() : "");
  });
  return files.flatMap((h) => readFileSync(path.join(dir, `${h}.txt`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
}

async function mediaKeys(unit: PhotoUnit): Promise<Set<string>> {
  const f = path.join(CACHE, `keys-${unit}.json`);
  if (!existsSync(f)) {
    const keys: string[] = [];
    let token = "";
    do {
      const x = await (await get(`${BUCKET}/?list-type=2&prefix=media/${unit}/${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`)).text();
      for (const m of x.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(m[1]);
      token = x.match(/<NextContinuationToken>([^<]*)/)?.[1] ?? "";
    } while (token);
    writeFileSync(f, JSON.stringify(keys));
  }
  return new Set(JSON.parse(readFileSync(f, "utf8")));
}

const FLIGHT = new Set(["Aircraft", "Models", "Crewed spacecraft", "Uncrewed spacecraft", "Rockets", "Rotorcraft", "Artificial satellites", "Baloons (aircraft)", "Airships", "Missiles", "Wind tunnels", "Spacecraft", "Science fiction"]);
const MACHINES = new Set(["Engines", "Rotary engines", "Flight instruments", "Instruments", "Navigational instruments", "Scientific instruments", "Photographic equipment", "Computers", "Jet aircraft", "Propellers", "Autopilots", "Radar", "Propulsion systems", "Equipment", "Testing equipment", "Sights (firearm component)"]);
/** People, events and places rather than an animal. */
const NOT_AN_ANIMAL = /keeper|staff|volunteer|visitor|celebrat|birthday|ceremony|people|scientist|researcher|veterinar|\bexam|biologist|person|preserve|prairie|marsh|habitat|forest|exhibit|building|construction|event|family day|^NZP-|^photo$/i;

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/[“”]/g, '"').trim();

/** "Indicator, Airspeed, C-14" → "Airspeed Indicator C-14"; "Douglas DC-3" stays. */
export function nasmSubject(title: string): string {
  const t = clean(title).replace(/,\s*$/, "");
  const parts = t.split(/\s*,\s*/);
  const GENERIC = /^(Indicator|Gauge|Transmitter|Recorder|Generator|Computer|Camera|Model|Engine|Propeller|Sextant|Compass|Receiver|Radio|Rocket|Satellite|Capsule|Voltmeter|Barograph|Meter|Plotter|Clock|Altimeter|Tachometer|Thermometer|Accelerometer|Pump|Valve|Regulator|Unit|Display)$/i;
  if (parts.length > 1 && GENERIC.test(parts[0])) {
    const [head, spec, ...rest] = parts;
    if (/^Model$/i.test(head)) return clean(`${parts.slice(1).filter((p) => !/^(Static|Display|Recognition|\d+:\d+)$/i.test(p)).slice(0, 2).join(" ")} Model`);
    return clean(`${spec} ${head}${rest.length && rest[0].length <= 12 ? ` ${rest[0]}` : ""}`);
  }
  return parts.slice(0, 2).join(" ").replace(/\s+"[^"]*"$/, (m) => m);
}

/** "Moyo the Grevy's Zebra" → "Grevy's Zebra"; "Athena, Southern Two-toed Sloth" → "Southern Two-toed Sloth". */
export function nzpSubject(title: string): string {
  let t = clean(title).replace(/^(photo|photos) of /i, "");
  const the = t.match(/^[A-Z][\w'-]+(?: and [A-Z][\w'-]+)? the (.+)$/);
  if (the) t = the[1];
  const comma = t.match(/^[A-Z][\w'-]+(?: and [A-Z][\w'-]+)?, (.+)$/);
  if (comma) t = comma[1];
  t = t.replace(/\b(cub|cubs|joey|chick|chicks|pup|pups|kit|kits|calf|juvenile|baby|infant|troop|family|pair)$/i, (m) => m);
  return t.split(" ").map((w) => (/^[a-z]/.test(w) && !/^(of|and|the|in|on)$/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

async function candidates() {
  const out: Candidate[] = [];
  for (const unit of Object.keys(PHOTO_UNITS) as PhotoUnit[]) {
    const [recs, keys] = await Promise.all([metadata(unit), mediaKeys(unit)]);
    for (const r of recs) {
      const d = r.content?.descriptiveNonRepeating ?? {};
      const media = (d.online_media?.media ?? []).filter((m: any) => m.type === "Images" && m.usage?.access === "CC0" && keys.has(`media/${unit}/${m.idsId}.jpg`));
      if (!media.length || d.metadata_usage?.access !== "CC0") continue;
      const title = clean(r.title ?? d.title?.content ?? "");
      const free = r.content?.freetext ?? {};
      const credit = clean(free.objectRights?.find((x: any) => /credit/i.test(x.label))?.content ?? free.creditLine?.[0]?.content ?? PHOTO_UNITS[unit]);
      const keywords = (free.notes ?? []).map((n: any) => n.content).join(" ");
      const types: string[] = r.content?.indexedStructured?.object_type ?? [];
      let category: Category | null = null;
      if (unit === "nzp") category = NOT_AN_ANIMAL.test(title) || /people|staff|keeper/i.test(keywords) ? null : "wildlife";
      else if (types.some((t) => FLIGHT.has(t))) category = "flight";
      else if (types.some((t) => MACHINES.has(t))) category = "machines";
      if (!category) continue;
      // Flight records are few: their second view is a candidate too (same
      // subject, so it joins the first as a variation of one design family).
      for (const m of media.slice(0, category === "flight" ? 2 : 1))
      out.push({
        key: m.idsId,
        media: `media/${unit}/${m.idsId}.jpg`,
        category,
        unit,
        title,
        subject: unit === "nzp" ? nzpSubject(title) : nasmSubject(title),
        // NZP credits the photographer; NASM's credit line is the object's
        // provenance ("Gift of …"), its photographs are the museum's own.
        credit: unit === "nzp" ? credit.replace(/^Credit Line:\s*/i, "") : "National Air and Space Museum, Smithsonian Institution",
        record: d.record_ID,
        kind: unit === "nzp" ? "Animal photograph" : types[0] ?? "Object",
        keywords,
      });
    }
  }
  const counts = out.reduce<Record<string, number>>((a, c) => ((a[c.category] = (a[c.category] ?? 0) + 1), a), {});
  writeFileSync(path.join(mkdir(CACHE), "candidates.json"), JSON.stringify(out, null, 1));
  console.log(`candidates: ${out.length}`, counts);
}

/* ------------------------------------------------------------------ */
/* prep: the whole photograph, greyscale, high resolution; a studio      */
/* object cut out of its backdrop (rembg masks from cutout.py)            */
/* ------------------------------------------------------------------ */

const WORK = 480;

function percentile(values: Uint8Array | number[], p: number) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[v]++;
  let acc = 0;
  const target = values.length * p;
  for (let i = 0; i < 256; i++) if ((acc += hist[i]) >= target) return i;
  return 255;
}

/** A plain studio backdrop: the border is one flat tone (then the object is cut out). */
function plainBackdrop(g: Uint8Array, w: number, h: number): boolean {
  const ring: number[] = [];
  const b = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < b || y < b || x >= w - b || y >= h - b) ring.push(g[y * w + x]);
  const med = percentile(ring, 0.5);
  return percentile(ring.map((v) => Math.abs(v - med)), 0.8) <= 14;
}

const cutFile = (key: string) => path.join(CACHE, "cut", `${key}.png`);
const jpgFile = (key: string) => path.join(CACHE, "jpg", `${key}.jpg`);

/**
 * One print: 750 × 1000 (the whole print area), greyscale with alpha.
 * - frame: the photograph as taken, never cropped — scaled to fit 94% of
 *   the area and centred (a wide aircraft stays whole, with room around it);
 * - object: the cut-out (alpha from rembg), fitted to 90% of the area.
 * Levels stretch the picture's 0.5–99.5th percentile to the full range.
 */
async function prepOne(c: Candidate): Promise<{ webp: Buffer; meta: Omit<Prepped, keyof Candidate> } | "needs-cut" | null> {
  const src = sharp(jpgFile(c.key), { failOn: "none" }).rotate();
  const small = await src.clone().greyscale().resize(WORK, WORK, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const object = plainBackdrop(new Uint8Array(small.data.buffer, small.data.byteOffset, small.info.width * small.info.height), small.info.width, small.info.height);
  if (object && !existsSync(cutFile(c.key))) return "needs-cut";
  let layer: sharp.Sharp;
  let bw: number;
  let bh: number;
  if (object) {
    // Trim to the object's box (alpha), grey, keep the alpha.
    // The model leaves faint shadow and backdrop residue at low alpha: drop
    // it, and centre on the solid object (a faint smear would pull it aside).
    const { data, info } = await sharp(cutFile(c.key)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, area = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const a = data[i * 4 + 3];
      data[i * 4 + 3] = a < 64 ? 0 : Math.round(((a - 64) / 191) * 255);
      if (data[i * 4 + 3] > 128) {
        const x = i % info.width;
        const y = Math.floor(i / info.width);
        (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)), area++;
      }
    }
    if (x1 < 0 || area < info.width * info.height * 0.03) return null; // the model found nothing solid
    bw = x1 - x0 + 1;
    bh = y1 - y0 + 1;
    layer = sharp(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: x0, top: y0, width: bw, height: bh }).png().toBuffer());
  } else {
    const meta = await src.clone().metadata();
    const swap = (meta.orientation ?? 1) >= 5;
    bw = (swap ? meta.height : meta.width) ?? 1;
    bh = (swap ? meta.width : meta.height) ?? 1;
    layer = src.clone().ensureAlpha();
  }
  const fit = object ? 0.9 : 0.94;
  const s = Math.min((PRINT_W * fit) / bw, (PRINT_H * fit) / bh);
  const tw = Math.max(1, Math.round(bw * s));
  const th = Math.max(1, Math.round(bh * s));
  const left = Math.round((PRINT_W - tw) / 2);
  // Top-aligned (every picture starts the same distance below the collar; scripts/tools/topAlignPrints).
  const top = Math.round(PRINT_H * 0.03);
  const placed = await layer
    .resize(tw, th, { kernel: "lanczos3" })
    .extend({ top, left, bottom: PRINT_H - th - top, right: PRINT_W - tw - left, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = placed.info.channels;
  const n = PRINT_W * PRINT_H;
  const gray = new Uint8Array(n);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = placed.data[i * ch], g = placed.data[i * ch + 1], b = placed.data[i * ch + 2];
    gray[i] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    alpha[i] = placed.data[i * ch + ch - 1];
  }
  const inside: number[] = [];
  for (let i = 0; i < n; i += 3) if (alpha[i] > 128) inside.push(gray[i]);
  const lo = percentile(inside, 0.005);
  const hi = percentile(inside, 0.995);
  if (hi - lo < 50) return null; // flat, washed-out picture
  for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - lo) / (hi - lo)) * 255)));
  // Measures (on the print itself).
  let sum = 0, sq = 0, cover = 0, lap = 0, lapN = 0;
  let bx0 = PRINT_W, by0 = PRINT_H, bx1 = 0, by1 = 0;
  for (let y = 1; y < PRINT_H - 1; y++)
    for (let x = 1; x < PRINT_W - 1; x++) {
      const i = y * PRINT_W + x;
      if (alpha[i] < 128) continue;
      cover++;
      sum += gray[i];
      sq += gray[i] * gray[i];
      bx0 = Math.min(bx0, x), bx1 = Math.max(bx1, x), by0 = Math.min(by0, y), by1 = Math.max(by1, y);
      if (alpha[i - 1] > 128 && alpha[i + 1] > 128 && alpha[i - PRINT_W] > 128 && alpha[i + PRINT_W] > 128) {
        lap += Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - PRINT_W] - gray[i + PRINT_W]);
        lapN++;
      }
    }
  const mean = sum / cover;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const la = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) (la[i * 2] = gray[i]), (la[i * 2 + 1] = alpha[i]);
  const webp = await sharp(la, { raw: { width: PRINT_W, height: PRINT_H, channels: 2 } }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toBuffer();
  const contrast = Math.sqrt(Math.max(0, sq / cover - mean * mean)) / 255;
  const detail = Math.min(1, lap / Math.max(1, lapN) / 30);
  const coverage = cover / n;
  const score = Math.min(1, detail * 1.5) * 0.35 + Math.min(1, contrast * 3.5) * 0.35 + Math.min(1, coverage / 0.4) * 0.3;
  return {
    webp,
    meta: {
      mode: object ? "object" : "frame",
      tone: r3(mean / 255),
      contrast: r3(contrast),
      coverage: r3(coverage),
      detail: r3(detail),
      box: [r3(bx0 / PRINT_W), r3(by0 / PRINT_H), r3((bx1 + 1) / PRINT_W), r3((by1 + 1) / PRINT_H)],
      score,
    },
  };
}

async function prep() {
  const all: Candidate[] = JSON.parse(readFileSync(path.join(CACHE, "candidates.json"), "utf8"));
  const perSubject = new Map<string, number>();
  const list = all.filter((c) => {
    if (EXCLUDE.has(c.key)) return false;
    const k = `${c.category}|${(SUBJECTS[c.key] ?? fixSubject(c.subject)).toLowerCase()}`;
    const n = (perSubject.get(k) ?? 0) + 1;
    perSubject.set(k, n);
    return n <= (c.category === "wildlife" ? 3 : 2);
  });
  const dir = mkdir(path.join(CACHE, "prep2"));
  const results: Prepped[] = [];
  const needsCut: string[] = [];
  let k = 0;
  await pool(list, 6, async (c) => {
    try {
      if (!existsSync(jpgFile(c.key))) {
        const r = await get(`${BUCKET}/${c.media}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        writeFileSync(jpgFile(c.key), Buffer.from(await r.arrayBuffer()));
      }
      const out = await prepOne(c);
      if (out === "needs-cut") return void needsCut.push(c.key);
      if (!out) throw new Error("flat, empty or no solid object");
      writeFileSync(path.join(dir, `${c.key}.webp`), out.webp);
      results.push({ ...c, ...out.meta });
    } catch (e) {
      console.warn(`skip ${c.key}: ${(e as Error).message}`);
    }
    if (++k % 50 === 0) console.log(`  ${k}/${list.length}`);
  });
  results.sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(path.join(CACHE, "prepped2.json"), JSON.stringify(results));
  writeFileSync(path.join(CACHE, "needs-cut.txt"), needsCut.join("\n"));
  console.log(`prepped ${results.length}; ${needsCut.length} studio shots need a cut-out first (python scripts/photos/cutout.py ${path.relative(ROOT, path.join(CACHE, "needs-cut.txt"))})`);
}

/* ------------------------------------------------------------------ */
/* sheet: numbered contact sheets per category (review)                */
/* ------------------------------------------------------------------ */

const prepped = (): Prepped[] => JSON.parse(readFileSync(path.join(CACHE, "prepped2.json"), "utf8"));

async function sheet() {
  const dir = mkdir(path.join(CACHE, "sheets2"));
  const only = process.argv[3];
  for (const cat of ["wildlife", "flight", "machines"] as Category[]) {
    if (only && only !== cat) continue;
    const list = prepped().filter((p) => p.category === cat && !EXCLUDE.has(p.key)).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const cols = 8;
    const TW = 150, TH = 200;
    const cw = TW + 6;
    const chh = TH + 18;
    for (let page = 0; page * 48 < list.length; page++) {
      const part = list.slice(page * 48, page * 48 + 48);
      const rows = Math.ceil(part.length / cols);
      const composites = await Promise.all(part.map(async (p, i) => ({
        input: await sharp(path.join(CACHE, "prep2", `${p.key}.webp`)).flatten({ background: "#000" }).resize(TW, TH).png().toBuffer(),
        left: (i % cols) * cw + 3,
        top: Math.floor(i / cols) * chh + 3,
      })));
      const labels = part.map((p, i) => `<text x="${(i % cols) * cw + 4}" y="${Math.floor(i / cols) * chh + TH + 15}" font-size="10" font-family="DejaVu Sans" fill="#000">${page * 48 + i} ${p.mode === "object" ? "o" : "f"} ${p.subject.replace(/[<&>"]/g, "").slice(0, 18)}</text>`).join("");
      const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * chh}"><rect width="100%" height="100%" fill="#fff"/>${labels}</svg>`);
      await sharp(svg).composite(composites).png().toFile(path.join(dir, `${cat}-${page}.png`));
    }
    writeFileSync(path.join(dir, `${cat}.json`), JSON.stringify(list.map((p, i) => [i, p.key, p.subject, p.mode])));
    console.log(`${cat}: ${list.length} → ${Math.ceil(list.length / 48)} sheets`);
  }
}

/* ------------------------------------------------------------------ */
/* select: the best PER_CATEGORY_PHOTOS per category → data/photos and  */
/* the prints public/prints/print_<n>.webp                              */
/* ------------------------------------------------------------------ */

function select() {
  const all = prepped();
  const chosen: PhotoSource[] = [];
  const usedKeys = new Set<string>();
  for (const cat of ["wildlife", "flight", "machines"] as Category[]) {
    const perSubject = new Map<string, number>();
    const list = all
      .filter((p) => p.category === cat && !EXCLUDE.has(p.key))
      .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
      .filter((p) => !usedKeys.has(p.key) && !!usedKeys.add(p.key))
      .filter((p) => {
        const s = (SUBJECTS[p.key] ?? fixSubject(p.subject)).toLowerCase();
        const n = (perSubject.get(s) ?? 0) + 1;
        perSubject.set(s, n);
        return n <= 2;
      })
      .slice(0, PER_CATEGORY_PHOTOS);
    if (list.length < PER_CATEGORY_PHOTOS) throw new Error(`${cat}: only ${list.length} photographs`);
    for (const p of list) {
      const { media: _m, keywords: _k, score: _s, ...src } = p;
      chosen.push({ ...src, subject: SUBJECTS[p.key] ?? fixSubject(p.subject) });
    }
  }
  chosen.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
  rmSync(OUT, { recursive: true, force: true });
  mkdir(OUT);
  writeFileSync(path.join(OUT, "photos.json"), `[\n${chosen.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`);
  // The prints, named by the design id they become.
  const prints = path.join(ROOT, "public", "prints");
  for (const f of readdirSync(prints)) if (f.endsWith(".webp")) rmSync(path.join(prints, f));
  for (const { n, photo } of photoOrder(chosen, PER_CATEGORY_PHOTOS)) writeFileSync(path.join(prints, `print_${n}.webp`), readFileSync(path.join(CACHE, "prep2", `${photo.key}.webp`)));
  console.log(`data/photos/photos.json: ${chosen.length} photographs · public/prints/print_${PHOTO_FIRST_N}…${PHOTO_FIRST_N + chosen.length - 1}.webp`);
}

const cmd = process.argv[2];
const run = { candidates, prep, sheet, select: async () => select() }[cmd as "prep"];
if (!run) {
  console.error("usage: fetchPhotos.ts candidates | prep | sheet [category] | select");
  process.exit(1);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
