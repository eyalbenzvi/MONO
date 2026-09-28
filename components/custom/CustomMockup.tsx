"use client";

import { useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/catalog";
import { MODEL_ASPECT, mockupImage } from "@/lib/images";
import { modelFor } from "@/lib/models";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { drawDetail, drawMockup, loadImage } from "@/lib/custom/raster";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

interface CustomMockupProps {
  shirt: ShirtProduct;
  /** The personalised print (lib/custom renderCustomSvg), in the tee colour's inks. */
  svg: string;
  color?: BaseColor;
  className?: string;
  style?: React.CSSProperties;
  /** As TeeMockup's: how wide the picture is shown (the canvas follows its own box). */
  sizes?: string;
  zoomed?: boolean;
  /** Called with the milliseconds a render took (the editor slows its preview on a slow device). */
  onRender?: (ms: number) => void;
}

/**
 * A personalised print worn: TeeMockup's layout, drawn in the browser. The
 * model photo the design always uses in that colour, the print laid in its
 * box as bake.ts lays the catalogue's. Until the first drawing is in, the
 * original's baked picture holds the place. Zoomed, the print alone at
 * 1500 px covers its box, as the baked close-up does.
 */
export function CustomMockup({ shirt, svg, color: wanted, className = "", style, zoomed = false, onRender }: CustomMockupProps) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model || !fontsIn || !width) return;
    let live = true;
    loadImage(assetUrl(`/models/${model.id}.webp`))
      .then((photo) => {
        if (!live) return;
        const t = performance.now();
        const dpr = Math.min(3, window.devicePixelRatio || 1);
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
  return (
    <div
      ref={wrapRef}
      className={`relative select-none overflow-hidden ${className}`}
      style={{ aspectRatio: `${MODEL_ASPECT}`, ...style }}
      role="img"
      aria-label={`${shirt.title}, personalised, worn on a ${color === "black" ? "black" : "white"} tee`}
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
}
