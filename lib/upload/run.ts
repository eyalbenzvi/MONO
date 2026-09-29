/**
 * The page's way in to the upload conversion: convertInWorker(request)
 * starts the worker on first use and keeps it for the next file. Where
 * there is no Worker (the tests, an old browser) the same code runs on the
 * main thread. An SVG the worker can't decode (most browsers decode SVG
 * only where there's a document) is drawn here instead and sent back as
 * pixels; it has been sanitised first either way.
 */
import { sanitiseSvg } from "./convert";
import { SVG_LONG, SVG_ON_MAIN, handle, sizedSvg, type UploadRequest, type UploadResult } from "./decode";
import { REASONS } from "./reasons";

export type { UploadRequest, UploadResult } from "./decode";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: UploadResult) => void>();

function start(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
  worker.onmessage = (e: MessageEvent<{ id: number; res: UploadResult }>) => {
    pending.get(e.data.id)?.(e.data.res);
    pending.delete(e.data.id);
  };
  worker.onerror = () => {
    // A worker that fails to start or dies: the waiting requests fail, the next one starts afresh.
    for (const done of pending.values()) done({ ok: false, reason: REASONS.unreadable });
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** A conversion that takes longer than this is stuck (a file built to hang the decoder): the worker is stopped and the file refused. */
const WORKER_TIMEOUT_MS = 45_000;

function post(w: Worker, req: UploadRequest): Promise<UploadResult> {
  return new Promise((resolve) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      // Everything waiting on this worker fails; the next request starts a fresh one.
      for (const done of pending.values()) done({ ok: false, reason: REASONS.unreadable });
      pending.clear();
      w.terminate();
      if (worker === w) worker = null;
    }, WORKER_TIMEOUT_MS);
    pending.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    w.postMessage({ id, req });
  });
}

/** A sanitised SVG drawn on this thread with an <img> (which never runs its scripts nor loads anything), SVG_LONG on its long side. */
async function svgHere(file: Blob): Promise<UploadRequest | UploadResult> {
  const s = sanitiseSvg(await file.text());
  if (!s.ok) return { ok: false, reason: s.reason };
  const url = URL.createObjectURL(new Blob([sizedSvg(s.svg)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = SVG_LONG / Math.max(img.naturalWidth, img.naturalHeight);
    const [w, h] = [Math.max(1, Math.round(img.naturalWidth * k)), Math.max(1, Math.round(img.naturalHeight * k))];
    const c = document.createElement("canvas");
    [c.width, c.height] = [w, h];
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { svgRaster: { w, h, data: ctx.getImageData(0, 0, w, h).data }, size: "full" };
  } catch {
    return { ok: false, reason: REASONS.unreadable };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Converts one upload, off the main thread where it can. */
export async function convertInWorker(req: UploadRequest): Promise<UploadResult> {
  const w = start();
  const res = w ? await post(w, req) : await handle(req);
  if (res.ok || res.reason !== SVG_ON_MAIN) return res;
  if (!("file" in req) || typeof document === "undefined") return { ok: false, reason: REASONS.unreadable };
  const drawn = await svgHere(req.file);
  if ("ok" in drawn) return drawn;
  const again = { ...drawn, size: req.size } as UploadRequest;
  return w ? post(w, again) : handle(again);
}
