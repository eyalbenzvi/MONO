"use client";

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { PrintImage } from "@/components/PrintImage";
import { TeeMockup } from "@/components/TeeMockup";

// Only when a personalised print is zoomed (its code stays out of the page until then).
const CustomMockup = lazy(() => import("@/components/custom/CustomMockup").then((m) => ({ default: m.CustomMockup })));
const CustomPrint = lazy(() => import("@/components/custom/CustomPrint").then((m) => ({ default: m.CustomPrint })));
import { zoomStep } from "@/components/Sharper";
import { SIZES } from "@/lib/images";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHistorySheet } from "@/hooks/useHistorySheet";
import { clampPan, zoomAt as zoomAtPoint, type ZoomTransform } from "@/lib/zoom";
import { PRINT_SIZE_CM, printSizeLabel, type BaseColor, type ShirtProduct } from "@/types/shirt";

const MIN = 1;
const MAX = 5;
const DOUBLE_TAP = 2.6;

type View = "tee" | "print";
type Transform = ZoomTransform;

/**
 * Full-screen zoom for a print: pinch, drag to pan, double-tap / double-click
 * to zoom in and out, mouse wheel, and +/− buttons. Rendered in a portal so a
 * transformed parent (the swipe card) can't trap the fixed overlay.
 */
export function ZoomViewer({
  shirt,
  color,
  initialView = "tee",
  onClose,
  returnFocusTo,
  printCm = PRINT_SIZE_CM,
  customSvg,
}: {
  shirt: ShirtProduct;
  color: BaseColor;
  /** The view the shopper was looking at (the zoom opens in it). */
  initialView?: View;
  /** The print's real size on the tee (defaults to the full print area). */
  printCm?: { width: number; height: number };
  onClose: () => void;
  /** Where focus goes on close when nothing was focused before (opened by a pinch). */
  returnFocusTo?: () => HTMLElement | null | undefined;
  /** A personalised print (lib/custom): shown instead of the design's own. */
  customSvg?: string | null;
}) {
  const [view, setView] = useState<View>(initialView);
  const [t, setT] = useState<Transform>({ s: 1, x: 0, y: 0 });
  // The hint names the gestures of the device in hand.
  const [coarse, setCoarse] = useState(true);
  useEffect(() => setCoarse(window.matchMedia("(pointer: coarse)").matches), []);
  const panel = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mid: { x: number; y: number }; start: Transform } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);
  // A step in the history (#zoom): Back closes it; X closes through it.
  const { close } = useHistorySheet("zoom", true, onClose);
  useFocusTrap(panel, true, close, returnFocusTo);

  // The print's on-screen width, for the scale bar.
  const printBox = useRef<HTMLDivElement>(null);
  const [printWidth, setPrintWidth] = useState(0);
  useEffect(() => {
    const el = printBox.current;
    if (!el) return setPrintWidth(0);
    // Layout width (offsetWidth ignores the zoom transform, applied separately).
    const ro = new ResizeObserver(() => setPrintWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  // Keep the picture on screen: pan is limited by how far the zoom overflows.
  const frame = useCallback(() => ({ w: stage.current?.clientWidth ?? 0, h: stage.current?.clientHeight ?? 0 }), []);
  const clamp = useCallback((n: Transform): Transform => clampPan({ ...n, s: Math.min(MAX, Math.max(MIN, n.s)) }, frame()), [frame]);

  /** Zoom to `s` keeping the point (px, py) — relative to the stage centre — fixed. */
  const zoomAt = useCallback((s: number, px: number, py: number, from: Transform) => zoomAtPoint(Math.min(MAX, Math.max(MIN, s)), px, py, from, frame()), [frame]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, start: t };
    } else gesture.current = { dist: 0, mid: local(e), start: t };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (pointers.current.size >= 2 && g.dist > 0) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomAt(g.start.s * (dist / g.dist), g.mid.x, g.mid.y, g.start);
      setT(clamp({ ...z, x: z.x + mid.x - g.mid.x, y: z.y + mid.y - g.mid.y }));
      moved.current = true;
    } else if (pointers.current.size === 1) {
      const p = local(e);
      const dx = p.x - g.mid.x;
      const dy = p.y - g.mid.y;
      if (Math.hypot(dx, dy) > 4) moved.current = true;
      if (g.start.s > 1) setT(clamp({ ...g.start, x: g.start.x + dx, y: g.start.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      // One finger left after a pinch: continue as a pan from here.
      gesture.current = { dist: 0, mid: [...pointers.current.values()][0], start: t };
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (moved.current) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const p = local(e);
      setT((cur) => (cur.s > 1.05 ? { s: 1, x: 0, y: 0 } : zoomAt(DOUBLE_TAP, p.x, p.y, cur)));
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  // Wheel / trackpad zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left - r.width / 2;
      const py = e.clientY - r.top - r.height / 2;
      setT((cur) => zoomAt(cur.s * Math.exp(-e.deltaY * 0.0022), px, py, cur));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const step = (k: number) => setT((cur) => zoomAt(cur.s * k, 0, 0, cur));

  return createPortal(
    <motion.div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`${shirt.title} — zoom`}
      className="fixed inset-0 z-sheet flex flex-col bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex rounded-control bg-white/10 p-0.5 ring-1 ring-white/15" role="group" aria-label="View">
          {/* Same order as everywhere: On the tee | Print. */}
          {(["tee", "print"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                setT({ s: 1, x: 0, y: 0 });
              }}
              className={`h-11 rounded-control px-4 text-xs font-medium ${view === v ? "bg-white text-black" : "text-neutral-200"}`}
            >
              {v === "print" ? "Print" : "On the tee"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          data-autofocus
          aria-label="Close zoom"
          className="flex h-11 w-11 items-center justify-center text-neutral-200 hover:text-white"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={stage}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full w-full items-center justify-center p-4"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: gesture.current ? "none" : "transform 0.18s ease-out" }}
        >
          {view === "print" ? (
            <div ref={printBox} className="aspect-[3/4] h-full max-w-full overflow-hidden rounded-[3px]" style={{ maxHeight: "min(100%, calc((100vw - 32px) * 4 / 3))" }}>
              {customSvg ? (
                <Suspense fallback={null}>
                  <CustomPrint svg={customSvg} />
                </Suspense>
              ) : (
                <PrintImage shirt={shirt} color={color} sizes={printWidth ? `${printWidth}px` : SIZES.zoom} zoom={zoomStep(t.s)} />
              )}
            </div>
          ) : (
            customSvg ? (
              <Suspense fallback={<TeeMockup shirt={shirt} color={color} sizes={SIZES.zoom} className="max-h-full w-full max-w-[640px]" />}>
                <CustomMockup shirt={shirt} svg={customSvg} color={color} sizes={SIZES.zoom} zoomed={t.s > 1.3} className="max-h-full w-full max-w-[640px]" />
              </Suspense>
            ) : (
              <TeeMockup shirt={shirt} color={color} sizes={SIZES.zoom} zoomed={t.s > 1.3} className="max-h-full w-full max-w-[640px]" />
            )
          )}
        </div>
      </div>

      {/* Scale: a 10 cm bar at the print's real size (it grows with the zoom). */}
      {view === "print" && printWidth > 0 && (
        <div className="pointer-events-none flex items-center justify-center gap-2 pt-1 font-mono text-xs text-neutral-400" aria-label={`Print ${printSizeLabel(printCm)}`}>
          <span className="h-2 border-x border-b border-neutral-400" style={{ width: Math.min(printWidth * t.s * (10 / printCm.width), 280) }} aria-hidden />
          10 cm · print {printSizeLabel(printCm)}
        </div>
      )}
      <div className="flex items-center justify-center gap-3 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={() => step(1 / 1.6)} disabled={t.s <= MIN} aria-label="Zoom out" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 disabled:opacity-40">
          <Icon name="minus" className="h-5 w-5" />
        </button>
        <span className="min-w-28 whitespace-nowrap text-center font-mono text-xs text-neutral-400">
          {t.s > 1.02 ? `${t.s.toFixed(1)}×` : coarse ? "Pinch or double-tap" : "Scroll or double-click"}
        </span>
        <button type="button" onClick={() => step(1.6)} disabled={t.s >= MAX} aria-label="Zoom in" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 disabled:opacity-40">
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
