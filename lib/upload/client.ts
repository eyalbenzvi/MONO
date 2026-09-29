/**
 * The upload page's engine (browser only). A file or words is opened once
 * (checked: format, size, the lexicon on its name), then converted for a
 * set of settings — the crop, a quarter turn, "Stronger" (levels and a
 * gamma boost on the source), Dots or Lines, Full or Small, "Bolder" (one
 * step thicker, line work only) — in the worker (lib/upload/run), measured
 * on both tees, the tee chosen by rule (teeRule) and the tier set
 * (measure). Every result is cached by its settings, so going back, the
 * choice thumbnails and the fixes cost nothing twice. A failing print comes
 * back with its picture and the fixes worth trying; passingFixes tries them.
 * "Add to bag" keeps the rasters in IndexedDB and the metadata in the
 * `mono-make` store. Nothing leaves the device.
 */
import { convertInWorker, type UploadRequest } from "./run";
import { MAX_LONG, MIN_SHORT, inkFor, type Converted, type Mode, type Pixels, type PrintSize, type Tee, type UploadClass } from "./convert";
import { TYPES, WORD_CHARS, WORD_LINES } from "./decode";
import { designHash, measure, nearestIndex, tier, type Measures } from "./measure";
import { chooseTee } from "./teeRule";
import { cleanTitle } from "./title";
import { category, features, measured } from "./features";
import { MAX_BYTES, REASONS } from "./reasons";
import { inkCanvas, inkHash, inkPng, W, H } from "./bitmap";
import { getUpload, putUpload, deleteUpload } from "./store";
import { useMakeStore, type UploadMeta } from "@/store/makeStore";
import type { FeatureVector, ShirtCategory } from "@/types/shirt";

export type Refusal = { ok: false; reason: string; code: string };
export type { Tee, PrintSize };

/** A crop of the source, as fractions of its (turned) width and height. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Rot = 0 | 90 | 180 | 270;
export interface Settings {
  crop: Crop | null;
  rot: Rot;
  stronger: boolean;
  bolder: boolean;
  mode: "dots" | "lines";
  size: PrintSize;
}
export const DEFAULTS: Settings = { crop: null, rot: 0, stronger: false, bolder: false, mode: "dots", size: "full" };
export const settingsKey = (s: Settings) => JSON.stringify([s.crop && [s.crop.x, s.crop.y, s.crop.w, s.crop.h].map((v) => v.toFixed(3)), s.rot, s.stronger, s.bolder, s.mode, s.size]);

/** What the page converts: a picture (decoded once), an SVG, or words. */
export interface Source {
  id: string;
  kind: "file" | "svg" | "words";
  name: string;
  file?: Blob;
  type?: string;
  words?: string[];
  /** The picture, the right way up (EXIF applied); absent for words. */
  bitmap?: ImageBitmap;
  /** Its size in pixels, the right way up. */
  w: number;
  h: number;
}

export interface TeeResult {
  ok: boolean;
  reason?: string;
  ink: Uint8Array;
}
interface Common {
  cls?: UploadClass;
  mode?: Mode;
  size: PrintSize;
  /** Too small for Full, so it went to Small. */
  autoSmall?: boolean;
  /** The print in a tee's inks, for the mockup (a failed print too). */
  canvas: (tee: Tee) => HTMLCanvasElement | null;
}
export interface PreviewOk extends Common {
  ok: true;
  cls: UploadClass;
  mode: Mode;
  /** The tees it prints on, the suggested one first. */
  tees: Tee[];
  tee: Tee;
  /** The one line saying why this tee. */
  line: string;
  perTee: Record<Tee, TeeResult>;
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
}
export interface PreviewFail extends Common, Refusal {
  /** The tee the failed print is shown on, when there is a print to show. */
  tee?: Tee;
  perTee?: Record<Tee, TeeResult>;
  /** A near-copy of a catalogue design: its id, to link to. */
  duplicateOf?: string;
}
export type Preview = PreviewOk | PreviewFail;

const EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
const lexicon = () => import("@/lib/custom/lexicon");
const newId = () => Date.now().toString(36) + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, "0");

/* ------------------------------------------------------------------ */
/* Opening                                                             */
/* ------------------------------------------------------------------ */

/** A file opened: format, size and the words in its name checked, the picture decoded the right way up. */
export async function openFile(file: File | Blob, name = (file as File).name ?? "file"): Promise<{ ok: true; source: Source } | Refusal> {
  const type = file.type || EXT[name.split(".").pop()?.toLowerCase() ?? ""] || "";
  if (!(TYPES as readonly string[]).includes(type)) return { ok: false, reason: REASONS.format, code: "format" };
  if (file.size > MAX_BYTES) return { ok: false, reason: REASONS.heavy, code: "heavy" };
  const problem = (await lexicon()).wordsProblem(name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " "));
  if (problem) return { ok: false, reason: problem, code: "words" };
  if (type === "image/svg+xml") return { ok: true, source: { id: newId(), kind: "svg", name, file, type, w: 1500, h: 1500 } };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, reason: REASONS.unreadable, code: "unreadable" };
  }
  if (Math.min(bitmap.width, bitmap.height) < MIN_SHORT.small) {
    bitmap.close();
    return { ok: false, reason: REASONS.smallForSmall, code: "smallForSmall" };
  }
  return { ok: true, source: { id: newId(), kind: "file", name, file, type, bitmap, w: bitmap.width, h: bitmap.height } };
}

/** Printable in the print font: Latin letters (with accents), figures and plain punctuation. */
const PRINTABLE = /^[\x20-\x7E -ſ]*$/;
/** Words as a source: up to three lines of 24, printable, past the lexicon. */
export async function openWords(lines: string[], keepId?: string): Promise<{ ok: true; source: Source } | Refusal> {
  const words = lines.map((l) => l.trim()).filter(Boolean).slice(0, WORD_LINES);
  if (!words.length) return { ok: false, reason: REASONS.noWords, code: "empty" };
  if (words.some((l) => l.length > WORD_CHARS || !PRINTABLE.test(l))) return { ok: false, reason: "Letters, figures and plain punctuation only.", code: "chars" };
  const problem = (await lexicon()).wordsProblem(words.join(" "));
  if (problem) return { ok: false, reason: problem, code: "words" };
  return { ok: true, source: { id: keepId ?? newId(), kind: "words", words, name: words.join(" "), w: 1500, h: 1000 } };
}

/* ------------------------------------------------------------------ */
/* The source, prepared for a setting                                  */
/* ------------------------------------------------------------------ */

/** The crop in the source's own pixels (after the turn), and its short side. */
export function cropPixels(src: Pick<Source, "w" | "h">, s: Pick<Settings, "crop" | "rot">) {
  const [tw, th] = s.rot % 180 ? [src.h, src.w] : [src.w, src.h];
  const c = s.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const box = { x: Math.round(c.x * tw), y: Math.round(c.y * th), w: Math.max(1, Math.round(c.w * tw)), h: Math.max(1, Math.round(c.h * th)) };
  return { tw, th, box, short: Math.min(box.w, box.h) };
}

function canvas2d(w: number, h: number) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  return { c, ctx: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}

/** The picture turned, cropped and scaled to at most `long` on its long side (and made stronger when asked). */
export function sourcePixels(src: Source, s: Pick<Settings, "crop" | "rot" | "stronger">, long = MAX_LONG): Pixels {
  const { box, tw, th } = cropPixels(src, s);
  const k = Math.min(1, long / Math.max(box.w, box.h));
  const [w, h] = [Math.max(1, Math.round(box.w * k)), Math.max(1, Math.round(box.h * k))];
  const { ctx } = canvas2d(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-box.x, -box.y);
  // The turn about the turned image's own frame.
  ctx.translate(tw / 2, th / 2);
  ctx.rotate((s.rot * Math.PI) / 180);
  ctx.drawImage(src.bitmap!, -src.w / 2, -src.h / 2);
  ctx.restore();
  const data = ctx.getImageData(0, 0, w, h).data;
  if (s.stronger) strengthen(data);
  return { w, h, data };
}

/**
 * "Stronger": the luminance stretched from its 2nd to its 98th percentile,
 * then a gamma of 1.35 (the mid-tones darker), so a pale picture carries
 * enough contrast to print. Colour follows the luminance.
 */
export function strengthen(data: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  const n = data.length / 4;
  for (let i = 0; i < n; i++) hist[Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2])]++;
  const at = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= q * n) return v;
    return 255;
  };
  const [lo, hi] = [at(0.02), Math.max(at(0.98), at(0.02) + 1)];
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, (v - lo) / (hi - lo))), 1.35));
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = lut[data[i + c]];
}

/** "Bolder": line work one pixel thicker all round (about 0.2 mm each side). */
export function bolden(ink: Uint8Array, w = W, h = H): Uint8Array {
  const out = new Uint8Array(ink.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
        }
    }
  return out;
}

/* ------------------------------------------------------------------ */
/* Converting and judging                                              */
/* ------------------------------------------------------------------ */

let hashes: Promise<Uint32Array | null> | null = null;
/** The catalogue's dHashes (lib/search's index, in the catalogue's order), loaded once; null when it can't be. */
const catalogueHashes = () =>
  (hashes ??= import("@/lib/search/load")
    .then((m) => m.loadSearchIndex())
    .then((i) => i?.hash ?? null)
    .catch(() => null));

/** The refusal's kind, for analytics and the fixes (never the file or its words). */
export function codeOf(reason: string): string {
  const hit = (Object.entries(REASONS) as [string, string][]).find(([, r]) => r === reason);
  if (hit) return hit[0];
  if (/^Lines under/.test(reason)) return "stroke";
  if (/^Gaps under/.test(reason)) return "gap";
  return "other";
}

const flip = (t: Tee): Tee => (t === "black" ? "white" : "black");

/** Results by source and settings (the last few sources). */
const cache = new Map<string, Promise<Preview>>();
const CACHE_MAX = 24;

/** Converts a source for a setting, measured and judged; cached. */
export function convertWith(src: Source, s: Settings): Promise<Preview> {
  const key = `${src.id}|${settingsKey(s)}`;
  let p = cache.get(key);
  if (!p) {
    p = run(src, s);
    cache.set(key, p);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return p;
}

async function run(src: Source, s: Settings): Promise<Preview> {
  let size = s.size;
  let autoSmall = false;
  let req: UploadRequest;
  if (src.kind === "words") req = { words: src.words!, size };
  else if (src.kind === "svg") req = { file: src.file!, type: src.type!, size };
  else {
    const { short } = cropPixels(src, s);
    if (short < MIN_SHORT.small) return fail(REASONS.smallForSmall, size);
    if (size === "full" && short < MIN_SHORT.full) (size = "small"), (autoSmall = true);
    req = { pixels: sourcePixels(src, s), mode: s.mode as Mode, size, checked: true };
  }
  const res = await convertInWorker(req);
  if (!res.ok) return fail(res.reason, size);
  const conv = res.converted;
  const line = conv.mode !== "dots";
  const inks: Record<Tee, Uint8Array> = { black: inkFor(conv, "black"), white: inkFor(conv, "white") };
  if (s.bolder && line) (inks.black = bolden(inks.black)), (inks.white = inks.black === inks.white ? inks.black : bolden(inks.white));
  const ms: Partial<Record<Tee, Measures>> = {};
  const on = (t: Tee) => (ms[t] ??= measure(inks[t], conv.w, conv.h, t, { screened: conv.mode === "dots", size: conv.size }));
  const index = await catalogueHashes();
  const near = index ? nearestIndex(designHash(inks.white, conv.w, conv.h), index) : { index: -1, distance: 64 };
  const perTee = {} as Record<Tee, TeeResult>;
  for (const t of ["black", "white"] as const) {
    const r = tier(on(t), t, near.distance);
    perTee[t] = { ok: r.tier !== "refuse", reason: r.reason, ink: inks[t] };
  }
  const drawn = new Map<Tee, HTMLCanvasElement>();
  const canvas = (t: Tee) => {
    if (!drawn.has(t)) drawn.set(t, inkCanvas(inks[t], t));
    return drawn.get(t)!;
  };
  const choice = chooseTee(conv, on);
  // The rule's tee, unless it fails there and the other passes: then the other is suggested.
  let tee = choice.tee;
  if (!perTee[tee].ok && perTee[flip(tee)].ok) tee = flip(tee);
  const t = tier(on(tee), tee, near.distance);
  if (t.tier === "refuse") {
    const reason = t.reason ?? REASONS.weak;
    const duplicateOf = reason === REASONS.duplicate && near.index >= 0 ? (await import("@/lib/catalog")).SHIRTS[near.index]?.id : undefined;
    return { ok: false, reason, code: codeOf(reason), cls: conv.cls, mode: conv.mode, size, autoSmall, tee, perTee, canvas, ...(duplicateOf ? { duplicateOf } : {}) };
  }
  const other = flip(tee);
  const tees: Tee[] = perTee[other].ok && (tee === choice.tee ? choice.other : true) ? [tee, other] : [tee];
  const m = on(tee);
  const f = features(conv, m);
  return {
    ok: true,
    cls: conv.cls,
    mode: conv.mode,
    size,
    autoSmall,
    tees,
    tee,
    line: tee === choice.tee ? choice.line : `It prints on ${tee}, not on ${other}.`,
    perTee,
    tier: t.tier,
    near: t.near,
    hash: inkHash(inks[tee]),
    title: cleanTitle(src.name, conv.cls),
    quality: m.quality,
    distance: near.distance,
    category: category(conv, f, m),
    features: f,
    measured: measured(conv, m),
    inks: Object.fromEntries(tees.map((x) => [x, inks[x]])),
    canvas,
  };
}

function fail(reason: string, size: PrintSize): PreviewFail {
  return { ok: false, reason, code: codeOf(reason), size, canvas: () => null };
}

/* ------------------------------------------------------------------ */
/* Fixes                                                               */
/* ------------------------------------------------------------------ */

export interface Fix {
  id: "stronger" | "lines" | "dots" | "small" | "full" | "bolder" | "crop";
  label: string;
  /** The settings it changes (none: it opens Adjust). */
  patch?: Partial<Settings>;
}

/** What a failure means, in one line (the fix card). */
export const MEANING: Record<string, string> = {
  faint: "Too little contrast to print. It would come out as a grey haze.",
  solid: "Too much ink in one place. It would print as a patch.",
  solidDots: "Too much ink in one place. It would print as a patch.",
  dense: "Too much ink to print. The tee would be mostly ink.",
  denseDots: "Too much ink to print. The tee would be mostly ink.",
  plain: "Too little going on to print well.",
  weak: "This one wouldn't print well as it is.",
  stroke: "Lines too fine for this tee. They'd break up in the print.",
  gap: "Gaps too narrow. They'd fill in with ink.",
  duplicate: "This is already one of ours.",
};

/** The fixes worth trying for a failure, in order (the PM's table), before any is tried. */
export function fixesFor(f: PreviewFail, s: Settings, src: Pick<Source, "kind">): Fix[] {
  const photo = f.cls === "photo";
  const picture = src.kind === "file";
  const out: Fix[] = [];
  const add = (x: Fix, when: boolean) => when && !out.some((o) => o.id === x.id) && out.push(x);
  const stronger: Fix = { id: "stronger", label: "Stronger", patch: { stronger: true } };
  const lines: Fix = { id: "lines", label: "Use Lines", patch: { mode: "lines" } };
  // A photograph in Lines that fails as lines goes back to dots, which carry tone instead of edges.
  const dots: Fix = { id: "dots", label: "Use Dots", patch: { mode: "dots" } };
  const small: Fix = { id: "small", label: "Use Small", patch: { size: "small" } };
  const full: Fix = { id: "full", label: "Use Full", patch: { size: "full" } };
  const bolder: Fix = { id: "bolder", label: "Bolder", patch: { bolder: true } };
  const crop: Fix = { id: "crop", label: "Crop tighter" };
  switch (f.code) {
    case "faint":
    case "weak":
      add(stronger, picture && !s.stronger);
      add(lines, photo && s.mode === "dots");
      add(full, f.size === "small");
      break;
    case "solid":
    case "solidDots":
    case "dense":
    case "denseDots":
      add(lines, photo && s.mode === "dots");
      add(dots, photo && s.mode === "lines");
      add(small, f.size === "full" && !f.autoSmall);
      add(crop, picture);
      break;
    case "stroke":
    case "gap":
      add(full, f.size === "small");
      add(dots, photo && s.mode === "lines");
      add(bolder, f.code === "stroke" && !photo && !s.bolder);
      add(bolder, f.code === "stroke" && photo && s.mode === "lines" && !s.bolder);
      break;
    case "plain":
      add(full, f.size === "small");
      add(crop, picture);
      break;
  }
  return out;
}

/** The fixes that pass once tried (up to three tried; "Crop tighter" can't be tried, so it's kept last). */
export async function passingFixes(src: Source, s: Settings, f: PreviewFail): Promise<{ fix: Fix; settings: Settings; preview: PreviewOk }[]> {
  const tries = fixesFor(f, s, src).filter((x) => x.patch).slice(0, 3);
  const results = await Promise.all(
    tries.map(async (fix) => {
      const settings = { ...s, ...fix.patch };
      const p = await convertWith(src, settings);
      return p.ok ? { fix, settings, preview: p } : null;
    }),
  );
  return results.filter((r): r is NonNullable<typeof r> => !!r);
}

/* ------------------------------------------------------------------ */
/* Keeping (the bag), the draft, Edit                                  */
/* ------------------------------------------------------------------ */

/** Keeps an upload on this device: its rasters and the source (for Edit) in IndexedDB, its metadata in `mono-make`. Returns its id. */
export async function keep(src: Source, p: PreviewOk, o: { title: string; tees: Tee[]; settings: Settings }): Promise<string> {
  const id = newId();
  const rasters: Partial<Record<Tee, Blob>> = {};
  for (const t of o.tees) if (p.inks[t]) rasters[t] = await inkPng(p.inks[t]!);
  await putUpload({ id, rasters, ...(src.file ? { source: src.file } : {}), ...(src.words ? { words: src.words } : {}), settings: o.settings, createdAt: Date.now() });
  const meta: UploadMeta = {
    id,
    title: o.title || p.title,
    cls: p.cls,
    mode: p.mode,
    size: p.size,
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

/** A kept upload (or the draft) opened again: its source and settings, or null when it's gone. */
export async function reopen(id: string): Promise<{ source: Source; settings: Settings; name: string } | null> {
  const u = await getUpload(id).catch(() => undefined);
  if (!u) return null;
  const settings = { ...DEFAULTS, ...(u.settings as Partial<Settings> | undefined) };
  const name = u.name ?? useMakeStore.getState().uploads[id]?.title ?? "file";
  if (u.words) {
    const r = await openWords(u.words);
    return r.ok ? { source: r.source, settings, name } : null;
  }
  if (!u.source) return null;
  const r = await openFile(u.source, name);
  return r.ok ? { source: r.source, settings, name } : null;
}

/** The draft: one slot, the source in hand and its settings, so a reload (or a discarded tab) comes back to it. */
export const DRAFT = "draft";
export async function saveDraft(src: Source, settings: Settings) {
  await putUpload({ id: DRAFT, rasters: {}, ...(src.file ? { source: src.file } : {}), ...(src.words ? { words: src.words } : {}), name: src.name, settings, createdAt: Date.now() }).catch(() => {});
}
export const clearDraft = () => deleteUpload(DRAFT).catch(() => {});
