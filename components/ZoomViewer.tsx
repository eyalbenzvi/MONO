"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { PrintImage } from "@/components/PrintImage";
import { TeeMockup } from "@/components/TeeMockup";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

const MIN = 1;
const MAX = 5;
const DOUBLE_TAP = 2.6;

type View = "tee" | "print";
interface Transform {
  s: number;
  x: number;
  y: number;
}

/**
 * Full-screen zoom for a print: pinch, drag to pan, double-tap / double-click
 * to zoom in and out, mouse wheel, and +/− buttons. Rendered in a portal so a
 * transformed parent (the swipe card) can't trap the fixed overlay.
 */
export function ZoomViewer({
  shirt,
  color,
  initialView = "print",
  onClose,
  returnFocusTo,
}: {
  shirt: ShirtProduct;
  color: BaseColor;
  initialView?: View;
  onClose: () => void;
  /** Where focus goes on close when nothing was focused before (opened by a pinch). */
  returnFocusTo?: () => HTMLElement | null | undefined;
}) {
  const [view, setView] = useState<View>(initialView);
  const [t, setT] = useState<Transform>({ s: 1, x: 0, y: 0 });
  const panel = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mid: { x: number; y: number }; start: Transform } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);
  useFocusTrap(panel, true, onClose, returnFocusTo);

  // Keep the picture on screen: pan is limited by how far the zoom overflows.
  const clamp = useCallback((n: Transform): Transform => {
    const el = stage.current;
    const s = Math.min(MAX, Math.max(MIN, n.s));
    if (!el || s === 1) return { s, x: 0, y: 0 };
    const mx = (el.clientWidth * (s - 1)) / 2;
    const my = (el.clientHeight * (s - 1)) / 2;
    return { s, x: Math.min(mx, Math.max(-mx, n.x)), y: Math.min(my, Math.max(-my, n.y)) };
  }, []);

  /** Zoom to `s` keeping the point (px, py) — relative to the stage centre — fixed. */
  const zoomAt = useCallback(
    (s: number, px: number, py: number, from: Transform) => {
      const k = s / from.s;
      return clamp({ s, x: px - (px - from.x) * k, y: py - (py - from.y) * k });
    },
    [clamp],
  );

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
      className="fixed inset-0 z-[80] flex flex-col bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex rounded-full bg-white/10 p-0.5 ring-1 ring-white/15" role="tablist" aria-label="View">
          {(["print", "tee"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                setT({ s: 1, x: 0, y: 0 });
              }}
              className={`h-9 rounded-full px-4 text-xs font-semibold ${view === v ? "bg-white text-black" : "text-neutral-200"}`}
            >
              {v === "print" ? "Print" : "On the tee"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          data-autofocus
          aria-label="Close zoom"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
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
            <div className="aspect-[3/4] h-full max-w-full overflow-hidden rounded-[3px]" style={{ maxHeight: "min(100%, calc((100vw - 32px) * 4 / 3))" }}>
              <PrintImage shirt={shirt} color={color} />
            </div>
          ) : (
            <TeeMockup shirt={shirt} color={color} className="max-h-full w-full max-w-[640px]" shadow={false} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={() => step(1 / 1.6)} disabled={t.s <= MIN} aria-label="Zoom out" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 disabled:opacity-40">
          <Minus className="h-5 w-5" />
        </button>
        <span className="w-28 text-center font-mono text-xs text-neutral-400">{t.s > 1.02 ? `${t.s.toFixed(1)}×` : "Pinch or double-tap"}</span>
        <button type="button" onClick={() => step(1.6)} disabled={t.s >= MAX} aria-label="Zoom in" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 disabled:opacity-40">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
