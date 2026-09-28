"use client";

import { Suspense, lazy, useState } from "react";
import { acceptedDesigns } from "@/lib/upload/designs";
import { isUploadDesign } from "@/lib/upload/openCall";
import { Sharper } from "@/components/Sharper";
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

function BakedMockup({ shirt, color: wanted, className = "", style, priority, sizes, zoomed = false }: TeeMockupProps) {
  const color = teeColor(shirt, wanted);
  const page = usePageZoom();
  const { src, srcSet } = mockupImage(shirt, color);
  const box = detailBox(shirt, color);
  return (
    <div
      className={`relative select-none overflow-hidden ${className}`}
      style={{ aspectRatio: `${MODEL_ASPECT}`, ...style }}
      role="img"
      aria-label={`${shirt.title}, worn on a ${color === "black" ? "black" : "white"} tee`}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt=""
        draggable={false}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
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
