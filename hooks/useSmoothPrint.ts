"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { drawSmooth, smoothWidth } from "@/lib/downscale";
import { checkView, watchSharpness } from "@/lib/sharpness";

/**
 * Shows a raster print shrunk properly (lib/downscale) whenever the browser
 * would shrink it: `img` is measured against its size on screen (zoom and
 * pinch included) and, while it's shown smaller than its file, a canvas of
 * the right size covers it. Returns the canvas ref and whether it's showing.
 */
export function useSmoothPrint(img: RefObject<HTMLImageElement | null>, enabled: boolean) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const drawn = useRef<{ src: string; w: number }>({ src: "", w: 0 });

  useEffect(() => {
    if (!enabled) {
      drawn.current = { src: "", w: 0 };
      setOn(false);
      return;
    }
    const check = () => {
      const el = img.current;
      const c = canvas.current;
      if (!el || !c || !el.complete || !el.naturalWidth) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const v = checkView();
      const w = smoothWidth(el.naturalWidth, r.width * v.dpr * v.scale);
      const src = el.currentSrc || el.src;
      if (w === drawn.current.w && src === drawn.current.src) return;
      const ok = w > 0 && drawSmooth(el, c, w);
      drawn.current = { src, w: ok ? w : 0 };
      setOn(ok);
    };
    const stop = watchSharpness(check);
    const el = img.current;
    el?.addEventListener("load", check);
    // A frame that changes size (a card zooming in place, a layout change).
    const ro = typeof ResizeObserver === "undefined" || !el ? null : new ResizeObserver(check);
    if (el) ro?.observe(el);
    return () => {
      stop();
      el?.removeEventListener("load", check);
      ro?.disconnect();
    };
  }, [enabled, img]);

  return { canvas, smooth: on };
}
