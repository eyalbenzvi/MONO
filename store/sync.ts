"use client";

import { initialCart, useCartStore } from "@/store/cartStore";
import { initialTaste, useTasteStore } from "@/store/tasteStore";
import { catalogReady } from "@/lib/catalog";

/**
 * Another tab changed storage (a save, the bag…): reload it here instead of
 * overwriting it with this tab's stale copy on the next write. `key` is null
 * when the other tab cleared storage altogether: a store whose entry is gone
 * starts over, like a first visit.
 */
export async function syncFromStorage(key: string | null) {
  // Stored state is checked against the catalog.
  await catalogReady();
  const stores = [
    { store: useTasteStore, initial: initialTaste },
    { store: useCartStore, initial: initialCart },
  ] as const;
  for (const { store, initial } of stores) {
    const name = store.persist.getOptions().name!;
    if (key !== null && key !== name) continue;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(name);
    } catch {
      /* storage unavailable */
    }
    if (stored === null) {
      if (key === null) (store as { setState: (s: object) => void }).setState(initial());
    } else await store.persist.rehydrate();
  }
}
