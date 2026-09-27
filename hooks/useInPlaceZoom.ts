"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { animate, useMotionValue, useReducedMotion, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import { useUiStore } from "@/store/useUiStore";
import { clampPan, rubberBand, zoomAt, zoomBetween, type ZoomTransform } from "@/lib/zoom";

/** Resting zoom range; a pinch may overshoot the top to the rubber-band limit. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** Double-tap / double-click zoom. */
export const ZOOM_DOUBLE = 2.5;
/** Let go at or under this and the picture springs back to 1×. */
export const ZOOM_SNAP = 1.1;
/** Wait for a second tap before a single tap counts (it flips the card). */
export const DOUBLE_TAP_MS = 260;
/** After a reset the card ignores swipes for a moment (the lifting finger). */
const GRACE_MS = 250;
/**
 * One eased step for scale and pan together (see zoomBetween): separate
 * springs kept each value's own speed from the pinch, so on letting go the
 * scale dipped under 1× while the pan lagged and the photo left its frame.
 */
const EASE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const;

export interface InPlaceZoom {
  /** Motion values for the zoomed layer (scale, pan). */
  values: { scale: MotionValue<number>; x: MotionValue<number>; y: MotionValue<number> };
  /** Zoomed in, mid-gesture, or in the grace after a reset: no swiping or flipping. */
  zoomed: boolean;
  /** What a screen reader hears after a zoom change. */
  announce: string;
  reset: (instant?: boolean) => void;
  /**
   * A tap on the card: while zoomed it resets; otherwise it waits briefly for
   * a second tap (zoom in there) before `single` runs.
   */
  tap: (point: { clientX: number; clientY: number }, single: () => void) => void;
  /** The last press moved (pan or pinch): its tap is not a tap. */
  moved: () => boolean;
}

/**
 * Pinch-to-zoom in place on the Discover card: the picture itself zooms
 * inside its frame, and zooming back out (or a tap) returns the card as it
 * was, ready to swipe. `cardRef` receives the gestures; the element marked
 * `data-zoom-stage` inside it is the frame (its centre is the origin).
 */
export function useInPlaceZoom(cardRef: RefObject<HTMLElement | null>, enabled: boolean, onPinchStart?: () => void): InPlaceZoom {
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const [zoomed, setZoomedState] = useState(false);
  const zoomedRef = useRef(false);
  const [announce, setAnnounce] = useState("");
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mid: { x: number; y: number }; start: ZoomTransform } | null>(null);
  const movedRef = useRef(false);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchStart = useRef(onPinchStart);
  pinchStart.current = onPinchStart;

  const setZoomed = useCallback((on: boolean) => {
    if (grace.current) clearTimeout(grace.current);
    grace.current = null;
    zoomedRef.current = on;
    setZoomedState(on);
    useUiStore.getState().setCardZoomed(on);
  }, []);

  const stage = useCallback(() => cardRef.current?.querySelector<HTMLElement>("[data-zoom-stage]") ?? null, [cardRef]);
  const size = useCallback(() => {
    const el = stage();
    return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
  }, [stage]);
  /** A point relative to the frame's centre. */
  const local = useCallback(
    (p: { clientX: number; clientY: number }) => {
      const r = stage()?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: p.clientX - r.left - r.width / 2, y: p.clientY - r.top - r.height / 2 };
    },
    [stage],
  );
  const current = useCallback((): ZoomTransform => ({ s: scale.get(), x: x.get(), y: y.get() }), [scale, x, y]);

  const running = useRef<AnimationPlaybackControls | null>(null);
  const apply = useCallback(
    (t: ZoomTransform, animated: boolean) => {
      running.current?.stop();
      running.current = null;
      const put = (v: ZoomTransform) => {
        scale.set(v.s);
        x.set(v.x);
        y.set(v.y);
      };
      if (!animated || reduceMotion) return put(t);
      const from = { s: scale.get(), x: x.get(), y: y.get() };
      running.current = animate(0, 1, { ...EASE, onUpdate: (p) => put(zoomBetween(from, t, p)) });
    },
    [reduceMotion, scale, x, y],
  );

  const reset = useCallback(
    (instant = false) => {
      if (pendingTap.current) clearTimeout(pendingTap.current);
      pendingTap.current = null;
      gesture.current = null;
      pointers.current.clear();
      const was = zoomedRef.current || scale.get() !== 1;
      apply({ s: 1, x: 0, y: 0 }, !instant);
      if (!was) return;
      setAnnounce("Zoom reset");
      if (instant) return setZoomed(false);
      // Swiping comes back a moment later, so the lifting finger doesn't throw the card.
      if (grace.current) clearTimeout(grace.current);
      grace.current = setTimeout(() => setZoomed(false), GRACE_MS);
    },
    [apply, scale, setZoomed],
  );

  const zoomTo = useCallback(
    (s: number, p: { x: number; y: number }, animated = true) => {
      const next = zoomAt(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)), p.x, p.y, current(), size());
      if (next.s <= ZOOM_MIN) return reset(!animated);
      if (!zoomedRef.current) setZoomed(true);
      apply(next, animated);
      setAnnounce(`Zoomed ${Math.round(next.s * 10) / 10}×`);
    },
    [apply, current, reset, setZoomed, size],
  );

  /** Let go: back inside the resting range, or all the way out. */
  const settle = useCallback(() => {
    const t = current();
    if (t.s <= ZOOM_SNAP) return reset();
    apply(clampPan({ ...t, s: Math.min(ZOOM_MAX, t.s) }, size()), true);
    setAnnounce(`Zoomed ${Math.round(Math.min(ZOOM_MAX, t.s) * 10) / 10}×`);
  }, [apply, current, reset, size]);

  // Pointer gestures: two fingers pinch (from any state); one pans while zoomed.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !enabled) return;
    const down = (e: PointerEvent) => {
      if (pointers.current.size === 0) movedRef.current = false;
      pointers.current.set(e.pointerId, local(e));
      if (pointers.current.size === 2) {
        // A pinch: the card stops following the first finger and settles.
        pinchStart.current?.();
        if (!zoomedRef.current) setZoomed(true);
        if (pendingTap.current) clearTimeout(pendingTap.current);
        pendingTap.current = null;
        const [a, b] = [...pointers.current.values()];
        gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, start: current() };
      } else if (pointers.current.size === 1 && zoomedRef.current) {
        gesture.current = { dist: 0, mid: local(e), start: current() };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, local(e));
      const g = gesture.current;
      if (!g) return;
      if (pointers.current.size >= 2 && g.dist > 0) {
        e.preventDefault();
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        // Never under 1×: the picture always fills its frame (resistance above only).
        const s = Math.max(ZOOM_MIN, rubberBand(g.start.s * (dist / g.dist), ZOOM_MIN, ZOOM_MAX));
        const k = s / g.start.s;
        // Keep the point under the fingers under them, and follow their midpoint.
        const t = { s, x: mid.x - (g.mid.x - g.start.x) * k, y: mid.y - (g.mid.y - g.start.y) * k };
        apply(clampPan(t, size()), false);
        movedRef.current = true;
      } else if (pointers.current.size === 1 && g.start.s > 1) {
        const p = local(e);
        const dx = p.x - g.mid.x;
        const dy = p.y - g.mid.y;
        if (Math.hypot(dx, dy) > 4) movedRef.current = true;
        apply(clampPan({ ...g.start, x: g.start.x + dx, y: g.start.y + dy }, size()), false);
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.current.delete(e.pointerId)) return;
      if (pointers.current.size === 1 && gesture.current) {
        // One finger left after a pinch: carry on as a pan from here.
        gesture.current = { dist: 0, mid: [...pointers.current.values()][0], start: current() };
        return;
      }
      if (pointers.current.size > 0) return;
      const was = gesture.current;
      gesture.current = null;
      if (was && movedRef.current) settle();
    };
    // Trackpad pinch (ctrl + wheel) or ctrl + mouse wheel: zoom at the cursor.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !zoomedRef.current) return;
      e.preventDefault();
      if (useUiStore.getState().isFlipped) return;
      const t = current();
      const s = t.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      if (s <= ZOOM_SNAP && s < t.s) return reset();
      zoomTo(s, local(e), false);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [cardRef, enabled, local, apply, current, settle, reset, zoomTo, size, setZoomed]);

  // Keyboard: + / − / 0 zoom; while zoomed arrows pan, Esc / Space reset
  // (before the page's swipe keys see them).
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (ui.dialogs > 0 || ui.isFlipped || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      const on = zoomedRef.current;
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (e.key === "+" || e.key === "=") {
        stop();
        zoomTo(Math.max(1.5, current().s * 1.5), { x: 0, y: 0 });
      } else if (e.key === "-" || e.key === "_") {
        if (!on) return;
        stop();
        const s = current().s / 1.5;
        if (s <= ZOOM_SNAP) reset();
        else zoomTo(s, { x: 0, y: 0 });
      } else if (e.key === "0" || ((e.key === "Escape" || e.key === " ") && on)) {
        if (!on) return;
        stop();
        reset();
      } else if (on && e.key.startsWith("Arrow")) {
        stop();
        const step = 40;
        const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key] ?? [0, 0];
        const c = current();
        apply(clampPan({ ...c, x: c.x + d[0], y: c.y + d[1] }, size()), true);
      } else if (on) {
        // Swipe and undo keys wait until the picture is back.
        if (["z", "Z", "Backspace"].includes(e.key)) stop();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, zoomTo, reset, apply, current, size]);

  // A resized window changes the frame: start from the whole picture again.
  useEffect(() => {
    const onResize = () => zoomedRef.current && reset(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [reset]);

  // Leaving the card (unmount) clears the shared flag and timers.
  useEffect(
    () => () => {
      if (pendingTap.current) clearTimeout(pendingTap.current);
      if (grace.current) clearTimeout(grace.current);
      running.current?.stop();
      if (zoomedRef.current) useUiStore.getState().setCardZoomed(false);
    },
    [],
  );

  const tap = useCallback(
    (point: { clientX: number; clientY: number }, single: () => void) => {
      if (movedRef.current) return;
      if (zoomedRef.current) return reset();
      if (pendingTap.current) {
        clearTimeout(pendingTap.current);
        pendingTap.current = null;
        zoomTo(ZOOM_DOUBLE, local(point));
        return;
      }
      pendingTap.current = setTimeout(() => {
        pendingTap.current = null;
        single();
      }, DOUBLE_TAP_MS);
    },
    [reset, zoomTo, local],
  );

  const moved = useCallback(() => movedRef.current, []);
  const values = useMemo(() => ({ scale, x, y }), [scale, x, y]);
  return { values, zoomed, announce, reset, tap, moved };
}
