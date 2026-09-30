"use client";

import { useEffect, useState, type RefObject } from "react";

/** How far ahead of the visible area a picture starts loading (px): about two phone screens. */
export const NEAR_PX = 1600;

/**
 * The page scrolls inside its own column (AppShell), not the window: an
 * observer rooted at the viewport (and the browser's own loading="lazy") is
 * clipped by that scroller, so its margin never looks ahead and pictures only
 * start once they're on screen. This finds the scroller an element is in, to
 * root an observer there.
 */
export function scrollRootOf(el: Element | null): Element | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY, overflowX } = getComputedStyle(p);
    if (/(auto|scroll)/.test(overflowY) || /(auto|scroll)/.test(overflowX)) return p;
  }
  return null;
}

/** One observer per scroller (and margin), shared by every picture in it. */
const observers = new WeakMap<Element | Document, Map<number, { io: IntersectionObserver; seen: Map<Element, () => void> }>>();

function observe(el: Element, margin: number, onNear: () => void) {
  const root = scrollRootOf(el);
  const key = root ?? document;
  let byMargin = observers.get(key);
  if (!byMargin) observers.set(key, (byMargin = new Map()));
  let entry = byMargin.get(margin);
  if (!entry) {
    const seen = new Map<Element, () => void>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          seen.get(e.target)?.();
          seen.delete(e.target);
          io.unobserve(e.target);
        }
      },
      { root, rootMargin: `${margin}px ${margin}px` },
    );
    entry = { io, seen };
    byMargin.set(margin, entry);
  }
  entry.seen.set(el, onNear);
  entry.io.observe(el);
  const { io, seen } = entry;
  return () => {
    seen.delete(el);
    io.unobserve(el);
  };
}

/** Set once the page has hydrated: what the served HTML drew keeps its pictures (the first screen never waits for the script). */
let hydrated = false;

/**
 * True once the element is within `margin` px of its scroller's visible area (and stays true). `on` false: true
 * at once. Anything in the served HTML counts as near (it rendered with its picture), so the server and the
 * first client render agree.
 */
export function useNear(ref: RefObject<Element>, on = true, margin = NEAR_PX): boolean {
  const [near, setNear] = useState(() => !on || !hydrated);
  useEffect(() => {
    hydrated = true;
  }, []);
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true);
    return observe(el, margin, () => setNear(true));
  }, [ref, near, margin]);
  return near;
}
