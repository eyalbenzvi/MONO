"use client";

import { useState } from "react";
import { assetUrl, needsInvert, printUrl } from "@/lib/catalog";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

/**
 * The flat print artwork: a local monochrome 3:4 SVG from /public/prints.
 *
 * Prints are strictly two-colour (#000/#FFF), drawn for the design's original
 * tee. For a drawn print the reverse colourway is the exact inversion —
 * white ink on black becomes black ink on white — so `color` just flips it
 * with a CSS invert. Photographs have their own print per colour (an
 * inverted photograph is a negative): see printUrl.
 */
export function PrintImage({
  shirt,
  color = shirt.baseColor,
  className = "",
  priority = false,
}: {
  shirt: ShirtProduct;
  color?: BaseColor;
  className?: string;
  /** Above-the-fold image (the top Discover card, the main product image): load it first. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const inverted = needsInvert(shirt, color);
  // Blank ground in the tee colour if a file is ever missing, so nothing looks broken.
  if (failed) return <div className={`h-full w-full ${color === "black" ? "bg-black" : "bg-white"} ${className}`} />;
  return (
    <img
      src={assetUrl(printUrl(shirt, color))}
      alt={`${shirt.title} print`}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      // React 18 doesn't know fetchPriority yet; the lowercase attribute passes through.
      {...{ fetchpriority: priority ? "high" : "auto" }}
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full select-none object-cover ${inverted ? "invert" : ""} ${className}`}
    />
  );
}
