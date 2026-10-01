/**
 * The content waves' shared steps, for every source (docs/content/waves.md):
 *
 *   candidates  the source's adapter searches (metadata only); licences and the metadata filter decide;
 *               the best `cap` by the filter's order are written, with counts per reason
 *   prep        download (resumable), cut-out for objects on a backdrop only (cutout.py), the master
 *               print (scripts/archive prepImage), the halftone (halftone.py via screen.py), and the
 *               checks (assessPrint, solidBlock): numbers only. The download is deleted after.
 *   commit      the owner's keeps get their numbers (ranges.ts) and go to assets/masters, public/prints,
 *               data/curation/halftone.json and data/sources/<source>.json
 *
 * Cache: node_modules/.cache/mono-sources/<source>/ (never committed). Logs go to <cache>/log.txt;
 * the chat only ever sees counts.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prepImage } from "../archive/fetchArchive";
import { WEAK_QUALITY, assessPrint, denseArea, rasterInk, solidBlock } from "../gen/quality";
import { judgeLicense, type LicenseFields } from "./_license";
import { countReasons, metaFilter, type MetaDecision, type MetaInput } from "./_metaFilter";
import type { Candidate, Prepped, Selected } from "./_types";
import { nextNumbers, type SourceId } from "./ranges";

export const ROOT = path.resolve(__dirname, "..", "..");
export const cacheDir = (source: SourceId) => path.join(ROOT, "node_modules", ".cache", "mono-sources", source);
export const waveDir = (wave: number) => path.join(ROOT, "data", "review", `wave-${wave}`);
export const sourceFile = (source: SourceId) => path.join(ROOT, "data", "sources", `${source}.json`);
const mkdir = (d: string) => (mkdirSync(d, { recursive: true }), d);
const readJson = <T>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback);
const writeJson = (file: string, data: unknown) => (mkdir(path.dirname(file)), writeFileSync(file, JSON.stringify(data, null, 1) + "\n"));

export function logger(source: SourceId) {
  const file = path.join(mkdir(cacheDir(source)), "log.txt");
  return (msg: string) => appendFileSync(file, `${new Date().toISOString()} ${msg}\n`);
}

/** A world of a wave: its number, name and keywords. */
export interface World {
  wave: number;
  name: string;
  keywords: string[];
  /** The words each source's own search is asked for (fewer and plainer than the keywords). */
  queries: string[];
  signalFlags?: boolean;
  /** Prints, drawings and plates only (from wave 3): a photograph is refused as "classification". */
  inkOnly?: boolean;
  /**
   * A source's own searches (from wave 3 on): its queries replace the world's, its keywords add to
   * them for that source only (a HABS sheet named "… Bridge" is the world's at the LoC, not a museum's
   * view of a bridge), and `maps` are the LoC's Geography and Map Division searches.
   */
  sources?: Partial<Record<SourceId, { queries?: string[]; keywords?: string[]; maps?: string[] }>>;
}

/** The world as one source sees it: its own queries and keywords (World.sources) in place. */
export function worldFor(world: World, source: SourceId): World {
  const own = world.sources?.[source];
  if (!own) return world;
  return { ...world, queries: own.queries ?? world.queries, keywords: [...world.keywords, ...(own.keywords ?? [])] };
}

/** What an adapter returns per record: the candidate's fields, the licence as written, and what the filter needs. */
export interface Raw extends Omit<Candidate, "license" | "score" | "matched" | "screen"> {
  licenseFields: LicenseFields;
  hasImage: boolean;
}

export interface Adapter {
  source: SourceId;
  /** Every record of the world the source finds (metadata only, paged and cached by the adapter). */
  search(world: World, log: (msg: string) => void): Promise<Raw[]>;
}

/** Line or tonal screen for an ink print (washes, watercolours and tone processes are tonal). */
const TONAL = /watercolou?r|wash|gouache|aquatint|mezzotint|lithograph|chromolith|painting|pastel|charcoal|sepia/i;
export const screenOf = (r: Pick<Raw, "mode" | "classification">): Candidate["screen"] => (r.mode !== "ink" ? "photo" : TONAL.test(r.classification) ? "tonal" : "line");

/** General art museums and the LoC surveys: a world's word must be in the title (their tags name anything somewhere in a scene, or the whole site). */
const TITLE_MATCH = new Set<SourceId>(["met", "artic", "cleveland", "rijksmuseum", "loc"]);
/** …except a map division's record, classed by the adapter as a map or chart: the whole record is the world's ("Massachusetts Bay"). */
const WHOLE_WORLD = /^(?:map|chart|nautical chart)\b/i;

export interface SourceCounts {
  found: number;
  licensed: number;
  filtered: number;
  refusedLicense: Record<string, number>;
  removed: Record<string, number>;
  final: number;
}

/** Step 1: licence and metadata filter on everything the adapter found; the best `cap` are the candidates. */
export async function candidates(adapter: Adapter, wholeWorld: World, cap: number): Promise<SourceCounts> {
  const world = worldFor(wholeWorld, adapter.source);
  const log = logger(adapter.source);
  const raw = await adapter.search(world, log);
  const seen = { records: new Set<string>(), shas: new Set<string>() };
  const refusedLicense: Record<string, number> = {};
  const decisions: (MetaDecision & { key: string })[] = [];
  const kept: Candidate[] = [];
  let licensed = 0;
  for (const r of raw) {
    const lic = judgeLicense(adapter.source, r.licenseFields);
    if (!lic.ok) {
      const why = lic.reason.replace(/:.*$/, "");
      refusedLicense[why] = (refusedLicense[why] ?? 0) + 1;
      continue;
    }
    licensed++;
    const input: MetaInput = { ...r, photo: r.mode !== "ink" };
    if (world.inkOnly && r.mode !== "ink") {
      decisions.push({ keep: false, reasons: ["classification"], score: 0, matched: [], key: r.key });
      continue;
    }
    const d = metaFilter(input, { keywords: world.keywords, signalFlags: world.signalFlags, titleMatch: TITLE_MATCH.has(adapter.source) && !WHOLE_WORLD.test(r.classification) }, seen);
    decisions.push({ ...d, key: r.key });
    if (!d.keep) continue;
    const { licenseFields: _l, hasImage: _h, ...fields } = r;
    kept.push({ ...fields, license: lic.license, score: d.score, matched: d.matched, screen: screenOf(r) });
  }
  kept.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const final = kept.slice(0, cap);
  const dir = cacheDir(adapter.source);
  writeJson(path.join(dir, `candidates-wave-${world.wave}.json`), final);
  writeJson(path.join(dir, `filter-wave-${world.wave}.json`), decisions);
  const counts: SourceCounts = { found: raw.length, licensed, filtered: kept.length, refusedLicense, removed: countReasons(decisions), final: final.length };
  const countsFile = path.join(waveDir(world.wave), "counts.json");
  writeJson(countsFile, { ...readJson<Record<string, SourceCounts>>(countsFile, {}), [adapter.source]: counts });
  log(`candidates wave ${world.wave}: ${JSON.stringify(counts)}`);
  return counts;
}

export const readCandidates = (source: SourceId, wave: number) => readJson<Candidate[]>(path.join(cacheDir(source), `candidates-wave-${wave}.json`), []);
export const readPrepped = (source: SourceId, wave: number) => readJson<Prepped[]>(path.join(cacheDir(source), `prepped-wave-${wave}.json`), []);

/**
 * A JSON GET, cached on disk per source (a re-run reads the cache: resumable, and polite to the APIs),
 * retried with backoff on 429 and 5xx.
 */
export async function getJson<T = any>(source: SourceId, url: string, { tries = 6, cache = true } = {}): Promise<T | null> {
  const file = path.join(mkdir(path.join(cacheDir(source), "http")), `${createHash("sha1").update(url).digest("hex")}.json`);
  if (cache && existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.ok) {
        const text = await r.text();
        if (cache) writeFileSync(file, text);
        return JSON.parse(text) as T;
      }
      if ((r.status !== 429 && r.status < 500) || i >= tries) return null;
    } catch {
      if (i >= tries) return null;
    }
    await new Promise((res) => setTimeout(res, 1500 * 2 ** i));
  }
}
export const UA = "MONO-catalogue/1.0 (https://github.com/eyalbenzvi/mono; public-domain works for one-ink tees)";

export async function download(url: string, file: string, tries = 6): Promise<boolean> {
  if (existsSync(file)) return true;
  // What arrived before a connection was cut (the LoC's full-size sheets often are, mid-transfer):
  // the next try asks for the rest (a Range request) and starts over if the server sends it all.
  let got: Buffer[] = [];
  let have = 0;
  for (let i = 0; ; i++) {
    let wait = 1000 * 2 ** i;
    try {
      // AIC asks API users to name themselves in AIC-User-Agent (api.artic.edu docs); the others read User-Agent.
      const headers: Record<string, string> = { "User-Agent": UA, "AIC-User-Agent": UA, ...(have ? { Range: `bytes=${have}-` } : {}) };
      const r = await fetch(url, { headers });
      if (r.ok && r.body) {
        if (r.status !== 206) (got = []), (have = 0);
        const total = r.status === 206 ? Number(/\/(\d+)$/.exec(r.headers.get("content-range") ?? "")?.[1] ?? 0) : Number(r.headers.get("content-length") ?? 0);
        const reader = r.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got.push(Buffer.from(value));
          have += value.length;
        }
        if (total && have < total) throw new Error(`short: ${have} of ${total}`);
        writeFileSync(file, Buffer.concat(got));
        return true;
      }
      if (r.status === 404 || r.status === 403 || i >= tries) return false;
      // Rate limited: wait as long as asked (Wikimedia's upload servers), at least 5 s growing.
      if (r.status === 429) wait = Math.max(Number(r.headers.get("retry-after") ?? 0) * 1000, 5000 * 2 ** i);
    } catch {
      if (i >= tries) return false;
      // Progress since the last try: go on at once.
      if (have) wait = 1000;
    }
    await new Promise((res) => setTimeout(res, wait));
  }
}

export async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

const python = () => process.env.PYTHON ?? "python3";
const sha16 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);

/** Step 2: download, cut out (objects only), master, screen and check every candidate. Resumable. */
export async function prep(source: SourceId, wave: number, { concurrency = 4, limit = Infinity } = {}) {
  const log = logger(source);
  const dir = cacheDir(source);
  for (const d of ["jpg", "cut", "prep", "screen"]) mkdir(path.join(dir, d));
  // The best `limit` by the filter's order (candidates are stored in that order).
  const list = readCandidates(source, wave).slice(0, limit);
  // Wikimedia's upload servers rate-limit hard: one at a time.
  if (source === "wikimedia") concurrency = 1;
  const jpg = (k: string) => path.join(dir, "jpg", `${k}.jpg`);
  const cut = (k: string) => path.join(dir, "cut", `${k}.png`);
  const master = (k: string) => path.join(dir, "prep", `print_${k}.webp`);
  const shas = readJson<Record<string, string>>(path.join(dir, "sha.json"), {});
  let failed = 0;
  let none = 0;
  async function makeMaster(c: Candidate) {
    const out = await prepImage(c.mode, jpg(c.key), cut(c.key)).catch((e) => (log(`prep error ${c.key}: ${String(e).slice(0, 120)}`), null));
    if (out === "needs-cut") return;
    if (out) writeFileSync(master(c.key), out.webp), writeJson(path.join(dir, "prep", `${c.key}.json`), out.meta);
    else none++, log(`no print from ${c.key}`);
    // The download goes once its master exists (the master is the tone the screen is made from).
    rmSync(jpg(c.key), { force: true });
  }
  await pool(list, concurrency, async (c) => {
    if (existsSync(master(c.key))) return;
    if (!(await download(c.imageUrl, jpg(c.key)))) return void (failed++, log(`download failed ${c.key} ${c.imageUrl}`));
    shas[c.key] = sha16(jpg(c.key));
    // Anything not cut out becomes its master now and the download goes (disk stays small).
    if (c.mode !== "cut") await makeMaster(c);
  });
  writeJson(path.join(dir, "sha.json"), shas);
  // Cut-outs, only for objects the record says were photographed on a backdrop (mode "cut").
  const toCut = list.filter((c) => c.mode === "cut" && existsSync(jpg(c.key)) && !existsSync(cut(c.key))).map((c) => c.key);
  if (toCut.length) {
    writeFileSync(path.join(dir, "cut-keys.txt"), toCut.join("\n"));
    execFileSync(python(), [path.join(ROOT, "scripts", "photos", "cutout.py"), path.join(dir, "cut-keys.txt"), dir], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  }
  for (const c of list) if (!existsSync(master(c.key)) && existsSync(jpg(c.key))) await makeMaster(c);
  writeFileSync(path.join(dir, "screen-list.txt"), list.filter((c) => existsSync(master(c.key))).map((c) => `${c.key} ${c.screen}`).join("\n"));
  execFileSync(python(), [path.join(ROOT, "scripts", "sources", "screen.py"), dir, path.join(dir, "screen-list.txt")], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  const screened = readJson<Record<string, { tee?: "black" | "white" }>>(path.join(dir, "screen.json"), {});
  // Duplicates by the original's hash (a second record of the same scan).
  const firstBySha = new Map<string, string>();
  const out: Prepped[] = [];
  for (const c of list) {
    const file = path.join(dir, "screen", `print_${c.key}.webp`);
    if (!existsSync(file)) continue;
    const meta = readJson<Pick<Prepped, "tone" | "contrast" | "coverage" | "detail" | "box">>(path.join(dir, "prep", `${c.key}.json`), { tone: 0, contrast: 0, coverage: 0, detail: 0, box: [0, 0, 1, 1] });
    const tee = c.mode === "ink" ? (c.screen === "tonal" ? "black" : "white") : screened[c.key]?.tee ?? "white";
    const { data, info } = await sharp(file).resize(300, 400, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const raster = rasterInk(data, info.width, info.height, c.mode === "ink" ? "ink" : "photo", tee);
    const a = assessPrint(raster);
    const block = solidBlock(raster);
    const solid = block.reject;
    const weak = a.quality < WEAK_QUALITY || a.flags.length > 0;
    const sha = shas[c.key] ?? "";
    const dup = sha && firstBySha.has(sha) ? firstBySha.get(sha)! : null;
    if (sha && !dup) firstBySha.set(sha, c.key);
    const flags = [...(weak ? ["weak"] : []), ...(solid ? ["solid"] : []), ...(denseArea(block) ? ["dense"] : []), ...(dup ? ["dup"] : []), ...(c.mode === "cut" && !existsSync(cut(c.key)) ? ["no-cutout"] : []), ...a.flags];
    out.push({ ...c, ...meta, sha, assess: { quality: a.quality, ink: Math.round(a.ink * 1000) / 1000, extent: Math.round(a.extent * 1000) / 1000, flags: a.flags }, solid, weak, tee, flags });
  }
  writeJson(path.join(dir, `prepped-wave-${wave}.json`), out);
  const counts = { candidates: list.length, prepped: out.length, downloadFailed: failed, noPrint: none, weak: out.filter((p) => p.weak).length, solid: out.filter((p) => p.solid).length, dup: out.filter((p) => p.flags.includes("dup")).length };
  log(`prep wave ${wave}: ${JSON.stringify(counts)}`);
  return counts;
}

/** Step 3: the owner's keeps, numbered and committed (data/sources/<source>.json, masters, prints, halftone.json). */
export function commit(source: SourceId, wave: number, keep: Map<string, { name?: string }>) {
  const dir = cacheDir(source);
  const done = readJson<Selected[]>(sourceFile(source), []);
  const have = new Set(done.map((s) => s.key));
  const todo = readPrepped(source, wave).filter((p) => keep.has(p.key) && !have.has(p.key));
  const numbers = nextNumbers(source, done.map((s) => s.n), todo.length);
  const halftoneFile = path.join(ROOT, "data", "curation", "halftone.json");
  const manifest: Record<string, unknown> = {};
  const screened = readJson<Record<string, Record<string, unknown>>>(path.join(dir, "screen.json"), {});
  const added: Selected[] = todo.map((p, i) => {
    const n = numbers[i];
    copyFileSync(path.join(dir, "prep", `print_${p.key}.webp`), path.join(ROOT, "assets", "masters", `print_${n}.webp`));
    copyFileSync(path.join(dir, "screen", `print_${p.key}.webp`), path.join(ROOT, "public", "prints", `print_${n}.webp`));
    manifest[String(n)] = screened[p.key];
    return { ...p, n, wave, name: keep.get(p.key)?.name?.trim() || p.title };
  });
  writeJson(sourceFile(source), [...done, ...added].sort((a, b) => a.n - b.n));
  // Written by Python, as halftone.py writes it (json.dump, indent=0, sort_keys), so the file diffs cleanly.
  const merge = "import json,sys; f=sys.argv[1]; m=json.load(open(f)); m.update(json.load(sys.stdin)); json.dump(m, open(f, 'w'), indent=0, sort_keys=True)";
  execFileSync(python(), ["-c", merge, halftoneFile], { input: JSON.stringify(manifest), env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  return { added: added.length, total: done.length + added.length };
}

/** Drops the cache files of refused candidates (the owner said no; nothing of theirs is kept). */
export function forget(source: SourceId, keys: string[]) {
  const dir = cacheDir(source);
  for (const k of keys) for (const f of [`jpg/${k}.jpg`, `cut/${k}.png`, `prep/print_${k}.webp`, `prep/${k}.json`, `screen/print_${k}.webp`]) rmSync(path.join(dir, f), { force: true });
}
