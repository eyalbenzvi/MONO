/** Zoom maths shared by the full-screen zoom and the in-place card zoom. */
import { clamp01 } from "@/lib/math";

export interface ZoomTransform {
  /** Scale. */
  s: number;
  /** Pan, in px, of the zoomed layer's centre from the frame's centre. */
  x: number;
  y: number;
}

/** Keep the picture covering its frame: the pan is limited by how far the zoom overflows. */
export function clampPan(t: ZoomTransform, frame: { w: number; h: number }): ZoomTransform {
  if (t.s <= 1) return { s: t.s, x: 0, y: 0 };
  const mx = (frame.w * (t.s - 1)) / 2;
  const my = (frame.h * (t.s - 1)) / 2;
  return { s: t.s, x: Math.min(mx, Math.max(-mx, t.x)), y: Math.min(my, Math.max(-my, t.y)) };
}

/** Zoom to `s` keeping the point (px, py) — relative to the frame's centre — where it is. */
export function zoomAt(s: number, px: number, py: number, from: ZoomTransform, frame: { w: number; h: number }): ZoomTransform {
  const k = s / from.s;
  return clampPan({ s, x: px - (px - from.x) * k, y: py - (py - from.y) * k }, frame);
}

/**
 * Past the resting range a pinch meets resistance: it goes on at a third of
 * the rate, and never beyond 0.85× below or `max` + 0.5 above.
 */
export function rubberBand(s: number, min: number, max: number): number {
  if (s > max) return Math.min(max + 0.5, max + (s - max) / 3);
  if (s < min) return Math.max(min - 0.15, min - (min - s) / 3);
  return s;
}

/**
 * A step `p` (0 → 1) of the way from one resting transform to another. Scale
 * and pan move together, so a picture that covers its frame at both ends
 * covers it all the way (the pan limit is linear in the scale); `p` is held
 * to 0–1, so an overshooting ease never takes it past either end.
 */
export function zoomBetween(from: ZoomTransform, to: ZoomTransform, p: number): ZoomTransform {
  const k = clamp01(p);
  return { s: from.s + (to.s - from.s) * k, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
