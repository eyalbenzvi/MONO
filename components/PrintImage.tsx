"use client";

import { useEffect, useRef, useState } from "react";
import { assetUrl, needsInvert, printUrl, thumbUrl } from "@/lib/catalog";
import { checkView, scheduleSharpness, wantsFull, watchSharpness } from "@/lib/sharpness";
import { useSmoothPrint } from "@/hooks/useSmoothPrint";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

/**
 * The flat print artwork: a local monochrome 3:4 SVG from /public/prints.
 *
 * Prints are strictly two-colour (#000/#FFF), drawn for the design's original
 * tee. For a drawn print the reverse colourway is the exact inversion —
 * white ink on black becomes black ink on white — so `color` just flips it
 * with a CSS invert. An ink print (WebP) is black ink on a transparent
 * ground, inverted to white ink for a black tee. A photograph is a one-ink
 * halftone with a transparent surround and is never inverted (that would be a
 * negative). WebP prints sit on a ground in the tee colour (under an invert,
 * the opposite colour, which the invert turns back).
 */
export function PrintImage({
  shirt,
  color: wanted,
  className = "",
  priority = false,
  thumb = false,
  progressive = false,
  onReady,
}: {
  shirt: ShirtProduct;
  color?: BaseColor;
  className?: string;
  /** Above-the-fold image (the top Discover card, the main product image): load it first. */
  priority?: boolean;
  /** Grids and lists: the small file (see thumbUrl). */
  thumb?: boolean;
  /**
   * With `thumb`: the thumbnail is a bridge — when it would look soft (a
   * pinch-zoom, a dense screen; lib/sharpness) the full file loads over it
   * and fades in, and the thumbnail goes once it's covered.
   */
  progressive?: boolean;
  /** Called once the picture is loaded and decoded (or has failed). */
  onReady?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  // thumb → loading (full on top, transparent) → shown (fading in) → full (thumb gone).
  const [phase, setPhase] = useState<"thumb" | "loading" | "shown" | "full">("thumb");
  // Loaded before React attached its handler (a cached file, or the static HTML).
  useEffect(() => {
    if (img.current?.complete) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Only the colours it's sold in (T3): anything else shows the original.
  const color = teeColor(shirt, wanted);
  const inverted = needsInvert(shirt, color);
  const ground = shirt.medium === "drawn" ? "" : (color === "black") !== inverted ? "bg-black" : "bg-white";
  const small = assetUrl(thumbUrl(shirt, color));
  const full = assetUrl(printUrl(shirt, color));
  const upgrade = thumb && progressive && small !== full;
  const fullImg = useRef<HTMLImageElement>(null);
  const src = upgrade ? (phase === "full" ? full : small) : thumb ? small : full;
  // A raster print shown smaller than its file is shrunk here, not by the
  // browser (lib/downscale): a phone turns the halftone dots into blocks.
  const shrunkSrc = useSmoothPrint(upgrade && phase === "full" ? fullImg : img, src.endsWith(".webp") && !failed && (phase === "thumb" || phase === "full"));
  useEffect(() => {
    if (!upgrade || phase !== "thumb") return;
    // Each frame that could matter, this print measures itself.
    const stop = watchSharpness(() => {
      if (box.current && wantsFull(box.current, checkView())) {
        stop();
        setPhase("loading");
      }
    });
    return stop;
  }, [upgrade, small, phase]);
  // The fade's end, or a moment later if no transition runs (reduced motion).
  useEffect(() => {
    if (phase !== "shown") return;
    const t = setTimeout(() => setPhase("full"), 320);
    return () => clearTimeout(t);
  }, [phase]);
  // Blank ground in the tee colour if a file is ever missing, so nothing looks broken.
  if (failed) return <div className={`h-full w-full ${color === "black" ? "bg-black" : "bg-white"} ${className}`} />;
  const cls = `h-full w-full select-none object-cover ${inverted ? "invert" : ""} ${ground}`;
  const smooth = shrunkSrc !== null;
  const shrunk = smooth && <img src={shrunkSrc} alt="" aria-hidden draggable={false} data-shrunk className={`pointer-events-none absolute inset-0 ${cls}`} />;
  if (upgrade)
    return (
      <span ref={box} className={`relative block h-full w-full ${className}`}>
        {phase !== "full" && (
          <img
            ref={img}
            src={small}
            alt={`${shirt.title} print`}
            draggable={false}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => {
              onReady?.();
              scheduleSharpness();
            }}
            onError={() => {
              setFailed(true);
              onReady?.();
            }}
            className={`${cls} ${smooth ? "opacity-0" : ""}`}
          />
        )}
        {phase !== "thumb" && (
          <img
            ref={fullImg}
            src={full}
            alt={phase === "full" ? `${shirt.title} print` : ""}
            aria-hidden={phase !== "full" || undefined}
            draggable={false}
            decoding="async"
            data-full
            // Shown once decoded, so the fade never starts on an empty frame. A failed
            // full file just leaves the thumbnail.
            onLoad={(e) => {
              const el = e.currentTarget;
              (el.decode ? el.decode() : Promise.resolve()).catch(() => {}).then(() => setPhase((p) => (p === "loading" ? "shown" : p)));
            }}
            onTransitionEnd={() => setPhase((p) => (p === "shown" ? "full" : p))}
            className={`absolute inset-0 ${cls} transition-opacity duration-200 motion-reduce:transition-none ${phase === "loading" || (phase === "full" && smooth) ? "opacity-0" : ""}`}
          />
        )}
        {shrunk}
      </span>
    );
  const plain = (
    <img
      ref={img}
      src={src}
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
      className={src.endsWith(".webp") ? `${cls} ${smooth ? "opacity-0" : ""}` : `${cls} ${className}`}
    />
  );
  if (!src.endsWith(".webp")) return plain;
  return (
    <span className={`relative block h-full w-full ${className}`}>
      {plain}
      {shrunk}
    </span>
  );
}
