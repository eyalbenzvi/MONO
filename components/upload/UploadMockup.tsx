"use client";

import { useEffect, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { MODEL_ASPECT } from "@/lib/images";
import { release } from "@/lib/custom/raster";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

/**
 * Rasters drawn (upload, tee), the few most recent kept (each is 12 MB of
 * canvas). Only a raster no mockup on the page is showing is evicted and
 * gives its memory back: a bag of many lines keeps every one it shows.
 */
const cache = new Map<string, Promise<HTMLCanvasElement | null>>();
const CACHE_MAX = 6;
/** How many mounted mockups show each raster. */
const inUse = new Map<string, number>();

/** Evicts the oldest rasters nothing shows, down to CACHE_MAX; never `keep` (the one just asked for). */
function trim(keep?: string) {
  for (const key of [...cache.keys()]) {
    if (cache.size <= CACHE_MAX) return;
    if (key === keep || inUse.get(key)) continue;
    void cache.get(key)!.then(release);
    cache.delete(key);
  }
}

/** An upload's print for a tee, from IndexedDB, as a canvas in that tee's inks (null when it's gone from the device). */
export function uploadCanvas(uploadId: string, color: BaseColor): Promise<HTMLCanvasElement | null> {
  const key = `${uploadId}|${color}`;
  let p = cache.get(key);
  if (p) {
    // Most recently used last.
    cache.delete(key);
    cache.set(key, p);
    return p;
  }
  p = (async () => {
    const [{ getUpload, available }, { pngInk, inkCanvas }] = await Promise.all([import("@/lib/upload/store"), import("@/lib/upload/bitmap")]);
    if (!available()) return null;
    const u = await getUpload(uploadId);
    const png = u?.rasters[color] ?? u?.rasters.black ?? u?.rasters.white;
    return png ? inkCanvas(await pngInk(png), color) : null;
  })().catch(() => null);
  cache.set(key, p);
  trim(key);
  return p;
}

/** An uploaded print worn: the model photo with the raster laid in the print box; an empty stage until it's read. */
export default function UploadMockup({ shirt, uploadId, color, className = "", label }: { shirt: ShirtProduct; uploadId: string; color: BaseColor; sizes?: string; className?: string; label?: string }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let live = true;
    const key = `${uploadId}|${color}`;
    inUse.set(key, (inUse.get(key) ?? 0) + 1);
    void uploadCanvas(uploadId, color).then((c) => live && setCanvas(c));
    return () => {
      live = false;
      const n = (inUse.get(key) ?? 1) - 1;
      if (n > 0) inUse.set(key, n);
      else inUse.delete(key);
      trim();
    };
  }, [uploadId, color]);
  if (!canvas) return <div className={className} style={{ aspectRatio: `${MODEL_ASPECT}` }} role="img" aria-label={`${label ?? shirt.title}, worn on a ${color} tee`} />;
  return <CustomMockup shirt={shirt} svg={canvas} color={color} className={className} label={label ?? shirt.title} />;
}

/** An uploaded print worn, as one canvas (the share image's tee). */
export async function drawUploadTee(shirt: ShirtProduct, uploadId: string, color: BaseColor, w = 1080): Promise<HTMLCanvasElement> {
  const [{ modelFor }, { assetUrl }, raster, print] = await Promise.all([import("@/lib/models"), import("@/lib/catalog"), import("@/lib/custom/raster"), uploadCanvas(uploadId, color)]);
  const model = modelFor(shirt, color);
  if (!model || !print) throw new Error("no picture");
  const photo = await raster.loadImage(assetUrl(`/models/${model.id}.webp`));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = Math.round(w / MODEL_ASPECT);
  raster.drawMockup(canvas.getContext("2d")!, canvas.width, canvas.height, photo, print, model.box, color);
  return canvas;
}
