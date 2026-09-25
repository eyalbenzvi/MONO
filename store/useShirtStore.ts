"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CALIBRATION_SIZE, getCalibrationQueue, matchScore, updateUserVector } from "@/lib/recommendation";
import { DECK_SIZE, buildDeck as dealDeck, calibrationDone, type DeckEntry } from "@/lib/deck";
import { addItem, cartTotals, changeItem, setItemQty } from "@/lib/cart";
import { FAMILY_LEADERS, getShirtById } from "@/lib/catalog";
import {
  COLOR_LABELS,
  createInitialVector,
  type BaseColor,
  type CartItem,
  type Order,
  type RecommendationStrategy,
  type ShirtSize,
  type SwipeAction,
  type SwipeEvent,
  type UserProfileVector,
  type UserSession,
} from "@/types/shirt";

export { DECK_SIZE, type DeckEntry };

/**
 * The calibration set comes from getCalibrationQueue (unchanged); only the
 * *display order* is tweaked so the very first card is the boldest print
 * (highest contrast + density) — a stronger opener than a faint sketch.
 */
export const CALIBRATION_IDS = (() => {
  // One representative per design family, so the taste test never shows two
  // variations of the same print, and it probes every category once.
  const queue = getCalibrationQueue(FAMILY_LEADERS, CALIBRATION_SIZE, (s) => s.category);
  const boldness = (s: (typeof queue)[number]) => s.features.contrast + s.features.density;
  const opener = queue.reduce((best, s) => (boldness(s) > boldness(best) ? s : best), queue[0]);
  return [opener, ...queue.filter((s) => s !== opener)].map((s) => s.id);
})();
export const CALIBRATION_TOTAL = CALIBRATION_IDS.length;


export interface LastUpdate {
  shirtId: string;
  action: SwipeAction;
  before: UserProfileVector;
  after: UserProfileVector;
}

interface PersistedState extends UserSession {
  deck: DeckEntry[];
  selectedSizes: Record<string, ShirtSize>;
  /** Tee colour picked per design; missing = the design's original colour. */
  selectedColors: Record<string, BaseColor>;
  lastUpdate: LastUpdate | null;
  cart: CartItem[];
  lastOrder: Order | null;
  /** The "taste profile ready" screen has been shown. */
  calibrationAcknowledged: boolean;
  /** First-run coach marks dismissed (first swipe or tap). */
  onboardingSeen: boolean;
}

export interface ToastState {
  message: string;
  nonce: number;
  action?: { label: string; run: () => void };
}

interface ShirtState extends PersistedState {
  /** UI-only (not persisted) */
  hydrated: boolean;
  isFlipped: boolean;
  /**
   * Button/keyboard swipes waiting to run. Rapid taps queue up (max 5) and
   * play one after another instead of being dropped mid-animation.
   */
  swipeQueue: { action: SwipeAction; nonce: number }[];
  /** Set by undoLast so the restored card flies back in from where it left. */
  undoFx: { id: string; action: SwipeAction; nonce: number } | null;
  toast: ToastState | null;

  fillDeck: () => void;
  requestSwipe: (action: SwipeAction) => void;
  /** `fromQueue` = this commit consumed the head of swipeQueue. */
  commitSwipe: (shirtId: string, action: SwipeAction, fromQueue?: boolean) => void;
  /** One-level undo of the last Discover swipe (vector, lists, deck). */
  undoLast: () => void;
  toggleFlip: (value?: boolean) => void;
  /** Heart in the shop / drawer: save (a "like" that also trains) or unsave. */
  toggleSaved: (id: string) => void;
  removeLiked: (id: string) => void;
  /** Put a removed tee back in Saved without training on it again. */
  restoreSaved: (id: string) => void;
  setSize: (id: string, size: ShirtSize) => void;
  setColor: (id: string, color: BaseColor) => void;
  /** Adds in the given colour, else the one picked for this design, else its original. */
  addToCart: (id: string, size: ShirtSize, color?: BaseColor, qty?: number) => void;
  setCartQty: (line: Pick<CartItem, "id" | "size" | "color">, qty: number) => void;
  changeCartItem: (line: Pick<CartItem, "id" | "size" | "color">, to: Partial<Pick<CartItem, "size" | "color">>) => void;
  placeOrder: (customer: { name: string; email: string }) => Order | null;
  acknowledgeCalibration: () => void;
  showToast: (message: string, action?: ToastState["action"]) => void;
  dismissOnboarding: () => void;
  reset: () => void;
  setHydrated: () => void;
}

/** Deal the deck: calibration first, never two designs of one family (lib/deck). */
const buildDeck = (deck: DeckEntry[], vector: UserProfileVector, history: string[]) =>
  dealDeck(deck, vector, history, CALIBRATION_IDS);

const seenIds = (history: SwipeEvent[]) => history.map((h) => h.shirtId);

const initialPersisted = (): PersistedState => ({
  likedIds: [],
  dislikedIds: [],
  preferenceVector: createInitialVector(),
  swipeHistory: [],
  deck: buildDeck([], createInitialVector(), []),
  selectedSizes: {},
  selectedColors: {},
  lastUpdate: null,
  cart: [],
  lastOrder: null,
  calibrationAcknowledged: false,
  onboardingSeen: false,
});

/** The last swipe can be undone only if it came from Discover and nothing trained since. */
export const canUndo = (s: Pick<UserSession, "swipeHistory"> & { lastUpdate: LastUpdate | null }) => {
  const last = s.swipeHistory[s.swipeHistory.length - 1];
  return !!last && last.source !== "shop" && !!s.lastUpdate && s.lastUpdate.shirtId === last.shirtId;
};

export const useShirtStore = create<ShirtState>()(
  persist(
    (set, get) => ({
      ...initialPersisted(),
      hydrated: false,
      isFlipped: false,
      swipeQueue: [],
      undoFx: null,
      toast: null,

      fillDeck: () => {
        const { deck, preferenceVector, swipeHistory } = get();
        set({ deck: buildDeck(deck, preferenceVector, seenIds(swipeHistory)) });
      },

      requestSwipe: (action) => {
        const { deck, swipeQueue } = get();
        if (deck.length === 0 || swipeQueue.length >= 5) return;
        set({ swipeQueue: [...swipeQueue, { action, nonce: Date.now() + Math.random() }] });
      },

      commitSwipe: (shirtId, action, fromQueue = false) => {
        const state = get();
        const top = state.deck[0];
        const shirt = getShirtById(shirtId);
        // Guard against duplicate commits (e.g. a button press racing a drag).
        if (!top || top.id !== shirtId || !shirt) return;

        const before = state.preferenceVector;
        const after = updateUserVector(before, shirt.features, action);
        const swipeHistory: SwipeEvent[] = [
          ...state.swipeHistory,
          {
            shirtId,
            action,
            source: "swipe",
            matchScore: matchScore(before, shirt.features),
            strategy: top.strategy,
            timestamp: Date.now(),
          },
        ];

        // Keep the card that is already visible underneath; re-rank everything
        // behind it with the freshly updated vector.
        const deck = buildDeck(state.deck.slice(1, 2), after, seenIds(swipeHistory));

        set({
          preferenceVector: after,
          swipeHistory,
          likedIds: action === "like" ? [...state.likedIds, shirtId] : state.likedIds,
          dislikedIds: action === "dislike" ? [...state.dislikedIds, shirtId] : state.dislikedIds,
          deck,
          lastUpdate: { shirtId, action, before, after },
          isFlipped: false,
          swipeQueue: fromQueue ? state.swipeQueue.slice(1) : state.swipeQueue,
          onboardingSeen: true,
          undoFx: null,
        });
      },

      undoLast: () => {
        const state = get();
        if (!canUndo(state) || !state.lastUpdate) return;
        const last = state.swipeHistory[state.swipeHistory.length - 1];
        const dropLast = (ids: string[]) => {
          const i = ids.lastIndexOf(last.shirtId);
          return i === -1 ? ids : [...ids.slice(0, i), ...ids.slice(i + 1)];
        };
        const swipeHistory = state.swipeHistory.slice(0, -1);
        const restored: DeckEntry = { id: last.shirtId, strategy: last.strategy };
        set({
          preferenceVector: state.lastUpdate.before,
          swipeHistory,
          likedIds: last.action === "like" ? dropLast(state.likedIds) : state.likedIds,
          dislikedIds: last.action === "dislike" ? dropLast(state.dislikedIds) : state.dislikedIds,
          deck: [restored, ...state.deck.filter((e) => e.id !== restored.id)].slice(0, DECK_SIZE),
          lastUpdate: null,
          isFlipped: false,
          swipeQueue: [],
          undoFx: { id: last.shirtId, action: last.action, nonce: Date.now() },
        });
      },

      toggleFlip: (value) => set((s) => ({ isFlipped: value ?? !s.isFlipped, onboardingSeen: true })),

      dismissOnboarding: () => set({ onboardingSeen: true }),

      toggleSaved: (id) => {
        const state = get();
        const shirt = getShirtById(id);
        if (!shirt) return;
        if (state.likedIds.includes(id)) {
          set({ likedIds: state.likedIds.filter((x) => x !== id) });
          return;
        }
        // Saving from the shop is an explicit like: train on it, and mark it
        // seen so Discover doesn't serve it again.
        const alreadySeen = state.swipeHistory.some((h) => h.shirtId === id);
        const before = state.preferenceVector;
        const after = updateUserVector(before, shirt.features, "like");
        const swipeHistory: SwipeEvent[] = alreadySeen
          ? state.swipeHistory
          : [
              ...state.swipeHistory,
              {
                shirtId: id,
                action: "like",
                source: "shop",
                matchScore: matchScore(before, shirt.features),
                strategy: "greedy",
                timestamp: Date.now(),
              },
            ];
        const topStays = state.deck[0] && state.deck[0].id !== id ? [state.deck[0]] : [];
        set({
          likedIds: [...state.likedIds, id],
          dislikedIds: state.dislikedIds.filter((x) => x !== id),
          preferenceVector: after,
          swipeHistory,
          lastUpdate: { shirtId: id, action: "like", before, after },
          deck: buildDeck(topStays, after, seenIds(swipeHistory)),
          isFlipped: topStays.length ? state.isFlipped : false,
        });
      },

      removeLiked: (id) => set((s) => ({ likedIds: s.likedIds.filter((x) => x !== id) })),

      restoreSaved: (id) =>
        set((s) => (s.likedIds.includes(id) ? {} : { likedIds: [...s.likedIds, id] })),

      setSize: (id, size) => set((s) => ({ selectedSizes: { ...s.selectedSizes, [id]: size } })),

      setColor: (id, color) => set((s) => ({ selectedColors: { ...s.selectedColors, [id]: color } })),

      addToCart: (id, size, color, qty = 1) => {
        const shirt = getShirtById(id);
        if (!shirt) return;
        const tee = color ?? get().selectedColors[id] ?? shirt.baseColor;
        set((s) => ({
          cart: addItem(s.cart, { id, size, color: tee, qty }),
          selectedSizes: { ...s.selectedSizes, [id]: size },
          selectedColors: { ...s.selectedColors, [id]: tee },
        }));
        get().showToast(`${shirt.title} · ${COLOR_LABELS[tee]} · ${size} added to bag`);
      },

      setCartQty: (line, qty) => set((s) => ({ cart: setItemQty(s.cart, line, qty) })),

      changeCartItem: (line, to) => set((s) => ({ cart: changeItem(s.cart, line, to) })),

      placeOrder: ({ name, email }) => {
        const { cart } = get();
        const totals = cartTotals(cart);
        if (totals.count === 0) return null;
        const order: Order = {
          number: `MONO-${Date.now().toString(36).toUpperCase().slice(-6)}`,
          items: cart,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          total: totals.total,
          name,
          email,
          placedAt: Date.now(),
        };
        set({ lastOrder: order, cart: [] });
        return order;
      },

      acknowledgeCalibration: () => set({ calibrationAcknowledged: true }),

      showToast: (message, action) => set({ toast: { message, action, nonce: Date.now() + Math.random() } }),

      reset: () =>
        set((s) => ({
          ...initialPersisted(),
          // Keep the bag and the last order — resetting taste shouldn't empty a basket.
          cart: s.cart,
          lastOrder: s.lastOrder,
          isFlipped: false,
          swipeQueue: [],
          undoFx: null,
        })),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "mono-session-v1",
      version: 6,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // v3 replaced the 25-shirt catalog with the generated 1,000: every stored
      // id (likes, deck, bag, history) points at a shirt that no longer exists,
      // so older sessions start fresh. v2 only added fields to v1.
      // v4 made tee colour a purchase choice: existing bag lines and orders
      // get their design's original colour.
      migrate: (persisted, version) => {
        if (version < 3) return initialPersisted();
        const state = persisted as PersistedState;
        // v5 added feature dimensions (pictorial, wit, retro, nature), v6 added
        // figurative and classic: extend stored vectors with neutral 0.5
        // instead of resetting the user's taste.
        const extend = (v: UserProfileVector | undefined) => ({ ...createInitialVector(), ...(v ?? {}) });
        const withColor = (items: CartItem[] = []) =>
          items.flatMap((i) => {
            const shirt = getShirtById(i.id);
            return shirt ? [{ ...i, color: i.color ?? shirt.baseColor }] : [];
          });
        return {
          ...state,
          preferenceVector: extend(state.preferenceVector),
          lastUpdate: state.lastUpdate
            ? { ...state.lastUpdate, before: extend(state.lastUpdate.before), after: extend(state.lastUpdate.after) }
            : null,
          selectedColors: state.selectedColors ?? {},
          cart: withColor(state.cart),
          lastOrder: state.lastOrder ? { ...state.lastOrder, items: withColor(state.lastOrder.items) } : null,
        };
      },
      partialize: (s): PersistedState => ({
        likedIds: s.likedIds,
        dislikedIds: s.dislikedIds,
        preferenceVector: s.preferenceVector,
        swipeHistory: s.swipeHistory,
        deck: s.deck,
        selectedSizes: s.selectedSizes,
        selectedColors: s.selectedColors,
        lastUpdate: s.lastUpdate,
        cart: s.cart,
        lastOrder: s.lastOrder,
        calibrationAcknowledged: s.calibrationAcknowledged,
        onboardingSeen: s.onboardingSeen,
      }),
    },
  ),
);

/** How many calibration prints the user has already seen (any source). */
export function useCalibrationProgress() {
  // Counted per family: saving a sibling of a calibration print in the shop
  // also counts. Selects a primitive so the result is referentially stable.
  const done = useShirtStore((s) => calibrationDone(CALIBRATION_IDS, s.swipeHistory.map((h) => h.shirtId)));
  return { done, total: CALIBRATION_TOTAL, complete: done >= CALIBRATION_TOTAL };
}

export const useCartCount = () =>
  useShirtStore((s) => s.cart.reduce((sum, i) => sum + i.qty, 0));
