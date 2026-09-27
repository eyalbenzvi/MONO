"use client";

import { useState } from "react";

/**
 * A bigger file of the same picture over it, for a zoom: shown once it has
 * loaded, so the picture under it stays in view until then. (Changing the
 * `sizes` of the picture itself would make the browser drop what it shows
 * for a frame before the bigger file arrives.)
 */
export function Sharper({ srcSet, sizes, factor, className = "" }: { srcSet: string; sizes: string; factor: number; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <img
      srcSet={srcSet}
      sizes={`calc(${sizes} * ${factor})`}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      onLoad={() => setShown(true)}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className} ${shown ? "" : "opacity-0"}`}
      data-sharper
    />
  );
}

/** Zoom factors in a few steps (1, 1.5, 2, 3, 4): a pinch asks for a bigger file a few times, not every frame. */
const STEPS = [1, 1.5, 2, 3, 4];
export const zoomStep = (scale: number) => STEPS.reduce((best, s) => (scale >= s * 0.9 ? s : best), 1);
