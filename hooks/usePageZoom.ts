"use client";

import { useSyncExternalStore } from "react";
import { zoomStep } from "@/components/Sharper";

/**
 * How far the page is pinch-zoomed, in a few steps (zoomStep): pictures lay
 * a file that many times bigger over themselves (Sharper), so a zoomed-in
 * page stays sharp. One listener for the whole page.
 */
const step = zoomStep;

let current = 1;
const listeners = new Set<() => void>();
function onViewport() {
  const next = step(window.visualViewport?.scale ?? 1);
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    window.visualViewport?.addEventListener("resize", onViewport);
    onViewport();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.visualViewport?.removeEventListener("resize", onViewport);
  };
}

export const pageZoomStep = step;
export const usePageZoom = () => useSyncExternalStore(subscribe, () => current, () => 1);
