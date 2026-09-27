"use client";

import { useCallback, useEffect, useState } from "react";
import { saveData, whenIdle } from "@/lib/preload";
import type { SearchIndex } from "@/lib/search/format";

type Runtime = typeof import("@/lib/search/runtime");
export interface SearchRuntime {
  mod: Runtime;
  index: SearchIndex;
}

// One load per page life, shared by every mount of the shop.
let loading: Promise<SearchRuntime | null> | null = null;
const load = () =>
  (loading ??= import("@/lib/search/runtime")
    .then(async (mod) => {
      const index = await mod.loadSearchIndex();
      return index ? { mod, index } : null;
    })
    .catch(() => null));

/**
 * The search engine and its index, fetched on demand: at once while a
 * search is active, else while the page is idle (not on Save-Data), and
 * at once when a finger lands on the search button (`warm`).
 * `undefined` while loading; `null` when search is unavailable (a stale or
 * missing index) — the shop then simply has no search.
 */
export function useShopSearch(active: boolean) {
  const [runtime, setRuntime] = useState<SearchRuntime | null | undefined>(undefined);
  const warm = useCallback(() => void load().then(setRuntime), []);
  useEffect(() => {
    if (active) return warm();
    if (saveData()) return;
    return whenIdle(warm);
  }, [active, warm]);
  return { runtime, warm };
}
