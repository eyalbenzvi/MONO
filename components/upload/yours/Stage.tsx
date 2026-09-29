"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { STAGE_BG } from "@/components/stage";
import { track } from "@/lib/analytics";
import { sourcePixels, type Settings, type Source, type Tee } from "@/lib/upload/client";
import type { ShirtProduct } from "@/types/shirt";

/** The Full box on the 300 × 400 print (top 3%, the whole width, as lib/upload/convert BOXES). */
const BOX = { x: 0, y: 12, w: 300, h: 388 };

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

/** A blank print with the Full box dashed: where words will go. */
export function wordsPlaceholder(tee: Tee): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = tee === "black" ? "#000" : "#fff";
  ctx.fillRect(0, 0, 300, 400);
  ctx.strokeStyle = tee === "black" ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 40, 252, 160);
  return c;
}

export type StageState = { kind: "empty-words" } | { kind: "converting"; canvas: HTMLCanvasElement } | { kind: "ready"; canvas: HTMLCanvasElement } | { kind: "failed"; canvas: HTMLCanvasElement | null };

/**
 * The picture, always in view and never blank: the print on its tee; while
 * converting, the last print (or the source, grey and faded) under a
 * status pill; a failed print as it is. "Original" (press and hold, or hold
 * Space) shows the source instead.
 */
export function Stage({ shirt, tee, state, source, pill, label }: { shirt: ShirtProduct; tee: Tee; state: StageState; source: Source | null; pill?: string; label: string }) {
  const [holding, setHolding] = useState(false);
  const url = useMemo(() => (source?.file && source.kind !== "words" ? URL.createObjectURL(source.file) : null), [source]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const tracked = useRef(false);
  const hold = (on: boolean) => {
    setHolding(on);
    if (on && !tracked.current) (tracked.current = true), track("upload_hold_original");
  };
  const canvas = state.kind === "empty-words" ? wordsPlaceholder(tee) : state.canvas;
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
      {state.kind === "empty-words" && <p className="absolute inset-x-0 top-[30%] text-center text-sm text-neutral-400">Your words go here</p>}
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
