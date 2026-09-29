"use client";

import { useEffect, useRef, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { STAGE_BG } from "@/components/stage";
import { track } from "@/lib/analytics";
import { assetUrl } from "@/lib/catalog";
import type { Settings, Source, Tee } from "@/lib/upload/client";
import { modelFor } from "@/lib/models";
import { BOXES, OUT_H, OUT_W } from "@/lib/upload/grid";
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
 * The picture, always in view and never blank: before a file, the tee
 * with the print area marked (tap it to choose a picture); the print on its tee; while
 * converting, the last print (or the source, grey and faded) under a
 * status pill; a failed print as it is. "Original" (press and hold, or hold
 * Space) shows the source instead.
 */
export function Stage({ shirt, tee, state, source, pill, label, onPick, drag = false, opening = false }: { shirt: ShirtProduct; tee: Tee; state: StageState; source: Source | null; pill?: string; label: string; onPick: () => void; drag?: boolean; opening?: boolean }) {
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
  if (state.kind === "empty") return <EmptyTee shirt={shirt} tee={tee} onPick={onPick} drag={drag} opening={opening} />;
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

/**
 * Before a file: the tee the print will go on, with the Full print area
 * marked where the print lands (the model's print box, narrowed to Full as
 * lib/upload/grid places it), so the print step's picture takes its place
 * without a jump. The whole tee is the button that opens the file chooser.
 */
function EmptyTee({ shirt, tee, onPick, drag, opening }: { shirt: ShirtProduct; tee: Tee; onPick: () => void; drag: boolean; opening: boolean }) {
  const model = modelFor(shirt, tee);
  const f = BOXES.full;
  const area = model
    ? { left: model.box[0], top: model.box[1] + (model.box[3] * f.y) / OUT_H, width: (model.box[2] * f.w) / OUT_W, height: (model.box[3] * f.h) / OUT_H }
    : { left: 0.35, top: 0.3, width: 0.3, height: 0.38 };
  const dark = tee === "black";
  // Whole class names (Tailwind only finds literal ones): the ink follows the tee, black on white, white on black.
  const ink = dark ? "border-white text-white bg-white/[0.06]" : "border-black text-black bg-black/[0.04]";
  const rest = dark
    ? "border-white/50 text-white/70 [@media(hover:hover)]:group-hover:border-white [@media(hover:hover)]:group-hover:text-white [@media(hover:hover)]:group-hover:bg-white/[0.06]"
    : "border-black/45 text-black/60 [@media(hover:hover)]:group-hover:border-black [@media(hover:hover)]:group-hover:text-black [@media(hover:hover)]:group-hover:bg-black/[0.04]";
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={opening}
      aria-busy={opening}
      aria-label="Your print here. Choose a picture"
      aria-describedby="yours-hint"
      className={`group relative block aspect-[512/704] w-full cursor-pointer overflow-hidden rounded-3xl ${STAGE_BG}`}
      data-upload-preview="empty"
    >
      {model && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(`/models/${model.id}.webp`)} alt="" width={512} height={704} draggable={false} fetchPriority="high" className="pointer-events-none absolute inset-0 h-full w-full" />
      )}
      <span
        aria-hidden
        className={`absolute flex items-center justify-center rounded-[3px] p-2 text-center transition-colors ${drag ? `border-2 border-solid ${ink}` : `border-[1.5px] border-dashed ${rest}`}`}
        style={{ left: `${area.left * 100}%`, top: `${area.top * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%` }}
      >
        <span className="text-[11px] font-semibold uppercase leading-4 tracking-[0.18em] [text-wrap:balance]">{opening ? "Opening…" : drag ? "Drop it here" : "Your print here"}</span>
      </span>
    </button>
  );
}
