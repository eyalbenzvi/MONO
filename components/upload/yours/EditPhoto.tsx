"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { IconName } from "@/lib/icons";
import { MIN_SHORT, type Pixels } from "@/lib/upload/convert";
import type { Crop, Rot, Settings, Source } from "@/lib/upload/client";
import { TONE_MAX, cropPixels, sourcePixels, strengthen, tone } from "@/lib/upload/pixels";
import { clamp } from "@/lib/math";

export type PhotoEdits = Pick<Settings, "crop" | "rot" | "flip" | "light" | "contrast" | "stronger">;

const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
/** The crop's shapes, as width over height in the picture's own pixels (null: free). */
const ASPECTS: { id: string; label: string; r: number | null }[] = [
  { id: "free", label: "Free", r: null },
  { id: "square", label: "Square", r: 1 },
  { id: "3:4", label: "3:4", r: 3 / 4 },
  { id: "4:3", label: "4:3", r: 4 / 3 },
];
const TURNED: Record<string, string> = { "3:4": "4:3", "4:3": "3:4" };
/** The picture the sheet draws on, long side: sharp enough on a phone, quick to redraw as a slider moves. */
const PREVIEW_LONG = 720;

/**
 * Edit photo: the picture before it's converted, in two panels. Crop (free
 * or a fixed shape, a quarter turn, a mirror) and Light (light, contrast,
 * "Stronger"), shown on the picture in grey as it will print in one ink.
 * Save applies it all at once; closing (×, Escape, outside) keeps what was
 * there. The crop can't go below what prints at Small (the short side's
 * 600 px); under Full's 900 it says so. Drag inside the frame to move it,
 * a corner to resize; by keyboard, arrows move (Shift: further), Alt+arrows
 * resize, R turns. Save stays in view whatever the phone's height: the
 * picture takes what's left.
 */
export function EditPhoto({ source, settings, onSave, onClose }: { source: Source; settings: Settings; onSave: (edits: PhotoEdits) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  const [tab, setTab] = useState<"crop" | "light">("crop");
  const [rot, setRot] = useState<Rot>(settings.rot);
  const [flip, setFlip] = useState(settings.flip);
  const [crop, setCrop] = useState<Crop>(settings.crop ?? FULL);
  const [aspect, setAspect] = useState("free");
  const [light, setLight] = useState(settings.light);
  const [contrast, setContrast] = useState(settings.contrast);
  const [stronger, setStronger] = useState(settings.stronger);
  const [snapped, setSnapped] = useState(false);

  /* ---------------- the picture ---------------- */
  // Turned and mirrored once per change; light, contrast and Stronger laid on it as they move.
  const base = useMemo<Pixels>(() => sourcePixels(source, { crop: null, rot, flip, stronger: false }, PREVIEW_LONG), [source, rot, flip]);
  const canvas = useRef<HTMLCanvasElement>(null);
  // The frame: the picture fitted into the room the sheet leaves it (the canvas is there once it's measured).
  const room = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);
  const shown = !!fit;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const f = requestAnimationFrame(() => {
      const data = new Uint8ClampedArray(base.data);
      if (light || contrast) tone(data, light, contrast);
      if (stronger) strengthen(data);
      c.width = base.w;
      c.height = base.h;
      c.getContext("2d")!.putImageData(new ImageData(data, base.w, base.h), 0, 0);
    });
    return () => cancelAnimationFrame(f);
  }, [base, light, contrast, stronger, shown]);

  const { tw, th } = cropPixels(source, { crop: null, rot });
  useLayoutEffect(() => {
    const el = room.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const k = Math.min(r.width / tw, r.height / th);
      setFit(k > 0 ? { w: Math.floor(tw * k), h: Math.floor(th * k) } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tw, th]);

  /* ---------------- the crop ---------------- */
  // The smallest crop, as fractions: the Small minimum on the short side.
  const [minW, minH] = [Math.min(1, MIN_SHORT.small / tw), Math.min(1, MIN_SHORT.small / th)];
  const ratio = ASPECTS.find((a) => a.id === aspect)?.r ?? null;
  const short = cropPixels(source, { crop, rot }).short;
  const snap = () => setSnapped(true);
  /** A free crop kept inside the picture and above the smallest. */
  const fitFree = (c: Crop): Crop => {
    const w = clamp(c.w, minW, 1), h = clamp(c.h, minH, 1);
    if (w !== c.w || h !== c.h) snap();
    return { w, h, x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h) };
  };
  /** Height for a width at the shape, as fractions (the shape is in pixels). */
  const hFor = (w: number, r: number) => (w * tw) / (th * r);
  /** A shaped crop from one corner (ax, ay) growing towards (dx, dy) = ±1, as wide as `want` allows. */
  const shaped = (ax: number, ay: number, dx: number, dy: number, want: number, r: number): Crop => {
    const maxW = Math.min(dx > 0 ? 1 - ax : ax, ((dy > 0 ? 1 - ay : ay) * th * r) / tw);
    const minWr = Math.max(minW, (minH * th * r) / tw);
    const w = clamp(want, Math.min(minWr, maxW), maxW);
    if (w !== want && want < minWr) snap();
    const h = hFor(w, r);
    return { w, h, x: dx > 0 ? ax : ax - w, y: dy > 0 ? ay : ay - h };
  };
  /** The largest crop of a shape, centred where the crop is now. */
  const largest = (r: number, around: Crop = crop): Crop => {
    let w = 1, h = hFor(1, r);
    if (h > 1) (h = 1), (w = (th * r) / tw);
    const [cx, cy] = [around.x + around.w / 2, around.y + around.h / 2];
    return { w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) };
  };
  /** Whether a shape's largest crop is big enough to print (a small picture can't be cut to every shape). */
  const fits = (r: number | null) => {
    if (!r) return true;
    const c = largest(r);
    return Math.min(c.w * tw, c.h * th) + 0.5 >= MIN_SHORT.small;
  };
  const chooseAspect = (id: string) => {
    if (!fits(ASPECTS.find((a) => a.id === id)?.r ?? null)) return;
    setAspect(id);
    const r = ASPECTS.find((a) => a.id === id)?.r;
    if (r) setCrop(largest(r));
  };

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
    const [mx, my] = [(e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height];
    const c = d.start;
    if (d.kind === "move") return setCrop({ ...c, x: clamp(c.x + mx, 0, 1 - c.w), y: clamp(c.y + my, 0, 1 - c.h) });
    const left = d.kind === "tl" || d.kind === "bl", top = d.kind === "tl" || d.kind === "tr";
    // The corner opposite the one held stays put.
    const [ax, ay] = [left ? c.x + c.w : c.x, top ? c.y + c.h : c.y];
    const [dx, dy] = [left ? -1 : 1, top ? -1 : 1];
    const w = c.w + dx * mx, h = c.h + dy * my;
    if (ratio) return setCrop(shaped(ax, ay, dx, dy, Math.max(w, (h * th * ratio) / tw), ratio));
    const [cw, ch] = [clamp(w, minW, dx > 0 ? 1 - ax : ax), clamp(h, minH, dy > 0 ? 1 - ay : ay)];
    if (cw > w || ch > h) snap();
    setCrop({ w: cw, h: ch, x: dx > 0 ? ax : ax - cw, y: dy > 0 ? ay : ay - ch });
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const dir = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      return turn();
    }
    if (!dir) return;
    e.preventDefault();
    if (!e.altKey) return setCrop(fitFree({ ...crop, x: crop.x + dir[0] * step, y: crop.y + dir[1] * step }));
    if (ratio) return setCrop(shaped(crop.x, crop.y, 1, 1, crop.w + (dir[0] || dir[1]) * step, ratio));
    setCrop(fitFree({ ...crop, w: crop.w + dir[0] * step, h: crop.h + dir[1] * step }));
  };

  /* ---------------- turn, mirror, reset ---------------- */
  // The crop turns with the picture (a quarter clockwise as seen, anticlockwise in the source's frame when mirrored).
  const turn = () => {
    setRot(((rot + 90) % 360) as Rot);
    setCrop((c) => (flip ? { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w } : { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w }));
    setAspect((a) => TURNED[a] ?? a);
  };
  const mirror = () => {
    setFlip(!flip);
    setCrop((c) => ({ ...c, x: 1 - c.x - c.w }));
  };
  const reset = () => {
    setRot(0);
    setFlip(false);
    setCrop(FULL);
    setAspect("free");
    setLight(0);
    setContrast(0);
    setStronger(false);
  };
  const save = () => onSave({ crop: crop.w >= 0.999 && crop.h >= 0.999 ? null : crop, rot, flip, light, contrast, stronger });

  useEffect(() => {
    if (!snapped) return;
    const t = setTimeout(() => setSnapped(false), 1600);
    return () => clearTimeout(t);
  }, [snapped]);

  const chip = (on: boolean) => `inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-4 text-sm font-medium ring-1 transition ${on ? "bg-white text-black ring-white" : "text-white ring-white/25 hover:bg-white/10"}`;
  const tool = (icon: IconName, label: string, onClick: () => void, pressed?: boolean) => (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={chip(!!pressed)}>
      <Icon name={icon} className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center md:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-photo-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full max-w-lg flex-col bg-ink-900 ring-1 ring-white/10 md:h-[min(860px,100%)] md:rounded-sheet"
        data-edit-sheet
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-2">
          <button type="button" onClick={onClose} aria-label="Close without saving" className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-300 hover:text-white">
            <Icon name="x" className="h-5 w-5" />
          </button>
          <h2 id="edit-photo-title" className="text-base font-medium">
            Edit photo
          </h2>
          <button type="button" onClick={reset} className="h-11 px-3 text-sm text-neutral-300 underline underline-offset-4 hover:text-white" data-edit-reset>
            Reset
          </button>
        </div>

        {/* The picture: whatever room the controls leave, never pushing Save out of view. */}
        <div ref={room} className="relative mx-4 min-h-0 flex-1" onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
          {fit && (
            <div ref={box} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none [touch-action:none]" style={{ width: fit.w, height: fit.h }}>
              {/* The shade outside the crop, clipped to the picture (so the sheet's own controls are never dimmed). */}
              <div className="absolute inset-0 overflow-hidden rounded-md">
                <canvas ref={canvas} role="img" aria-label="Your picture, as it will print in one ink" className="h-full w-full grayscale" data-edit-canvas />
                <div aria-hidden className="pointer-events-none absolute" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.6)" }} />
              </div>
              <div
                role="slider"
                tabIndex={tab === "crop" ? 0 : -1}
                aria-label="Crop. Arrows move it, Alt and arrows resize it, R turns the picture."
                aria-valuenow={Math.round(crop.w * 100)}
                aria-valuetext={`${Math.round(crop.w * 100)}% by ${Math.round(crop.h * 100)}%, at ${Math.round(crop.x * 100)}%, ${Math.round(crop.y * 100)}%`}
                onKeyDown={onKey}
                onPointerDown={tab === "crop" ? onDown("move") : undefined}
                className={`absolute outline-none ring-2 ring-white focus-visible:ring-4 ${tab === "crop" ? "cursor-move" : "pointer-events-none ring-white/40"}`}
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                data-crop
              >
                {tab === "crop" && (
                  <>
                    {/* Thirds, to place the subject. */}
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33.1%,rgba(255,255,255,.35)_33.3%,transparent_33.5%,transparent_66.4%,rgba(255,255,255,.35)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.1%,rgba(255,255,255,.35)_33.3%,transparent_33.5%,transparent_66.4%,rgba(255,255,255,.35)_66.6%,transparent_66.8%)]" />
                    {(["tl", "tr", "bl", "br"] as const).map((k) => (
                      <span
                        key={k}
                        onPointerDown={onDown(k)}
                        className={`absolute flex h-11 w-11 items-center justify-center ${k[0] === "t" ? "-top-[22px]" : "-bottom-[22px]"} ${k[1] === "l" ? "-left-[22px]" : "-right-[22px]"} ${k === "tl" || k === "br" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
                        aria-hidden
                        data-corner={k}
                      >
                        <span className="h-3.5 w-3.5 rounded-full bg-white ring-2 ring-black" />
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <p role="status" className="mx-4 mt-2 min-h-4 shrink-0 text-center text-xs text-neutral-400">
          {snapped ? "Smallest crop for printing." : short < MIN_SHORT.full ? "Small only at this crop." : ""}
        </p>

        <div className="shrink-0 space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
          <div role="tablist" aria-label="Edit" className="flex gap-1 rounded-control bg-white/[0.06] p-1 ring-1 ring-white/10">
            {(
              [
                ["crop", "Crop", "crop"],
                ["light", "Light", "sun"],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`edit-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`edit-panel-${id}`}
                onClick={() => setTab(id)}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-control text-sm font-medium transition ${tab === id ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
              >
                <Icon name={icon} className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {tab === "crop" ? (
            <div role="tabpanel" id="edit-panel-crop" aria-labelledby="edit-tab-crop" className="space-y-3">
              <div role="radiogroup" aria-label="Crop shape" className="no-scrollbar -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1">
                {ASPECTS.map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={aspect === a.id} disabled={!fits(a.r)} title={fits(a.r) ? undefined : "Too small to print at this shape"} onClick={() => chooseAspect(a.id)} className={`${chip(aspect === a.id)} disabled:opacity-35`} data-aspect={a.id}>
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {tool("rotate-cw", "Rotate", turn)}
                {tool("flip-horizontal-2", "Mirror", mirror, flip)}
              </div>
            </div>
          ) : (
            <div role="tabpanel" id="edit-panel-light" aria-labelledby="edit-tab-light" className="space-y-3">
              <Slider label="Light" icon="sun" value={light} onChange={setLight} />
              <Slider label="Contrast" icon="contrast" value={contrast} onChange={setContrast} />
              {tool("wand-sparkles", "Stronger", () => setStronger(!stronger), stronger)}
            </div>
          )}

          <button type="button" data-autofocus onClick={save} className="flex h-12 w-full items-center justify-center rounded-control bg-white text-sm font-medium text-black transition active:scale-[0.98]" data-edit-save>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** A tone slider from -TONE_MAX to TONE_MAX; a double tap on its label puts it back to 0. */
function Slider({ label, icon, value, onChange }: { label: string; icon: IconName; value: number; onChange: (v: number) => void }) {
  const id = `edit-${label.toLowerCase()}`;
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="flex w-24 shrink-0 items-center gap-2 text-sm text-neutral-300" onDoubleClick={() => onChange(0)}>
        <Icon name={icon} className="h-4 w-4" /> {label}
      </label>
      <input
        id={id}
        type="range"
        min={-TONE_MAX}
        max={TONE_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={value === 0 ? "As taken" : `${value > 0 ? "+" : ""}${value}`}
        className="h-10 min-w-0 flex-1 accent-white"
        data-tone={label.toLowerCase()}
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-400">{value > 0 ? `+${value}` : value}</span>
    </div>
  );
}
