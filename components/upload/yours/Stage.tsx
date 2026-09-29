"use client";

import { useEffect, useRef, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { STAGE_BG } from "@/components/stage";
import { track } from "@/lib/analytics";
import { assetUrl } from "@/lib/catalog";
import type { Settings, Source, Tee } from "@/lib/upload/client";
import { BOXES, OUT_W } from "@/lib/upload/grid";
import { sourcePixels } from "@/lib/upload/pixels";
import type { ShirtProduct } from "@/types/shirt";

/** The Full box on the 300 × 400 print: lib/upload/grid BOXES.full at a fifth of the size. */
const K = 300 / OUT_W;
const BOX = { x: BOXES.full.x * K, y: Math.round(BOXES.full.y * K), w: BOXES.full.w * K, h: Math.round(BOXES.full.h * K) };

/** A print-sized canvas in a tee's colour with the source laid in the Full box, faded and grey: what's being converted. */
export function placeholder(src: Source, s: Settings, tee: Tee): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = tee === "black" ? "#000" : "#fff";
  ctx.fillRect(0, 0, 300, 400);
  if (src.bitmap) {
    const px = sourcePixels(src, { ...s, stronger: false }, 600);
    const tmp = document.createElement("canvas");
    tmp.width = px.w;
    tmp.height = px.h;
    tmp.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.w, px.h), 0, 0);
    const k = Math.min(BOX.w / px.w, BOX.h / px.h);
    ctx.globalAlpha = 0.4;
    ctx.filter = "grayscale(1)";
    ctx.drawImage(tmp, BOX.x + (BOX.w - px.w * k) / 2, BOX.y, px.w * k, px.h * k);
  }
  return c;
}

export type StageState = { kind: "empty" } | { kind: "converting" | "ready" | "failed"; canvas: HTMLCanvasElement | null };

/**
 * The picture, always in view and never blank: before a file, the
 * converter's own example (a photograph and the print it made); the print on its tee; while
 * converting, the last print (or the source, grey and faded) under a
 * status pill; a failed print as it is. "Original" (press and hold, or hold
 * Space) shows the source instead.
 */
export function Stage({ shirt, tee, state, source, pill, label }: { shirt: ShirtProduct; tee: Tee; state: StageState; source: Source | null; pill?: string; label: string }) {
  const [holding, setHolding] = useState(false);
  // The original, for "Original": an object URL made and revoked with the file (an effect, not a memo, so it never leaks).
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!source?.file) return setUrl(null);
    const u = URL.createObjectURL(source.file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source]);
  const tracked = useRef(false);
  const hold = (on: boolean) => {
    setHolding(on);
    if (on && !tracked.current) (tracked.current = true), track("upload_hold_original");
  };
  if (state.kind === "empty") return <Example />;
  const canvas = state.canvas;
  return (
    <div className={`relative overflow-hidden rounded-3xl ${STAGE_BG}`} data-upload-preview={state.kind === "converting" ? "busy" : state.kind === "ready" ? "ready" : state.kind === "failed" ? "failed" : "empty"}>
      {canvas ? <CustomMockup shirt={shirt} svg={canvas} color={tee} className={`w-full transition-opacity ${state.kind === "converting" ? "opacity-60" : ""}`} label={label} /> : <div className="aspect-[512/704] w-full" />}
      {holding && url && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Your original" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
      {pill && (
        <p className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/70 px-3 py-1.5 text-xs text-neutral-200 ring-1 ring-white/15" data-stage-pill>
          {pill}
        </p>
      )}
      {url && state.kind !== "converting" && (
        <button
          type="button"
          aria-pressed={holding}
          onPointerDown={(e) => {
            e.preventDefault();
            hold(true);
          }}
          onPointerUp={() => hold(false)}
          onPointerLeave={() => hold(false)}
          onPointerCancel={() => hold(false)}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && (e.preventDefault(), hold(true))}
          onKeyUp={(e) => (e.key === " " || e.key === "Enter") && hold(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute bottom-3 right-3 h-10 select-none rounded-full bg-black/60 px-3.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-md [touch-action:none]"
        >
          Original
        </button>
      )}
    </div>
  );
}

/** Before a file: a photograph and the print the converter made of it (scripts/tools/buildYoursExamples.ts), framed alike, in the stage's frame. */
function Example() {
  return (
    <div className={`relative flex aspect-[512/704] w-full items-center overflow-hidden rounded-3xl ${STAGE_BG}`} data-upload-preview="empty">
      <div className="grid w-full grid-cols-2 gap-px" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl("/make/yours/photo-before.webp")} alt="" width={360} height={480} className="block aspect-[3/4] w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl("/make/yours/photo-after.webp")} alt="" width={360} height={480} className="block aspect-[3/4] w-full object-cover" />
      </div>
    </div>
  );
}
