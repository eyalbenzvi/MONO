/**
 * The upload page's side of "From yours" (browser only): a file or words
 * checked before anything is converted (format, size, the lexicon on the
 * file name), converted in the worker (lib/upload/run), measured on each
 * tee, the tee chosen by rule and the tier set (measure, teeRule), and, on
 * "Add to bag", the rasters kept in IndexedDB with the upload's metadata in
 * the `mono-make` store. Nothing leaves the device.
 */
import { convertInWorker } from "./run";
import { inkFor, type Converted, type Mode, type PrintSize, type Tee, type UploadClass } from "./convert";
import { TYPES, WORD_CHARS, WORD_LINES } from "./decode";
import { designHash, measure, nearestCatalogue, tier, type Measures } from "./measure";
import { chooseTee } from "./teeRule";
import { cleanTitle } from "./title";
import { category, features, measured } from "./features";
import { MAX_BYTES, REASONS } from "./reasons";
import { inkCanvas, inkHash, inkPng } from "./bitmap";
import { getUpload, putUpload } from "./store";
import { useMakeStore, type UploadMeta } from "@/store/makeStore";
import type { FeatureVector, ShirtCategory } from "@/types/shirt";

export type Refusal = { ok: false; reason: string; code: string };

/** What the page has to convert: a file (checked), or words. */
export interface Prepared {
  kind: "file" | "svg" | "words";
  file?: Blob;
  type?: string;
  words?: string[];
  /** The file's name (for the title), or the words. */
  name: string;
}

export interface PreviewOk {
  ok: true;
  cls: UploadClass;
  mode: Mode;
  /** The tees it prints on, the chosen one first. */
  tees: Tee[];
  tee: Tee;
  /** The one line saying why this tee. */
  line: string;
  tier: "print" | "catalogue";
  near: boolean;
  hash: string;
  title: string;
  quality: number;
  distance: number;
  category: ShirtCategory;
  features: FeatureVector;
  /** The axes measured from the print (the taste's nudge uses these only). */
  measured: Partial<FeatureVector>;
  inks: Partial<Record<Tee, Uint8Array>>;
  /** The print in a tee's inks, for the mockup. */
  canvas: (tee: Tee) => HTMLCanvasElement | null;
}
export type Preview = PreviewOk | (Refusal & { cls?: UploadClass });

const EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
const lexicon = () => import("@/lib/custom/lexicon");

/** A file checked before converting: format, size, and the words in its name. */
export async function prepare(file: File): Promise<{ ok: true; value: Prepared } | Refusal> {
  const type = file.type || EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";
  if (!(TYPES as readonly string[]).includes(type)) return { ok: false, reason: REASONS.format, code: "format" };
  if (file.size > MAX_BYTES) return { ok: false, reason: REASONS.heavy, code: "heavy" };
  const words = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ");
  const problem = (await lexicon()).wordsProblem(words);
  if (problem) return { ok: false, reason: problem, code: "words" };
  return { ok: true, value: { kind: type === "image/svg+xml" ? "svg" : "file", file, type, name: file.name } };
}

/** Printable in the print font: Latin letters (with accents), figures and plain punctuation. */
const PRINTABLE = /^[\x20-\x7E -ſ]*$/;

export async function prepareWords(lines: string[]): Promise<{ ok: true; value: Prepared } | Refusal> {
  const words = lines.map((l) => l.trim()).filter(Boolean).slice(0, WORD_LINES);
  if (!words.length) return { ok: false, reason: REASONS.noWords, code: "empty" };
  if (words.some((l) => l.length > WORD_CHARS || !PRINTABLE.test(l))) return { ok: false, reason: `Up to ${WORD_LINES} lines of ${WORD_CHARS} letters, figures and plain punctuation.`, code: "chars" };
  const problem = (await lexicon()).wordsProblem(words.join(" "));
  if (problem) return { ok: false, reason: problem, code: "words" };
  return { ok: true, value: { kind: "words", words, name: words.join(" ") } };
}

let hashes: Promise<Uint32Array | null> | null = null;
/** The catalogue's dHashes (lib/search's index), loaded once; null when it can't be. */
const catalogueHashes = () =>
  (hashes ??= import("@/lib/search/load")
    .then((m) => m.loadSearchIndex())
    .then((i) => i?.hash ?? null)
    .catch(() => null));

/** Convert, measure on each tee, choose the tee, set the tier. A refusal says why in one line. */
export async function convert(source: Prepared, opts: { mode: "dots" | "lines"; size: PrintSize }): Promise<Preview> {
  const req = source.words ? { words: source.words, size: opts.size } : { file: source.file!, type: source.type!, mode: opts.mode as Mode, size: opts.size };
  const res = await convertInWorker(req);
  if (!res.ok) return { ok: false, reason: res.reason, code: codeOf(res.reason) };
  const conv = res.converted;
  const inks: Partial<Record<Tee, Uint8Array>> = { black: inkFor(conv, "black"), white: inkFor(conv, "white") };
  const ms: Partial<Record<Tee, Measures>> = {};
  const on = (t: Tee) => (ms[t] ??= measure(inks[t]!, conv.w, conv.h, t, { screened: conv.mode === "dots", size: conv.size }));
  const choice = chooseTee(conv, on);
  const tee = choice.tee;
  const index = await catalogueHashes();
  const distance = index ? nearestCatalogue(designHash(inks[tee]!, conv.w, conv.h), index) : 64;
  const t = tier(on(tee), tee, distance);
  if (t.tier === "refuse") return { ok: false, reason: t.reason ?? REASONS.weak, code: codeOf(t.reason ?? ""), cls: conv.cls };
  const other: Tee = tee === "black" ? "white" : "black";
  const tees: Tee[] = choice.other && tier(on(other), other, distance).tier !== "refuse" ? [tee, other] : [tee];
  const m = on(tee);
  const f = features(conv, m);
  const own = measured(conv, m);
  const drawn = new Map<Tee, HTMLCanvasElement>();
  return {
    ok: true,
    cls: conv.cls,
    mode: conv.mode,
    tees,
    tee,
    line: choice.line,
    tier: t.tier,
    near: t.near,
    hash: inkHash(inks[tee]!),
    title: cleanTitle(source.name, conv.cls),
    quality: m.quality,
    distance,
    category: category(conv, f, m),
    features: f,
    measured: own,
    inks: Object.fromEntries(tees.map((x) => [x, inks[x]])),
    canvas: (x) => {
      const ink = inks[x];
      if (!ink || !tees.includes(x)) return null;
      if (!drawn.has(x)) drawn.set(x, inkCanvas(ink, x));
      return drawn.get(x)!;
    },
  };
}

/** The refusal's kind, for analytics (never the file or its words). */
function codeOf(reason: string): string {
  const hit = (Object.entries(REASONS) as [string, string][]).find(([, r]) => r === reason);
  if (hit) return hit[0];
  if (/^Lines under/.test(reason)) return "stroke";
  if (/^Gaps under/.test(reason)) return "gap";
  return "other";
}

const newId = () => Date.now().toString(36) + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, "0");

/** Keeps an upload on this device: its rasters and working copy in IndexedDB, its metadata in `mono-make`. Returns its id. */
export async function keep(source: Prepared, p: PreviewOk, o: { title: string; tees: Tee[]; size: PrintSize }): Promise<string> {
  const id = newId();
  const rasters: Partial<Record<Tee, Blob>> = {};
  for (const t of o.tees) if (p.inks[t]) rasters[t] = await inkPng(p.inks[t]!);
  await putUpload({ id, rasters, ...(source.file ? { source: source.file } : {}), ...(source.words ? { words: source.words } : {}), createdAt: Date.now() });
  const meta: UploadMeta = {
    id,
    title: o.title || p.title,
    cls: p.cls,
    mode: p.mode,
    size: o.size,
    tees: o.tees,
    hash: p.hash,
    tier: p.tier,
    near: p.near,
    quality: p.quality,
    distance: p.distance,
    category: p.category,
    features: p.features,
    createdAt: Date.now(),
  };
  useMakeStore.getState().putUpload(meta);
  return id;
}
/** An upload in the bag, opened again for Edit (its working copy), or null when it's gone. */
export async function reopen(id: string): Promise<Prepared | null> {
  const u = await getUpload(id).catch(() => undefined);
  if (!u) return null;
  if (u.words) return { kind: "words", words: u.words, name: u.words.join(" ") };
  if (!u.source) return null;
  const type = u.source.type;
  return { kind: type === "image/svg+xml" ? "svg" : "file", file: u.source, type, name: useMakeStore.getState().uploads[id]?.title ?? "" };
}
