"use client";

import { Sharper } from "@/components/Sharper";
import { usePageZoom } from "@/hooks/usePageZoom";
import { printImage } from "@/lib/images";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

/**
 * The flat print on the tee colour, made at build time (lib/images): a
 * raster print in a few sizes (the browser picks one; zoomed in, a bigger
 * one is laid over it), a drawn print as its vector file in that colourway.
 * Nothing is inverted or blended on the page.
 */
export function PrintImage({
  shirt,
  color: wanted,
  className = "",
  priority = false,
  sizes,
  zoom = 1,
}: {
  shirt: ShirtProduct;
  color?: BaseColor;
  className?: string;
  /** Above the fold (the product page's print view): load it first. */
  priority?: boolean;
  /** How wide the print is shown, as one CSS length. */
  sizes: string;
  /** A zoom the print is shown at (in steps, zoomStep), on top of any page zoom. */
  zoom?: number;
}) {
  const color = teeColor(shirt, wanted);
  const factor = usePageZoom() * zoom;
  const { src, srcSet } = printImage(shirt, color);
  const cls = `h-full w-full select-none object-cover ${className}`;
  const img = (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={`${shirt.title} print`}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      {...{ fetchpriority: priority ? "high" : "auto" }}
      decoding="async"
      className={cls}
    />
  );
  if (!srcSet) return img;
  return (
    <span className="relative block h-full w-full">
      {img}
      {factor > 1 && <Sharper key={factor} srcSet={srcSet} sizes={sizes} factor={factor} className="object-cover" />}
    </span>
  );
}
