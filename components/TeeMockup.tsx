"use client";

import { PrintImage } from "@/components/PrintImage";
import { assetUrl } from "@/lib/catalog";
import { MODEL_ASPECT, modelFor } from "@/lib/models";
import { TEE_PRINT, TEE_VIEW } from "@/lib/teeShape";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

const VIEW = TEE_VIEW;
const PRINT = TEE_PRINT;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const PRINT_STYLE = {
  left: pct(PRINT.x - VIEW.x, VIEW.w),
  top: pct(PRINT.y - VIEW.y, VIEW.h),
  width: pct(PRINT.w, VIEW.w),
  height: pct(PRINT.h, VIEW.h),
};

interface TeeMockupProps {
  shirt: ShirtProduct;
  /** Tee colour to render; defaults to the design's original colourway. */
  color?: BaseColor;
  className?: string;
  /** Drop shadow under the garment (off for tiny thumbnails). */
  shadow?: boolean;
  style?: React.CSSProperties;
  /** Load the print first (see PrintImage). */
  priority?: boolean;
}

/**
 * The garment, its fold shadows and highlights are shared files
 * (public/tee/<layer>-<colour>.svg, npm run sprites) — the same few cached
 * images for every mockup, instead of paths inlined into each page.
 */
const layer = (name: "garment" | "shade" | "light", color: BaseColor) => assetUrl(`/tee/${name}-${color}.svg`);
const LAYER = "pointer-events-none absolute inset-0 h-full w-full select-none";

export function TeeMockup({ shirt, color: wanted, className = "", shadow = true, style, priority }: TeeMockupProps) {
  // A design shown only in the colours it's sold in (T3).
  const color = teeColor(shirt, wanted);
  const black = color === "black";
  const model = modelFor(shirt, color);
  if (model) return <ModelShot shirt={shirt} color={color} model={model} className={className} style={style} priority={priority} />;
  return (
    <div
      className={`relative isolate select-none ${className}`}
      style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}`, ...style }}
      role="img"
      aria-label={`${shirt.title} — ${black ? "black" : "white"} tee`}
    >
      {/* Garment: fabric, seams, hems, collar */}
      <img src={layer("garment", color)} alt="" draggable={false} decoding="async" className={LAYER} style={shadow ? { filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.45))" } : undefined} />
      {/* Print: single-ink, blended into the fabric (screen = white ink, multiply = black ink) */}
      <div className="absolute overflow-hidden" style={{ ...PRINT_STYLE, mixBlendMode: black ? "screen" : "multiply" }}>
        <PrintImage shirt={shirt} color={color} priority={priority} />
      </div>
      {/* Fabric folds: shadows, then highlights */}
      <img src={layer("shade", color)} alt="" draggable={false} decoding="async" className={LAYER} style={{ mixBlendMode: "multiply" }} />
      <img src={layer("light", color)} alt="" draggable={false} decoding="async" className={LAYER} style={{ mixBlendMode: "screen" }} />
    </div>
  );
}

/**
 * The tee worn (T2): a greyscale model photo with the print laid onto the
 * middle of the back, blended into the fabric (black ink multiplies onto
 * white cotton, keeping its texture; white ink screens onto black — the
 * print's black ground disappears into the tee, with no box around it).
 */
function ModelShot({ shirt, color, model, className, style, priority }: { shirt: ShirtProduct; color: BaseColor; model: NonNullable<ReturnType<typeof modelFor>>; className: string; style?: React.CSSProperties; priority?: boolean }) {
  const black = color === "black";
  const [x, y, w, h] = model.box;
  const photo = assetUrl(`/models/${model.id}.webp`);
  const box = { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` };
  return (
    <div
      className={`relative isolate select-none overflow-hidden ${className}`}
      style={{ aspectRatio: `${MODEL_ASPECT}`, ...style }}
      role="img"
      aria-label={`${shirt.title}, worn on a ${black ? "black" : "white"} tee`}
    >
      <img src={photo} alt="" draggable={false} decoding="async" loading={priority ? "eager" : "lazy"} className={LAYER} />
      <div className="pointer-events-none absolute overflow-hidden" style={{ ...box, mixBlendMode: black ? "screen" : "multiply" }}>
        <PrintImage shirt={shirt} color={color} priority={priority} />
      </div>
    </div>
  );
}
