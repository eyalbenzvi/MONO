"use client";

import type { UIEvent } from "react";
import { create } from "zustand";
import type { ShopSort } from "@/lib/recommendation";
import type { BaseColor, ShirtCategory, ShirtSize, SwipeAction, UserProfileVector } from "@/types/shirt";

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
  /** Open dialogs (zoom, share, sheets, the taste-test screen): while any is, the page's shortcuts stand down. */
  dialogs: number;
  /** The design shown in the full-screen zoom, if open. */
  zoomId: string | null;

  debug: boolean;
  headerHidden: boolean;
  shop: {
    category: ShirtCategory | null;
    /** Chosen order; null = the default ("For you" after the taste test, else "Popular"). */
    sort: ShopSort | null;
    teeView: BaseColor | "original";
    limit: number;
  };
  /**
   * Where a product page was opened from, when "← Shop" may simply go back in
   * history (restoring filters + scroll): the grid ("/shop/") and the product
   * it opened. Back is used only while that product is the one on screen —
   * after moving on to another (from Saved, the mini bag, similar prints)
   * history holds the previous product, so "← Shop" goes to the shop.
   * Cleared when leaving the shop.
   */
  productOrigin: ProductOrigin | null;
  /** The tee the share sheet is open for (and in which colourway). */
  share: { id: string; color: BaseColor } | null;
  /** The last add to the bag (drives the mini bag confirmation). */
  added: AddedNote | null;
  /** A friend's taste from a shared /?taste= link (this session), to compare with. */
  friendTaste: UserProfileVector | null;

  setHydrated: () => void;
  toggleFlip: (value?: boolean) => void;
  showToast: (message: string, action?: ToastState["action"]) => void;
  setZoom: (id: string | null) => void;
  setDebug: (on: boolean) => void;
  setHeaderHidden: (hidden: boolean) => void;
  setShop: (patch: Partial<UiState["shop"]>) => void;
  setProductOrigin: (origin: ProductOrigin | null) => void;
  openShare: (id: string, color: BaseColor) => void;
  closeShare: () => void;
  noteAdded: (note: Omit<AddedNote, "nonce">) => void;
  clearAdded: () => void;
}

export interface ProductOrigin {
  from: "/shop/";
  id: string;
}

export interface AddedNote {
  id: string;
  size: ShirtSize;
  /** The tee colour shown in the confirmation. */
  color: BaseColor;
  /** The bag lines that got one more (Undo takes exactly these back). */
  added: BaseColor[];
  /** Added as (or completing) the black + white pair. */
  pair?: boolean;
  nonce: number;
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
  dialogs: 0,
  zoomId: null,
  setHydrated: () => set({ hydrated: true }),
  toggleFlip: (value) => set((s) => ({ isFlipped: value ?? !s.isFlipped })),
  showToast: (message, action) => set({ toast: { message, action, nonce: Date.now() + Math.random() } }),
  setZoom: (zoomId) => set({ zoomId }),
  debug: false,
  headerHidden: false,
  shop: { category: null, sort: null, teeView: "original", limit: SHOP_PAGE_SIZE },
  productOrigin: null,
  share: null,
  added: null,
  friendTaste: null,

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
  noteAdded: (note) => set({ added: { ...note, nonce: Date.now() + Math.random() } }),
  clearAdded: () => set({ added: null }),
}));

/** Count a dialog as open; the returned function closes it (once). */
export function openDialog() {
  useUiStore.setState((s) => ({ dialogs: s.dialogs + 1 }));
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    useUiStore.setState((s) => ({ dialogs: Math.max(0, s.dialogs - 1) }));
  };
}

/** Until this time, scroll events come from code (scrollIntoView), not the user. */
let programmaticUntil = 0;

/**
 * Scroll an element into view without it counting as the user scrolling
 * down (which would hide the header). E.g. "Choose size" jumping to sizes.
 */
export function scrollIntoViewQuietly(el: Element | null | undefined, options: ScrollIntoViewOptions = { behavior: "smooth", block: "center" }) {
  if (!el) return;
  programmaticUntil = Date.now() + 900;
  useUiStore.getState().setHeaderHidden(false);
  el.scrollIntoView(options);
}

/** Downward travel (px, one direction) before the header slides away… */
const HIDE_AFTER = 48;
/** …upward travel before it comes back… */
const SHOW_AFTER = 24;
/** …and a pause while it animates, so momentum jitter can't flip it back. */
const SETTLE_MS = 220;

/**
 * Scroll handler for page scrollers: the header slides away after a real
 * scroll down, and returns after a short scroll up or near the top. Travel
 * is summed per direction (hysteresis), so small reversals and fling
 * slow-downs don't toggle it.
 */
export function makeHeaderScrollHandler() {
  let last: number | null = null;
  let travel = 0;
  let settleUntil = 0;
  return (e: UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    const now = Date.now();
    if (last === null || now < programmaticUntil) {
      // First event after mount (e.g. a restored position), or a scroll we
      // started ourselves: only move the baseline.
      last = y;
      travel = 0;
      return;
    }
    const dy = y - last;
    last = y;
    if (dy === 0 || now < settleUntil) return;
    travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
    const { headerHidden, setHeaderHidden } = useUiStore.getState();
    if (!headerHidden && travel > HIDE_AFTER && y > 120) {
      setHeaderHidden(true);
      settleUntil = now + SETTLE_MS;
      travel = 0;
    } else if (headerHidden && (travel < -SHOW_AFTER || y < 40)) {
      setHeaderHidden(false);
      settleUntil = now + SETTLE_MS;
      travel = 0;
    }
  };
}

export const useHydrated = () => useUiStore((s) => s.hydrated);
