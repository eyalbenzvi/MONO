"use client";

import type { UIEvent } from "react";
import { create } from "zustand";
import type { ShopSort } from "@/lib/recommendation";
import type { BaseColor, ShirtCategory } from "@/types/shirt";

/**
 * In-memory UI state that should survive client-side navigation but not a
 * reload: shop filters + scroll position (so "back" lands where you were),
 * header visibility, and the hidden debug switch.
 */
interface UiState {
  debug: boolean;
  headerHidden: boolean;
  shop: {
    category: ShirtCategory | null;
    sort: ShopSort;
    teeView: BaseColor | "original";
    limit: number;
    scrollTop: number;
  };
  /** A product page was opened from the shop grid (so "← Shop" can go back). */
  cameFromShop: boolean;

  setDebug: (on: boolean) => void;
  setHeaderHidden: (hidden: boolean) => void;
  setShop: (patch: Partial<UiState["shop"]>) => void;
  setCameFromShop: (v: boolean) => void;
}

export const SHOP_PAGE_SIZE = 24;

export const useUiStore = create<UiState>()((set) => ({
  debug: false,
  headerHidden: false,
  shop: { category: null, sort: "match", teeView: "original", limit: SHOP_PAGE_SIZE, scrollTop: 0 },
  cameFromShop: false,

  setDebug: (on) => {
    try {
      if (on) sessionStorage.setItem("mono-debug", "1");
      else sessionStorage.removeItem("mono-debug");
    } catch {
      /* storage unavailable — keep it in memory only */
    }
    set({ debug: on });
  },
  setHeaderHidden: (headerHidden) => set({ headerHidden }),
  setShop: (patch) => set((s) => ({ shop: { ...s.shop, ...patch } })),
  setCameFromShop: (cameFromShop) => set({ cameFromShop }),
}));

/** Scroll handler for page scrollers: hide the header scrolling down, show it scrolling up. */
export function makeHeaderScrollHandler() {
  let last: number | null = null;
  return (e: UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    if (last === null) {
      last = y; // first event after mount (e.g. a restored position) only sets the baseline
      return;
    }
    const { headerHidden, setHeaderHidden } = useUiStore.getState();
    if (y > last + 8 && y > 80 && !headerHidden) setHeaderHidden(true);
    else if ((y < last - 8 || y < 40) && headerHidden) setHeaderHidden(false);
    last = y;
  };
}
