"use client";

import { useEffect, useRef, useState } from "react";
import { assetUrl, needsInvert, printUrl, thumbUrl } from "@/lib/catalog";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

/**
 * The flat print artwork: a local monochrome 3:4 SVG from /public/prints.
 *
 * Prints are strictly two-colour (#000/#FFF), drawn for the design's original
 * tee. For a drawn print the reverse colourway is the exact inversion —
 * white ink on black becomes black ink on white — so `color` just flips it
 * with a CSS invert. An ink print (WebP) is black ink on a transparent
 * ground, inverted to white ink for a black tee. A photograph is greyscale
 * with a transparent surround and is never inverted (that would be a
 * negative). WebP prints sit on a ground in the tee colour (under an invert,
 * the opposite colour, which the invert turns back).
 */
export function PrintImage({
  shirt,
  color: wanted,
  className = "",
  priority = false,
  thumb = false,
  onReady,
}: {
  shirt: ShirtProduct;
  color?: BaseColor;
  className?: string;
  /** Above-the-fold image (the top Discover card, the main product image): load it first. */
  priority?: boolean;
  /** Grids and lists: the small file (see thumbUrl). */
  thumb?: boolean;
  /** Called once the picture is loaded and decoded (or has failed). */
  onReady?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Loaded before React attached its handler (a cached file, or the static HTML).
  useEffect(() => {
    if (img.current?.complete) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Only the colours it's sold in (T3): anything else shows the original.
  const color = teeColor(shirt, wanted);
  const inverted = needsInvert(shirt, color);
  const ground = shirt.medium === "drawn" ? "" : (color === "black") !== inverted ? "bg-black" : "bg-white";
  // Blank ground in the tee colour if a file is ever missing, so nothing looks broken.
  if (failed) return <div className={`h-full w-full ${color === "black" ? "bg-black" : "bg-white"} ${className}`} />;
  return (
    <img
      ref={img}
      src={assetUrl(thumb ? thumbUrl(shirt, color) : printUrl(shirt, color))}
      alt={`${shirt.title} print`}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      // React 18 doesn't know fetchPriority yet; the lowercase attribute passes through.
      {...{ fetchpriority: priority ? "high" : "auto" }}
      decoding="async"
      onLoad={onReady}
      onError={() => {
        setFailed(true);
        onReady?.();
      }}
      className={`h-full w-full select-none object-cover ${inverted ? "invert" : ""} ${ground} ${className}`}
    />
  );
}
