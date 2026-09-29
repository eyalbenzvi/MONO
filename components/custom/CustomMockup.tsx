"use client";

import { useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/catalog";
import { MODEL_ASPECT, mockupImage } from "@/lib/images";
import { modelFor } from "@/lib/models";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { chestBox } from "@/lib/custom/chest";
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

/** The chest crop (lib/custom/chest, shared with the Make cards' baker). */
export const chestCrop = chestBox;

/**
 * A personalised print worn: TeeMockup's layout, drawn in the browser. The
 * model photo the design always uses in that colour, the print laid in its
 * box as bake.ts lays the catalogue's. Until the first drawing is in, the
 * bare model photo holds the place. Zoomed, the print alone at
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
        const ctx = canvas.getContext("2d")!;
        if (crop) {
          // The chest crop: the canvas is only the window (so a grid of cards costs what it did uncropped); the picture is drawn larger behind it.
          const c = chestCrop(model.box);
          const [W, H] = [w / c.w, w / c.w / MODEL_ASPECT];
          canvas.width = w;
          canvas.height = Math.round((w * 4) / 3);
          ctx.setTransform(1, 0, 0, 1, -c.x * W, -c.y * H);
          drawMockup(ctx, W, H, photo, svg, model.box, color);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          canvas.width = w;
          canvas.height = h;
          drawMockup(ctx, w, h, photo, svg, model.box, color);
        }
        setDrawn(true);
        onRender?.(performance.now() - t);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // onRender is a report, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, fontsIn, width, model, color, crop]);

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

  // Until the drawing is in: the same model photo, bare (never another design's picture, and there in either colour).
  const base = model ? assetUrl(`/models/${model.id}.webp`) : mockupImage(shirt, color).src;
  const box = model?.box;
  // Cropped: a 3:4 window on the chest. The baked stand-in is the whole picture, larger, behind it; the canvas draws only the window.
  const c = crop && box ? chestCrop(box) : null;
  const picture = (
    <div
      className="absolute"
      style={c ? { left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, width: `${100 / c.w}%`, height: `${100 / c.h}%` } : { inset: 0 }}
    >
      {!drawn && <img src={base} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />}
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
      ref={wrapRef}
      className={`relative select-none overflow-hidden ${className}`}
      style={{ aspectRatio: c ? "3 / 4" : `${MODEL_ASPECT}`, ...style }}
      role="img"
      aria-label={`${label ?? `${shirt.title}, personalised`}, worn on a ${color === "black" ? "black" : "white"} tee`}
      {...(c ? { "data-crop": "chest" } : {})}
    >
      {picture}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" data-mockup data-custom />
    </div>
  );
}
