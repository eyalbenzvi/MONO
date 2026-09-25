"use client";

import type { UIEvent } from "react";
import { create } from "zustand";
import type { ShopSort } from "@/lib/recommendation";
import type { BaseColor, ShirtCategory, SwipeAction } from "@/types/shirt";

export interface ToastState {
  message: string;
  nonce: number;
  action?: { label: string; run: () => void };
}

/**
 * In-memory UI state that should survive client-side navigation but not a
 * reload: the Discover card's transient state (flip, queued swipes, undo
 * animation, zoom), the toast, shop filters (so "back" lands where you
 * were), header visibility, and the hidden debug switch. Nothing here is
 * persisted — taste lives in tasteStore, the bag in cartStore.
 */
interface UiState {
  /** Both persisted stores have loaded from localStorage. */
  hydrated: boolean;
  /** The Discover card shows its details face. */
  isFlipped: boolean;
  /**
   * Button/keyboard swipes waiting to run. Rapid taps queue up (max 5) and
   * play one after another instead of being dropped mid-animation.
   */
  swipeQueue: { action: SwipeAction; nonce: number }[];
  /** Set by undo so the restored card flies back in from where it left. */
  undoFx: { id: string; action: SwipeAction; nonce: number } | null;
  toast: ToastState | null;
  /** The design shown in the full-screen zoom, if open. */
  zoomId: string | null;

  debug: boolean;
  headerHidden: boolean;
  shop: {
    category: ShirtCategory | null;
    sort: ShopSort;
    teeView: BaseColor | "original";
    limit: number;
  };
  /**
   * Where the current product page was opened from, when "← Shop" may simply
   * go back in history (restoring filters + scroll): "/shop/" when opened from
   * the grid. Cleared when a product is opened from anywhere else (similar
   * prints) and when leaving the shop, so Back never lands somewhere odd.
   */
  productOrigin: string | null;
  /** The tee the share sheet is open for (and in which colourway). */
  share: { id: string; color: BaseColor } | null;

  setHydrated: () => void;
  toggleFlip: (value?: boolean) => void;
  showToast: (message: string, action?: ToastState["action"]) => void;
  setZoom: (id: string | null) => void;
  setDebug: (on: boolean) => void;
  setHeaderHidden: (hidden: boolean) => void;
  setShop: (patch: Partial<UiState["shop"]>) => void;
  setProductOrigin: (path: string | null) => void;
  openShare: (id: string, color: BaseColor) => void;
  closeShare: () => void;
}

export const SHOP_PAGE_SIZE = 24;

/**
 * The shop grid's scroll position, kept outside React state on purpose: it
 * changes on every scroll event and nothing needs to re-render for it —
 * it's only read to restore the position when coming back to the grid.
 */
export const shopScroll = { top: 0 };

export const useUiStore = create<UiState>()((set) => ({
  hydrated: false,
  isFlipped: false,
  swipeQueue: [],
  undoFx: null,
  toast: null,
  zoomId: null,
  setHydrated: () => set({ hydrated: true }),
  toggleFlip: (value) => set((s) => ({ isFlipped: value ?? !s.isFlipped })),
  showToast: (message, action) => set({ toast: { message, action, nonce: Date.now() + Math.random() } }),
  setZoom: (zoomId) => set({ zoomId }),
  debug: false,
  headerHidden: false,
  shop: { category: null, sort: "match", teeView: "original", limit: SHOP_PAGE_SIZE },
  productOrigin: null,
  share: null,

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
  setProductOrigin: (productOrigin) => set({ productOrigin }),
  openShare: (id, color) => set({ share: { id, color } }),
  closeShare: () => set({ share: null }),
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

export const useHydrated = () => useUiStore((s) => s.hydrated);
