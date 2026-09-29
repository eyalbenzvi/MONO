/**
 * The upload page's engine (browser only). A file is opened once
 * (checked: format, size, the lexicon on its name), then converted for a
 * set of settings — the crop, a quarter turn, a mirror, light and contrast,
 * "Stronger" (levels and a gamma boost on the source), Dots, Lines or
 * Drawing, Full or Small, "Bolder" (one
 * step thicker, line work only) — in the worker (lib/upload/run), measured
 * on both tees, the tee chosen by rule (teeRule) and the tier set
 * (measure). Every result is cached by its settings, so going back, the
 * choice thumbnails and the fixes cost nothing twice. A failing print comes
 * back with its picture and the fixes worth trying; passingFixes tries them.
 * "Add to bag" keeps the rasters in IndexedDB and the metadata in the
 * `mono-make` store. Nothing leaves the device.
 */
import { convertInWorker, type UploadRequest } from "./run";
import { MIN_SHORT, inkFor, type Converted, type Mode, type Pixels, type PrintSize, type Tee, type UploadClass } from "./convert";
import { TYPES } from "./decode";
import { designHash, measure, nearestIndex, tier, type Measures } from "./measure";
import { chooseTee } from "./teeRule";
import { cleanTitle } from "./title";
import { category, features, measured } from "./features";
import { MAX_BYTES, REASONS } from "./reasons";
import { inkCanvas, inkHash, inkPng, W, H } from "./bitmap";
import { getUpload, putUpload, deleteUpload } from "./store";
import { cropPixels, sourcePixels } from "./pixels";
// The picture helpers live on their own (no converter), so the page can draw with them before the engine loads.
export { TONE_MAX, cropPixels, sourcePixels, strengthen, tone } from "./pixels";
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
  /** Mirrored left to right (after the turn). */
  flip: boolean;
  /** Brighter (+) or darker (-), in percent. */
  light: number;
  /** More (+) or less (-) contrast, in percent. */
  contrast: number;
  stronger: boolean;
  bolder: boolean;
  /** A photograph's style; Drawing reads it as line work (a sketch photographed on paper). */
  mode: "dots" | "lines" | "drawing";
  size: PrintSize;
}
export const DEFAULTS: Settings = { crop: null, rot: 0, flip: false, light: 0, contrast: 0, stronger: false, bolder: false, mode: "dots", size: "full" };
/** The settings as a cache key; the edits added later join it only when used, so the earlier keys (and results) stay the same. */
export const settingsKey = (s: Settings) =>
  JSON.stringify([
    s.crop && [s.crop.x, s.crop.y, s.crop.w, s.crop.h].map((v) => v.toFixed(3)),
    s.rot,
    s.stronger,
    s.bolder,
    s.mode,
    s.size,
    ...(s.flip || s.light || s.contrast ? [s.flip, s.light, s.contrast] : []),
  ]);
/** Whether a picture has been edited (anything the edit sheet sets). */
export const edited = (s: Settings) => !!(s.crop || s.rot || s.flip || s.light || s.contrast || s.stronger);

/** What the page converts: a picture (decoded once) or an SVG. */
export interface Source {
  id: string;
  kind: "file" | "svg";
  name: string;
  file?: Blob;
  type?: string;
  /** The picture, the right way up (EXIF applied); absent for an SVG. */
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

/* ------------------------------------------------------------------ */
/* The source, prepared for a setting                                  */
/* ------------------------------------------------------------------ */

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
  if (src.kind === "svg") req = { file: src.file!, type: src.type!, size };
  else {
    const { short } = cropPixels(src, s);
    if (short < MIN_SHORT.small) return fail(REASONS.smallForSmall, size);
    if (size === "full" && short < MIN_SHORT.full) (size = "small"), (autoSmall = true);
    req = { pixels: sourcePixels(src, s), mode: s.mode, size, checked: true };
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
  /** The settings it changes (none: it opens Edit photo). */
  patch?: Partial<Settings>;
}

/** What a failure means, under its reason in the fix card: only what the reason doesn't already say. */
export const MEANING: Record<string, string> = {
  faint: "It would come out as a grey haze.",
  solid: "It would print as a patch.",
  solidDots: "It would print as a patch.",
  dense: "The tee would be mostly ink.",
  denseDots: "The tee would be mostly ink.",
  stroke: "They’d break up in the print.",
  gap: "They’d fill in with ink.",
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
      add(dots, (photo && s.mode === "lines") || s.mode === "drawing");
      add(small, f.size === "full" && !f.autoSmall);
      add(crop, picture);
      break;
    case "stroke":
    case "gap":
      add(full, f.size === "small");
      add(dots, photo && s.mode === "lines");
      add(bolder, f.code === "stroke" && s.mode === "drawing" && !s.bolder);
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
  await putUpload({ id, rasters, ...(src.file ? { source: src.file } : {}), settings: o.settings, createdAt: Date.now() });
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
  if (!u.source) {
    // A draft with nothing to open (words, from before they were taken out) is only in the way.
    if (id === DRAFT) void clearDraft();
    return null;
  }
  const r = await openFile(u.source, name);
  return r.ok ? { source: r.source, settings, name } : null;
}

/** The draft: one slot, the source in hand and its settings, so a reload (or a discarded tab) comes back to it. */
export const DRAFT = "draft";
export async function saveDraft(src: Source, settings: Settings) {
  await putUpload({ id: DRAFT, rasters: {}, ...(src.file ? { source: src.file } : {}), name: src.name, settings, createdAt: Date.now() }).catch(() => {});
}
export const clearDraft = () => deleteUpload(DRAFT).catch(() => {});
