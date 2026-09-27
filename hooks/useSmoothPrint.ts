"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { drawSmooth, smoothWidth } from "@/lib/downscale";
import { checkView, watchSharpness } from "@/lib/sharpness";

/**
 * Shows a raster print shrunk properly (lib/downscale) whenever the browser
 * would shrink it: `img` is measured against its size on screen (zoom and
 * pinch included) and, while it's shown smaller than its file, a picture of
 * the right size covers it. Returns that picture's URL (null: show the file).
 *
 * The shrunk print is handed over as an image (a blob URL), never a canvas in
 * the page: a phone draws a canvas as its own layer, outside the tee's blend
 * and the cards' order, so a white box floated over the page during a pinch.
 */
export function useSmoothPrint(img: RefObject<HTMLImageElement | null>, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const drawn = useRef<{ src: string; w: number }>({ src: "", w: 0 });
  const current = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    let job = 0;
    const show = (next: string | null) => {
      if (current.current) URL.revokeObjectURL(current.current);
      current.current = next;
      setUrl(next);
    };
    if (!enabled) {
      drawn.current = { src: "", w: 0 };
      show(null);
      return;
    }
    const check = () => {
      const el = img.current;
      if (!el || !el.complete || !el.naturalWidth) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const v = checkView();
      const w = smoothWidth(el.naturalWidth, r.width * v.dpr * v.scale);
      const src = el.currentSrc || el.src;
      if (w === drawn.current.w && src === drawn.current.src) return;
      drawn.current = { src, w };
      const mine = ++job;
      const canvas = document.createElement("canvas");
      if (!w || !drawSmooth(el, canvas, w)) return show(null);
      canvas.toBlob((blob) => {
        if (!alive || mine !== job) return;
        show(blob ? URL.createObjectURL(blob) : null);
      });
    };
    const stop = watchSharpness(check);
    const el = img.current;
    el?.addEventListener("load", check);
    // A frame that changes size (a layout change; a card zooming in place is caught by watchSharpness).
    const ro = typeof ResizeObserver === "undefined" || !el ? null : new ResizeObserver(check);
    if (el) ro?.observe(el);
    return () => {
      alive = false;
      stop();
      el?.removeEventListener("load", check);
      ro?.disconnect();
    };
  }, [enabled, img]);

  // The last picture goes with the print.
  useEffect(() => () => void (current.current && URL.revokeObjectURL(current.current)), []);

  return url;
}
