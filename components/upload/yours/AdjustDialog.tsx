"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { MIN_SHORT } from "@/lib/upload/convert";
import { cropPixels, sourcePixels, type Crop, type Rot, type Settings, type Source } from "@/lib/upload/client";

const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Adjust: a free crop of the source (before it's converted), a quarter
 * turn, and "Stronger". The crop can't go below what prints at Small (the
 * short side's 800 px); under Full's 1,100 it says so. Drag inside to move,
 * a corner to resize; by keyboard, arrows move (Shift: further), Alt+arrows
 * resize from the corner, R turns.
 */
export function AdjustDialog({ source, settings, onDone, onClose }: { source: Source; settings: Settings; onDone: (patch: Pick<Settings, "crop" | "rot" | "stronger">) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  const [rot, setRot] = useState<Rot>(settings.rot);
  const [crop, setCrop] = useState<Crop>(settings.crop ?? FULL);
  const [stronger, setStronger] = useState(settings.stronger);
  const [snapped, setSnapped] = useState(false);
  // The turned source, drawn once per turn for the editor.
  const image = useMemo(() => {
    const px = sourcePixels(source, { crop: null, rot, stronger: false }, 900);
    const c = document.createElement("canvas");
    c.width = px.w;
    c.height = px.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.w, px.h), 0, 0);
    return c.toDataURL("image/jpeg", 0.85);
  }, [source, rot]);
  const { tw, th } = cropPixels(source, { crop: null, rot });
  // The smallest crop, as fractions: the Small minimum on the short side.
  const [minW, minH] = [MIN_SHORT.small / tw, MIN_SHORT.small / th];
  const short = cropPixels(source, { crop, rot }).short;
  const fit = (c: Crop): Crop => {
    const w = clamp(c.w, Math.min(1, minW), 1), h = clamp(c.h, Math.min(1, minH), 1);
    if (w !== c.w || h !== c.h) setSnapped(true);
    return { w, h, x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h) };
  };
  const set = (c: Crop) => setCrop(fit(c));

  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "move" | "tl" | "tr" | "bl" | "br"; x: number; y: number; start: Crop } | null>(null);
  const onDown = (kind: NonNullable<typeof drag.current>["kind"]) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, start: crop };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    const [dx, dy] = [(e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height];
    const c = d.start;
    if (d.kind === "move") set({ ...c, x: c.x + dx, y: c.y + dy });
    else {
      const left = d.kind === "tl" || d.kind === "bl", top = d.kind === "tl" || d.kind === "tr";
      const x0 = left ? clamp(c.x + dx, 0, c.x + c.w - minW) : c.x, y0 = top ? clamp(c.y + dy, 0, c.y + c.h - minH) : c.y;
      const x1 = left ? c.x + c.w : clamp(c.x + c.w + dx, c.x + minW, 1), y1 = top ? c.y + c.h : clamp(c.y + c.h + dy, c.y + minH, 1);
      set({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      turn();
      return;
    }
    if (!dir) return;
    e.preventDefault();
    if (e.altKey) set({ ...crop, w: crop.w + dir[0] * step, h: crop.h + dir[1] * step });
    else set({ ...crop, x: crop.x + dir[0] * step, y: crop.y + dir[1] * step });
  };
  const turn = () => {
    setRot(((rot + 90) % 360) as Rot);
    setCrop(FULL);
  };
  useEffect(() => {
    if (!snapped) return;
    const t = setTimeout(() => setSnapped(false), 1600);
    return () => clearTimeout(t);
  }, [snapped]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="adjust-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[100dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-ink-900 p-4 ring-1 ring-white/10 md:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 id="adjust-title" className="text-base font-bold">
            Adjust
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 rounded-full text-neutral-300 hover:text-white">
            ×
          </button>
        </div>
        <div className="relative mx-auto w-full select-none [touch-action:none]" onPointerMove={onMove} onPointerUp={() => (drag.current = null)}>
          <div ref={box} className="relative" style={{ aspectRatio: `${tw} / ${th}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Your picture" className="absolute inset-0 h-full w-full rounded-lg object-fill" draggable={false} />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Crop. Arrows move it, Alt and arrows resize it, R turns the picture."
              aria-valuenow={Math.round(crop.w * 100)}
              aria-valuetext={`${Math.round(crop.w * 100)}% by ${Math.round(crop.h * 100)}%, at ${Math.round(crop.x * 100)}%, ${Math.round(crop.y * 100)}%`}
              onKeyDown={onKey}
              onPointerDown={onDown("move")}
              className="absolute cursor-move outline-none ring-2 ring-white focus-visible:ring-4"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.6)" }}
              data-crop
            >
              {(["tl", "tr", "bl", "br"] as const).map((k) => (
                <span
                  key={k}
                  onPointerDown={onDown(k)}
                  className={`absolute flex h-11 w-11 items-center justify-center ${k[0] === "t" ? "-top-[22px]" : "-bottom-[22px]"} ${k[1] === "l" ? "-left-[22px]" : "-right-[22px]"} ${k === "tl" || k === "br" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
                  aria-hidden
                >
                  <span className="h-3.5 w-3.5 rounded-full bg-white ring-2 ring-black" />
                </span>
              ))}
            </div>
          </div>
        </div>
        <p role="status" className="min-h-4 text-xs text-neutral-400">
          {snapped ? "Smallest crop for printing." : short < MIN_SHORT.full ? "Small only at this crop." : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={turn} className="h-11 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
            Rotate 90°
          </button>
          <button type="button" aria-pressed={stronger} onClick={() => setStronger(!stronger)} className={`h-11 rounded-full px-4 text-sm font-semibold ring-1 ${stronger ? "bg-white text-black ring-white" : "text-white ring-white/25 hover:bg-white/10"}`}>
            Stronger
          </button>
          <button
            type="button"
            onClick={() => {
              setRot(0);
              setCrop(FULL);
              setStronger(false);
            }}
            className="h-11 px-2 text-sm text-neutral-300 underline underline-offset-4 hover:text-white"
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          data-autofocus
          onClick={() => onDone({ crop: crop.w >= 0.999 && crop.h >= 0.999 ? null : crop, rot, stronger })}
          className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black"
        >
          Done
        </button>
      </div>
    </div>
  );
}
