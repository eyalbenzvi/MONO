"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { acceptedDesigns } from "@/lib/upload/designs";
import { isUploadDesign } from "@/lib/upload/keys";
import { Sharper } from "@/components/Sharper";
import { useNear } from "@/hooks/useNear";
import { usePageZoom } from "@/hooks/usePageZoom";
import { MODEL_ASPECT, detailBox, detailPath, mockupImage } from "@/lib/images";
import { assetUrl } from "@/lib/catalog";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

interface TeeMockupProps {
  shirt: ShirtProduct;
  /** Tee colour to render; defaults to the design's original colourway. */
  color?: BaseColor;
  className?: string;
  style?: React.CSSProperties;
  /** Above the fold (the top Discover card, the product page): load it first. */
  priority?: boolean;
  /**
   * How wide the picture is shown, as one CSS length (the browser picks the
   * file from it; on a pinch-zoomed page a bigger one is laid over it).
   */
  sizes: string;
  /** The picture is zoomed (in place or full screen): the print's close-up covers it. */
  zoomed?: boolean;
  /** Its accessible name, when there's a better one than the title (the design's own description). */
  alt?: string;
}

/**
 * The design worn (T2): one picture, made at build time (lib/images) — the
 * model photo with the print already on the fabric. Zoomed in, a close-up
 * of the print (the same picture, finer) covers the print's area.
 */
/** An Open Call design (on this device only) has no baked picture: its raster is drawn from IndexedDB. */
const UploadMockup = lazy(() => import("@/components/upload/UploadMockup"));

export function TeeMockup(props: TeeMockupProps) {
  const { shirt, color, className, sizes } = props;
  if (isUploadDesign(shirt.id)) {
    const d = acceptedDesigns().find((x) => x.id === shirt.id);
    const tee = teeColor(shirt, color);
    const empty = <div className={className} style={{ aspectRatio: `${MODEL_ASPECT}` }} />;
    return d ? (
      <Suspense fallback={empty}>
        <UploadMockup shirt={shirt} uploadId={d.uploadId} color={tee} sizes={sizes} className={className} />
      </Suspense>
    ) : (
      empty
    );
  }
  return <BakedMockup {...props} />;
}

function BakedMockup({ shirt, color: wanted, className = "", style, priority, sizes, zoomed = false, alt }: TeeMockupProps) {
  const color = teeColor(shirt, wanted);
  const page = usePageZoom();
  const base = mockupImage(shirt, color);
  // A picture that didn't load (offline, a blip): the brand's line and a retry, never the browser's broken-image icon.
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Loaded well ahead of the scroller's view (hooks/useNear): the browser's loading="lazy" only starts on screen here.
  const frame = useRef<HTMLDivElement>(null);
  const near = useNear(frame, !priority);
  useEffect(() => {
    // One that failed before the page woke up fires no onError here.
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0 && el.currentSrc) setFailed(true);
  }, []);
  const again = (u: string) => (attempt ? `${u}${u.includes("?") ? "&" : "?"}r=${attempt}` : u);
  const src = again(base.src);
  const srcSet = base.srcSet?.replace(/(\S+)(\s+\d+w)/g, (_, u: string, w: string) => `${again(u)}${w}`);
  const box = detailBox(shirt, color);
  const label = alt ?? `${shirt.title}, printed on the back of a ${color === "black" ? "black" : "white"} tee`;
  if (failed)
    return (
      // z-10: above a card's full-size link even when a hover transform makes this box its own stacking context.
      <div className={`relative z-10 flex select-none flex-col items-center justify-center gap-2 overflow-hidden text-center ${className}`} style={{ aspectRatio: `${MODEL_ASPECT}`, ...style }} data-mockup-failed>
        <p className="px-3 text-xs text-neutral-300">That didn&rsquo;t load.</p>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          className="relative z-20 h-11 rounded-control px-4 text-xs font-medium text-white ring-1 ring-white/30 hover:bg-white/10"
          aria-label={`Try again: ${label}`}
        >
          Try again
        </button>
      </div>
    );
  return (
    <div ref={frame} className={`relative select-none overflow-hidden ${className}`} style={{ aspectRatio: `${MODEL_ASPECT}`, ...style }} role="img" aria-label={label}>
      <img
        key={attempt}
        ref={img}
        onError={() => setFailed(true)}
        src={near ? src : undefined}
        srcSet={near ? srcSet : undefined}
        sizes={sizes}
        alt=""
        draggable={false}
        decoding="async"
        // React 18 doesn't know fetchPriority yet; the lowercase attribute passes through.
        {...{ fetchpriority: priority ? "high" : "auto" }}
        className="pointer-events-none absolute inset-0 h-full w-full"
        data-mockup
      />
      {page > 1 && <Sharper key={page} srcSet={srcSet} sizes={sizes} factor={page} />}
      {zoomed && box && <Detail src={assetUrl(detailPath(shirt, color))} box={box} />}
    </div>
  );
}

/** The print's close-up over its area, shown once it's in (the picture under it stays until then). */
function Detail({ src, box }: { src: string; box: [number, number, number, number] }) {
  const [shown, setShown] = useState(false);
  const [x, y, w, h] = box;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={() => setShown(true)}
      className={`pointer-events-none absolute transition-opacity duration-200 motion-reduce:transition-none ${shown ? "" : "opacity-0"}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
      data-detail
    />
  );
}
