/**
 * Builds data/photos from Smithsonian Open Access (CC0). Needs the network;
 * run by hand, then commit data/photos. The generator never fetches.
 *
 *   npx tsx scripts/photos/fetchPhotos.ts candidates   # metadata → candidate list
 *   npx tsx scripts/photos/fetchPhotos.ts prep         # download + crop + grey + mask
 *   npx tsx scripts/photos/fetchPhotos.ts sheet        # contact sheets for review
 *   npx tsx scripts/photos/fetchPhotos.ts select       # curation.ts → data/photos
 *
 * Downloads are cached in node_modules/.cache/mono-photos.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BUCKET, PHOTO_UNITS, type PhotoSource, type PhotoUnit } from "./source";
import { EXCLUDE, SUBJECTS, PER_CATEGORY_PHOTOS, fixSubject } from "./curation";

const ROOT = path.resolve(__dirname, "..", "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "mono-photos");
const OUT = path.join(ROOT, "data", "photos");
/** An isolated object that fills less than this of the canvas came apart (a ruler beside a small part, a lost mask). */
const MIN_OBJECT_COVERAGE = 0.12;
// Aircraft are wide and cover little of a 3:4 canvas by nature: gauges only.
const usable = (p: Prepped) => !EXCLUDE.has(p.key) && (p.mode === "frame" || p.category !== "machines" || p.coverage >= MIN_OBJECT_COVERAGE);

/** Stored size of each photograph (3:4, grey + alpha). */
export const PW = 180;
export const PH = 240;

type Category = PhotoSource["category"];

interface Candidate extends Omit<PhotoSource, "mode" | "tone"> {
  media: string;
  keywords: string;
}
interface Prepped extends Candidate {
  mode: PhotoSource["mode"];
  tone: number;
  sharpness: number;
  contrast: number;
  coverage: number;
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
/* prep: grey, cropped to 3:4, background removed for isolated objects */
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

/** Background = the flat colour around the border, flood-filled inwards. */
function objectMask(g: Uint8Array, w: number, h: number): Uint8Array | null {
  const ring: number[] = [];
  const b = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < b || y < b || x >= w - b || y >= h - b) ring.push(g[y * w + x]);
  const med = percentile(ring, 0.5);
  const mad = percentile(ring.map((v) => Math.abs(v - med)), 0.8);
  if (mad > 14) return null; // busy surroundings: keep the whole frame
  // Seamless backdrops fade from light to dark and objects cast soft
  // shadows: grow the background through small steps between neighbours
  // (a gradient), within a wide band around the border colour.
  const blur = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) (s += g[yy * w + xx]), n++;
        }
      blur[y * w + x] = s / n;
    }
  const step = Math.max(3, mad * 0.6);
  const band = Math.max(40, mad * 5);
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!bg[i] && Math.abs(blur[i] - med) <= Math.max(16, mad * 2.5)) (bg[i] = 1), stack.push(i);
  };
  for (let x = 0; x < w; x++) seed(x), seed((h - 1) * w + x);
  for (let y = 0; y < h; y++) seed(y * w), seed(y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) {
      if (j < 0 || bg[j]) continue;
      if (Math.abs(blur[j] - blur[i]) <= step && Math.abs(blur[j] - med) <= band) (bg[j] = 1), stack.push(j);
    }
  }
  // Keep the object's large parts; drop dust and stray shadows.
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (bg[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    const st = [s];
    label[s] = id;
    while (st.length) {
      const i = st.pop()!;
      n++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !bg[j] && label[j] < 0) (label[j] = id), st.push(j);
    }
    sizes.push(n);
  }
  const biggest = Math.max(0, ...sizes);
  const mask = new Uint8Array(w * h);
  let area = 0;
  for (let i = 0; i < w * h; i++) if (label[i] >= 0 && sizes[label[i]] >= biggest * 0.04) (mask[i] = 255), area++;
  const frac = area / (w * h);
  return frac > 0.06 && frac < 0.8 ? mask : null;
}

async function prepOne(c: Candidate, jpg: Buffer): Promise<{ png: Buffer; meta: Omit<Prepped, keyof Candidate> } | null> {
  const img = sharp(jpg, { failOn: "none" }).rotate().greyscale();
  const { data, info } = await img.resize(WORK, WORK, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const g = new Uint8Array(data.buffer, data.byteOffset, w * h);
  const mask = objectMask(g, w, h);
  let gray: Buffer;
  let alpha: Buffer;
  let mode: PhotoSource["mode"];
  if (mask) {
    mode = "object";
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    // Fit the object inside 90% of the 3:4 canvas, centred.
    const s = Math.min((PW * 0.9) / bw, (PH * 0.9) / bh);
    const tw = Math.max(1, Math.round(bw * s));
    const th = Math.max(1, Math.round(bh * s));
    const left = Math.round((PW - tw) / 2);
    const top = Math.round((PH - th) / 2);
    const two = Buffer.alloc(bw * bh * 2);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = (y0 + y) * w + x0 + x;
      two[(y * bw + x) * 2] = g[i];
      two[(y * bw + x) * 2 + 1] = mask[i];
    }
    const placed = await sharp(two, { raw: { width: bw, height: bh, channels: 2 } })
      .resize(tw, th, { kernel: "lanczos3" })
      .extend({ top, left, bottom: PH - th - top, right: PW - tw - left, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = placed.info.channels;
    gray = Buffer.alloc(PW * PH);
    alpha = Buffer.alloc(PW * PH);
    for (let i = 0; i < PW * PH; i++) (gray[i] = placed.data[i * ch]), (alpha[i] = placed.data[i * ch + ch - 1]);
  } else {
    mode = "frame";
    const r = await sharp(jpg, { failOn: "none" }).rotate().greyscale().resize(PW, PH, { fit: "cover", position: sharp.strategy.attention, kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
    gray = Buffer.alloc(PW * PH);
    for (let i = 0; i < PW * PH; i++) gray[i] = r.data[i * r.info.channels];
    alpha = Buffer.alloc(PW * PH, 255);
  }
  // Levels: stretch the subject's 1st–99th percentile to the full range.
  const inside: number[] = [];
  for (let i = 0; i < PW * PH; i++) if (alpha[i] > 128) inside.push(gray[i]);
  if (inside.length < PW * PH * 0.05) return null;
  const lo = percentile(inside, 0.01);
  const hi = percentile(inside, 0.99);
  if (hi - lo < 40) return null;
  for (let i = 0; i < PW * PH; i++) gray[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - lo) / (hi - lo)) * 255)));
  // Metrics: detail (mean |Laplacian|), contrast (std), coverage, tone.
  let lap = 0, n = 0, sum = 0, sq = 0, cover = 0;
  for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
    const i = y * PW + x;
    if (alpha[i] < 128) continue;
    lap += Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - PW] - gray[i + PW]);
    n++;
  }
  for (let i = 0; i < PW * PH; i++) if (alpha[i] >= 128) (sum += gray[i]), (sq += gray[i] * gray[i]), cover++;
  const mean = sum / cover;
  const contrast = Math.sqrt(sq / cover - mean * mean) / 128;
  const sharpness = lap / Math.max(1, n) / 40;
  const coverage = cover / (PW * PH);
  const tone = mean / 255;
  const ga = Buffer.alloc(PW * PH * 2);
  for (let i = 0; i < PW * PH; i++) (ga[i * 2] = gray[i]), (ga[i * 2 + 1] = alpha[i]);
  const png = await sharp(ga, { raw: { width: PW, height: PH, channels: 2 } }).png({ compressionLevel: 9, palette: false }).toBuffer();
  const score = Math.min(1, sharpness) * 0.45 + Math.min(1, contrast) * 0.35 + (mode === "object" ? Math.min(1, coverage / 0.45) : 0.8) * 0.2;
  return { png, meta: { mode, tone: Math.round(tone * 1000) / 1000, sharpness, contrast, coverage, score } };
}

async function prep() {
  const all: Candidate[] = JSON.parse(readFileSync(path.join(CACHE, "candidates.json"), "utf8"));
  const limit = Number(process.env.PREP_LIMIT ?? Infinity);
  // A few per subject is plenty; cap before downloading.
  const perSubject = new Map<string, number>();
  const list = all.filter((c) => {
    if (EXCLUDE.has(c.key)) return false;
    const k = `${c.category}|${(SUBJECTS[c.key] ?? fixSubject(c.subject)).toLowerCase()}`;
    const n = (perSubject.get(k) ?? 0) + 1;
    perSubject.set(k, n);
    return n <= (c.category === "wildlife" ? 3 : 2);
  }).slice(0, limit);
  const dir = mkdir(path.join(CACHE, "prep"));
  const redo = process.env.PREP_REDO; // unit to process again (e.g. "nasm")
  const results: Prepped[] = (existsSync(path.join(CACHE, "prepped.json")) ? JSON.parse(readFileSync(path.join(CACHE, "prepped.json"), "utf8")) : []).filter((r: Prepped) => r.unit !== redo);
  const done = new Set(results.map((r) => r.key));
  const failed = new Set<string>(existsSync(path.join(CACHE, "failed.json")) ? JSON.parse(readFileSync(path.join(CACHE, "failed.json"), "utf8")) : []);
  let k = 0;
  await pool(list.filter((c) => !done.has(c.key) && !failed.has(c.key)), 8, async (c) => {
    try {
      const jpgFile = path.join(mkdir(path.join(CACHE, "jpg")), `${c.key}.jpg`);
      if (!existsSync(jpgFile)) {
        const r = await get(`${BUCKET}/${c.media}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        writeFileSync(jpgFile, Buffer.from(await r.arrayBuffer()));
      }
      const out = await prepOne(c, readFileSync(jpgFile));
      if (!out) throw new Error("flat or empty");
      writeFileSync(path.join(dir, `${c.key}.png`), out.png);
      results.push({ ...c, ...out.meta });
    } catch (e) {
      failed.add(c.key);
      console.warn(`skip ${c.key}: ${(e as Error).message}`);
    }
    if (++k % 25 === 0) {
      console.log(`  ${k} done`);
      writeFileSync(path.join(CACHE, "prepped.json"), JSON.stringify(results));
      writeFileSync(path.join(CACHE, "failed.json"), JSON.stringify([...failed]));
    }
  });
  writeFileSync(path.join(CACHE, "prepped.json"), JSON.stringify(results));
  writeFileSync(path.join(CACHE, "failed.json"), JSON.stringify([...failed]));
  console.log(`prepped ${results.length} (failed ${failed.size})`);
}

/* ------------------------------------------------------------------ */
/* sheet: numbered contact sheets per category (review)                */
/* ------------------------------------------------------------------ */

async function sheet() {
  const prepped: Prepped[] = JSON.parse(readFileSync(path.join(CACHE, "prepped.json"), "utf8"));
  const dir = mkdir(path.join(CACHE, "sheets"));
  const only = process.argv[3];
  for (const cat of ["wildlife", "flight", "machines"] as Category[]) {
    if (only && only !== cat) continue;
    const list = prepped.filter((p) => p.category === cat && usable(p)).sort((a, b) => b.score - a.score);
    const cols = 10;
    const cw = PW / 2 + 6;
    const chh = PH / 2 + 18;
    for (let page = 0; page * 60 < list.length; page++) {
      const part = list.slice(page * 60, page * 60 + 60);
      const rows = Math.ceil(part.length / cols);
      const composites = await Promise.all(part.map(async (p, i) => {
        const img = await sharp(path.join(CACHE, "prep", `${p.key}.png`)).flatten({ background: "#7f7f7f" }).resize(PW / 2, PH / 2).png().toBuffer();
        return { input: img, left: (i % cols) * cw + 3, top: Math.floor(i / cols) * chh + 3 };
      }));
      const labels = part.map((p, i) => `<text x="${(i % cols) * cw + 4}" y="${Math.floor(i / cols) * chh + PH / 2 + 15}" font-size="10" font-family="DejaVu Sans" fill="#000">${page * 60 + i} ${p.mode === "object" ? "o" : "f"} ${p.subject.replace(/[<&>"]/g, "").slice(0, 14)}</text>`).join("");
      const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * chh}"><rect width="100%" height="100%" fill="#fff"/>${labels}</svg>`);
      await sharp(svg).composite(composites).png().toFile(path.join(dir, `${cat}-${page}.png`));
    }
    writeFileSync(path.join(dir, `${cat}.json`), JSON.stringify(list.map((p, i) => [i, p.key, p.subject, p.title, p.mode, Math.round(p.score * 100)])));
    console.log(`${cat}: ${list.length} → ${Math.ceil(list.length / 60)} sheets`);
  }
}

/* ------------------------------------------------------------------ */
/* select: the best PER_CATEGORY_PHOTOS per category → data/photos     */
/* ------------------------------------------------------------------ */

function select() {
  const prepped: Prepped[] = JSON.parse(readFileSync(path.join(CACHE, "prepped.json"), "utf8"));
  rmSync(OUT, { recursive: true, force: true });
  mkdir(path.join(OUT, "img"));
  const chosen: PhotoSource[] = [];
  // Two records can share one image (a set and its part): one design per image.
  const usedKeys = new Set<string>();
  for (const cat of ["wildlife", "flight", "machines"] as Category[]) {
    const perSubject = new Map<string, number>();
    const list = prepped
      .filter((p) => p.category === cat && usable(p))
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
      writeFileSync(path.join(OUT, "img", `${p.key}.png`), readFileSync(path.join(CACHE, "prep", `${p.key}.png`)));
      chosen.push({ key: p.key, category: p.category, unit: p.unit, title: p.title, subject: SUBJECTS[p.key] ?? fixSubject(p.subject), credit: p.credit, record: p.record, kind: p.kind, mode: p.mode, tone: p.tone });
    }
  }
  // Stable order: category, then key (the generator orders them itself).
  chosen.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
  writeFileSync(path.join(OUT, "photos.json"), `[\n${chosen.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`);
  console.log(`data/photos: ${chosen.length} photographs`);
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
void readdirSync;
