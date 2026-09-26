/**
 * Warming the browser cache for mockups about to be shown (the shop's
 * category chips), so switching shows whole tees at once. Each file is
 * requested once per page load; idle warming is skipped on Save-Data.
 */
import { assetUrl, thumbUrl } from "@/lib/catalog";
import { modelFor } from "@/lib/models";
import type { ShirtProduct } from "@/types/shirt";

const requested = new Set<string>();
const held: HTMLImageElement[] = [];

/** The files a grid card needs: the print's thumbnail and the model photo. */
export function mockupFiles(shirt: ShirtProduct): string[] {
  const model = modelFor(shirt, shirt.baseColor);
  return [assetUrl(thumbUrl(shirt, shirt.baseColor)), ...(model ? [assetUrl(`/models/${model.id}.webp`)] : [])];
}

export function preloadMockups(shirts: ShirtProduct[], priority: "high" | "low" = "low") {
  if (typeof window === "undefined") return;
  for (const s of shirts)
    for (const url of mockupFiles(s)) {
      if (requested.has(url)) continue;
      requested.add(url);
      const img = new Image();
      img.decoding = "async";
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
      img.src = url;
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
