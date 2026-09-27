/**
 * Warming the browser cache for mockups about to be shown (the shop's
 * category chips), so switching shows whole tees at once. Each picture is
 * requested once per page load, in the size a grid card will ask for (the
 * same srcset and sizes, so the browser picks the same file); idle warming
 * is skipped on Save-Data.
 */
import { SIZES, mockupImage } from "@/lib/images";
import { teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

const requested = new Set<string>();
const held: HTMLImageElement[] = [];

/** Each on `color` when it's sold on it (the shop's tee filter), else on its original tee. */
export function preloadMockups(shirts: ShirtProduct[], priority: "high" | "low" = "low", color: BaseColor | null = null) {
  if (typeof window === "undefined") return;
  for (const s of shirts) {
    const { src, srcSet } = mockupImage(s, teeColor(s, color));
    if (requested.has(src)) continue;
    requested.add(src);
    const img = new Image();
    img.decoding = "async";
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
    img.sizes = SIZES.grid;
    img.srcset = srcSet;
    img.src = src;
    // Held until loaded, so the request isn't dropped with the element.
    held.push(img);
    img.onload = img.onerror = () => held.splice(held.indexOf(img), 1);
  }
}

/** On a data-saving connection, nothing is fetched ahead of need. */
export const saveData = () =>
  typeof navigator !== "undefined" && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/** Runs `fn` when the browser is idle (or soon, where idle callbacks don't exist). */
export function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = setTimeout(fn, 800);
  return () => clearTimeout(t);
}
