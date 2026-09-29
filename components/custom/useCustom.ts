"use client";

import { useEffect, useState } from "react";
import type { City, CustomSpec } from "@/lib/custom/spec";
import { assetUrl } from "@/lib/catalog";
import { MODEL_ASPECT } from "@/lib/images";
import { modelFor } from "@/lib/models";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

type Render = typeof import("./customRender");
let render: Promise<Render> | null = null;
/** The drawing chunk (templates, place list, sky), loaded once. */
export const loadRender = () => (render ??= import("./customRender"));

/** A spec as a picture for a tee colour: its SVG, and its city (a sky), once drawn. */
export interface DrawnPrint {
  spec: CustomSpec;
  color: BaseColor;
  svg: string;
  city?: City;
  summary: string;
}

export async function drawPrint(spec: CustomSpec, color: BaseColor): Promise<DrawnPrint> {
  const m = await loadRender();
  const data: { sky?: Awaited<ReturnType<Render["loadSky"]>>; city?: City; places?: City[] } = {};
  if (spec.t === "sky") {
    const [sky, places] = await Promise.all([m.loadSky(), m.loadCities()]);
    const city = places.byId(spec.p.c);
    if (!city) throw new Error("unknown city");
    Object.assign(data, { sky, city });
  }
  // Your Place draws the world's cities (and is named by one).
  if (spec.t === "place") {
    const places = await m.loadCities();
    Object.assign(data, { places: places.list, city: spec.p.c !== undefined ? places.byId(spec.p.c) : undefined });
  }
  // A later template loads its own data (lib/custom/renderers prepareData).
  Object.assign(data, await m.prepareData(spec));
  const render = await m.loadRenderer(spec.t);
  return { spec, color, svg: render(spec, color, data), city: data.city, summary: m.customSummary(spec, data.city) };
}

/**
 * A spec drawn for a colour, loading what it needs on first use. While the
 * next one is drawn the last stays (no flash of an empty picture); null
 * while there's none.
 */
export function useDrawn(spec: CustomSpec | null, color: BaseColor): DrawnPrint | null {
  const [drawn, setDrawn] = useState<DrawnPrint | null>(null);
  useEffect(() => {
    if (!spec) return setDrawn(null);
    let live = true;
    drawPrint(spec, color)
      .then((d) => live && setDrawn(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [spec, color]);
  return spec ? drawn : null;
}

/** A made-for-you print worn, `w` px wide (the share image's picture): its model photo with the print, as CustomMockup draws it. */
export async function drawTee(shirt: ShirtProduct, spec: CustomSpec, wanted: BaseColor, w = 1080): Promise<HTMLCanvasElement> {
  const color = teeColor(shirt, wanted);
  const model = modelFor(shirt, color);
  if (!model) throw new Error("no model photo");
  const [m, drawn] = await Promise.all([loadRender(), drawPrint(spec, color)]);
  const [photo] = await Promise.all([m.loadImage(assetUrl(`/models/${model.id}.webp`)), m.loadCanvasFonts()]);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = Math.round(w / MODEL_ASPECT);
  m.drawMockup(canvas.getContext("2d")!, canvas.width, canvas.height, photo, drawn.svg, model.box, color);
  return canvas;
}
