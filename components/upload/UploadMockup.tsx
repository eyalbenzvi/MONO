"use client";

import { useEffect, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { MODEL_ASPECT } from "@/lib/images";
import { release } from "@/lib/custom/raster";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

/** Rasters drawn (upload, tee), the few most recent kept (each is 12 MB of canvas); an evicted one gives its memory back. */
const cache = new Map<string, Promise<HTMLCanvasElement | null>>();
const CACHE_MAX = 6;

/** An upload's print for a tee, from IndexedDB, as a canvas in that tee's inks (null when it's gone from the device). */
export function uploadCanvas(uploadId: string, color: BaseColor): Promise<HTMLCanvasElement | null> {
  const key = `${uploadId}|${color}`;
  if (!cache.has(key)) {
    const p = (async () => {
      const [{ getUpload, available }, { pngInk, inkCanvas }] = await Promise.all([import("@/lib/upload/store"), import("@/lib/upload/bitmap")]);
      if (!available()) return null;
      const u = await getUpload(uploadId);
      const png = u?.rasters[color] ?? u?.rasters.black ?? u?.rasters.white;
      return png ? inkCanvas(await pngInk(png), color) : null;
    })().catch(() => null);
    cache.set(key, p);
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value!;
      void cache.get(oldest)!.then(release);
      cache.delete(oldest);
    }
  }
  return cache.get(key)!;
}
/** An uploaded print worn: the model photo with the raster laid in the print box; an empty stage until it's read. */
export default function UploadMockup({ shirt, uploadId, color, className = "", label }: { shirt: ShirtProduct; uploadId: string; color: BaseColor; sizes?: string; className?: string; label?: string }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let live = true;
    void uploadCanvas(uploadId, color).then((c) => live && setCanvas(c));
    return () => {
      live = false;
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
