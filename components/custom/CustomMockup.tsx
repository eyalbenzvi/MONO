"use client";

import { useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/catalog";
import { MODEL_ASPECT, mockupImage } from "@/lib/images";
import { modelFor } from "@/lib/models";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { drawDetail, drawMockup, loadImage, release, type PrintSource } from "@/lib/custom/raster";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

interface CustomMockupProps {
  shirt: ShirtProduct;
  /** The personalised print (lib/custom renderCustomSvg), in the tee colour's inks; or an uploaded print's picture in those inks (lib/upload/bitmap). */
  svg: PrintSource;
  color?: BaseColor;
  className?: string;
  style?: React.CSSProperties;
  /** As TeeMockup's: how wide the picture is shown (the canvas follows its own box). */
  sizes?: string;
  zoomed?: boolean;
  /** Called with the milliseconds a render took (the editor slows its preview on a slow device). */
  onRender?: (ms: number) => void;
  /** What the picture is, for a screen reader (default: the design's title, personalised). */
  label?: string;
  /** Framed on the chest (3:4), the print about three fifths of the width: a small card or a phone's stage reads the print, not the view. */
  crop?: boolean;
}

/** The print's share of a chest crop's width. */
const CROP_FILL = 0.6;
/** The chest crop of a model photo, as fractions of it, around its print box: 3:4, the print CROP_FILL wide, a little room above. */
export function chestCrop(box: readonly number[]): { x: number; y: number; w: number; h: number } {
  const w = Math.min(1, box[2] / CROP_FILL);
  const h = Math.min(1, (w * MODEL_ASPECT * 4) / 3);
  const x = Math.min(1 - w, Math.max(0, box[0] + box[2] / 2 - w / 2));
  const y = Math.min(1 - h, Math.max(0, box[1] - h * 0.12));
  return { x, y, w, h };
}

/**
 * A personalised print worn: TeeMockup's layout, drawn in the browser. The
 * model photo the design always uses in that colour, the print laid in its
 * box as bake.ts lays the catalogue's. Until the first drawing is in, the
 * original's baked picture holds the place. Zoomed, the print alone at
 * 1500 px covers its box, as the baked close-up does.
 */
export function CustomMockup({ shirt, svg, color: wanted, className = "", style, zoomed = false, onRender, label, crop = false }: CustomMockupProps) {
  const color = teeColor(shirt, wanted);
  const model = modelFor(shirt, color);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [fontsIn, setFontsIn] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    loadCanvasFonts().then(() => setFontsIn(true));
  }, []);
  // Leaving the page (or a filter hiding the card): the canvases give their pixels back now, not at the next collection.
  useEffect(() => {
    const [a, b] = [canvasRef.current, detailRef];
    return () => {
      release(a);
      release(b.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model || !fontsIn || !width) return;
    let live = true;
    loadImage(assetUrl(`/models/${model.id}.webp`))
      .then((photo) => {
        if (!live) return;
        const t = performance.now();
        // A small card (a grid of them) at 2× at most: sharp enough, and a page of thirty stays inside a phone's canvas memory.
        const dpr = Math.min(width < 300 ? 2 : 3, window.devicePixelRatio || 1);
        const w = Math.round(width * dpr);
        const h = Math.round(w / MODEL_ASPECT);
        canvas.width = w;
        canvas.height = h;
        drawMockup(canvas.getContext("2d")!, w, h, photo, svg, model.box, color);
        setDrawn(true);
        onRender?.(performance.now() - t);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // onRender is a report, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, fontsIn, width, model, color]);

  useEffect(() => {
    const canvas = detailRef.current;
    if (!zoomed || !canvas || !model || !fontsIn) return;
    let live = true;
    loadImage(assetUrl(`/models/${model.id}.webp`)).then((photo) => {
      if (!live) return;
      canvas.width = 1500;
      canvas.height = 2000;
      drawDetail(canvas.getContext("2d")!, 1500, 2000, photo, svg, model.box, color);
    });
    return () => {
      live = false;
    };
  }, [zoomed, svg, fontsIn, model, color]);

  const base = mockupImage(shirt, color);
  const box = model?.box;
  // Cropped: the whole picture drawn larger inside a 3:4 window on the chest (the canvas is the picture's, measured from its own box).
  const c = crop && box ? chestCrop(box) : null;
  const picture = (
    <div
      ref={wrapRef}
      className="absolute"
      style={c ? { left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, width: `${100 / c.w}%`, height: `${100 / c.h}%` } : { inset: 0 }}
    >
      {!drawn && <img src={base.src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" data-mockup data-custom />
      {zoomed && box && (
        <canvas
          ref={detailRef}
          className="pointer-events-none absolute"
          style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%` }}
          data-detail
        />
      )}
    </div>
  );
  return (
    <div
      className={`relative select-none overflow-hidden ${className}`}
      style={{ aspectRatio: c ? "3 / 4" : `${MODEL_ASPECT}`, ...style }}
      role="img"
      aria-label={`${label ?? `${shirt.title}, personalised`}, worn on a ${color === "black" ? "black" : "white"} tee`}
      {...(c ? { "data-crop": "chest" } : {})}
    >
      {picture}
    </div>
  );
}
