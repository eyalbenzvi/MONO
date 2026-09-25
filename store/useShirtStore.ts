"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CALIBRATION_SIZE,
  getCalibrationQueue,
  getNextCard,
  matchScore,
  updateUserVector,
} from "@/lib/recommendation";
import { addItem, cartTotals, changeItemSize, setItemQty } from "@/lib/cart";
import { MOCK_SHIRTS, getShirtById } from "@/lib/mockData";
import {
  createInitialVector,
  type CartItem,
  type Order,
  type RecommendationStrategy,
  type ShirtSize,
  type SwipeAction,
  type SwipeEvent,
  type UserProfileVector,
  type UserSession,
} from "@/types/shirt";

export const DECK_SIZE = 3;

export const CALIBRATION_IDS = getCalibrationQueue(MOCK_SHIRTS, CALIBRATION_SIZE).map((s) => s.id);
export const CALIBRATION_TOTAL = CALIBRATION_IDS.length;

export interface DeckEntry {
  id: string;
  strategy: RecommendationStrategy;
}

export interface LastUpdate {
  shirtId: string;
  action: SwipeAction;
  before: UserProfileVector;
  after: UserProfileVector;
}

interface PersistedState extends UserSession {
  deck: DeckEntry[];
  selectedSizes: Record<string, ShirtSize>;
  lastUpdate: LastUpdate | null;
  cart: CartItem[];
  lastOrder: Order | null;
  /** The "taste profile ready" screen has been shown. */
  calibrationAcknowledged: boolean;
}

interface ShirtState extends PersistedState {
  /** UI-only (not persisted) */
  hydrated: boolean;
  isFlipped: boolean;
  swipeRequest: { action: SwipeAction; nonce: number } | null;
  toast: { message: string; nonce: number } | null;

  fillDeck: () => void;
  requestSwipe: (action: SwipeAction) => void;
  commitSwipe: (shirtId: string, action: SwipeAction) => void;
  toggleFlip: (value?: boolean) => void;
  /** Heart in the shop / drawer: save (a "like" that also trains) or unsave. */
  toggleSaved: (id: string) => void;
  removeLiked: (id: string) => void;
  setSize: (id: string, size: ShirtSize) => void;
  addToCart: (id: string, size: ShirtSize, qty?: number) => void;
  setCartQty: (id: string, size: ShirtSize, qty: number) => void;
  changeCartSize: (id: string, from: ShirtSize, to: ShirtSize) => void;
  placeOrder: (customer: { name: string; email: string }) => Order | null;
  acknowledgeCalibration: () => void;
  showToast: (message: string) => void;
  reset: () => void;
  setHydrated: () => void;
}

/** Draws cards until the deck is full: calibration set first, then the engine. */
function buildDeck(deck: DeckEntry[], vector: UserProfileVector, seenIds: string[]): DeckEntry[] {
  const seen = new Set(seenIds);
  const next = deck.filter((e) => getShirtById(e.id) && !seen.has(e.id));
  next.forEach((e) => seen.add(e.id));
  while (next.length < DECK_SIZE) {
    const calibrationId = CALIBRATION_IDS.find((id) => !seen.has(id));
    if (calibrationId) {
      next.push({ id: calibrationId, strategy: "calibration" });
      seen.add(calibrationId);
      continue;
    }
    const pick = getNextCard(vector, MOCK_SHIRTS, seen);
    if (!pick) break;
    next.push({ id: pick.shirt.id, strategy: pick.strategy });
    seen.add(pick.shirt.id);
  }
  return next;
}

const seenIds = (history: SwipeEvent[]) => history.map((h) => h.shirtId);

const initialPersisted = (): PersistedState => ({
  likedIds: [],
  dislikedIds: [],
  preferenceVector: createInitialVector(),
  swipeHistory: [],
  deck: buildDeck([], createInitialVector(), []),
  selectedSizes: {},
  lastUpdate: null,
  cart: [],
  lastOrder: null,
  calibrationAcknowledged: false,
});

export const useShirtStore = create<ShirtState>()(
  persist(
    (set, get) => ({
      ...initialPersisted(),
      hydrated: false,
      isFlipped: false,
      swipeRequest: null,
      toast: null,

      fillDeck: () => {
        const { deck, preferenceVector, swipeHistory } = get();
        set({ deck: buildDeck(deck, preferenceVector, seenIds(swipeHistory)) });
      },

      requestSwipe: (action) => {
        if (get().deck.length === 0) return;
        set({ swipeRequest: { action, nonce: Date.now() + Math.random() } });
      },

      commitSwipe: (shirtId, action) => {
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
          swipeRequest: null,
        });
      },

      toggleFlip: (value) => set((s) => ({ isFlipped: value ?? !s.isFlipped })),

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

      setSize: (id, size) => set((s) => ({ selectedSizes: { ...s.selectedSizes, [id]: size } })),

      addToCart: (id, size, qty = 1) => {
        const shirt = getShirtById(id);
        if (!shirt) return;
        set((s) => ({
          cart: addItem(s.cart, { id, size, qty }),
          selectedSizes: { ...s.selectedSizes, [id]: size },
        }));
        get().showToast(`${shirt.title} · ${size} added to bag`);
      },

      setCartQty: (id, size, qty) => set((s) => ({ cart: setItemQty(s.cart, id, size, qty) })),

      changeCartSize: (id, from, to) => set((s) => ({ cart: changeItemSize(s.cart, id, from, to) })),

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

      showToast: (message) => set({ toast: { message, nonce: Date.now() + Math.random() } }),

      reset: () =>
        set((s) => ({
          ...initialPersisted(),
          // Keep the bag and the last order — resetting taste shouldn't empty a basket.
          cart: s.cart,
          lastOrder: s.lastOrder,
          isFlipped: false,
          swipeRequest: null,
        })),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "mono-session-v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // v1 → v2 only added fields (defaults come from the initial state) and
      // dropped nothing we still read, so the old state carries over as-is.
      migrate: (persisted) => persisted as PersistedState,
      partialize: (s): PersistedState => ({
        likedIds: s.likedIds,
        dislikedIds: s.dislikedIds,
        preferenceVector: s.preferenceVector,
        swipeHistory: s.swipeHistory,
        deck: s.deck,
        selectedSizes: s.selectedSizes,
        lastUpdate: s.lastUpdate,
        cart: s.cart,
        lastOrder: s.lastOrder,
        calibrationAcknowledged: s.calibrationAcknowledged,
      }),
    },
  ),
);

/** How many calibration prints the user has already seen (any source). */
export function useCalibrationProgress() {
  // Select a primitive so the selector result is referentially stable.
  const done = useShirtStore((s) => {
    const seen = new Set(s.swipeHistory.map((h) => h.shirtId));
    return CALIBRATION_IDS.filter((id) => seen.has(id)).length;
  });
  return { done, total: CALIBRATION_TOTAL, complete: done >= CALIBRATION_TOTAL };
}

export const useCartCount = () =>
  useShirtStore((s) => s.cart.reduce((sum, i) => sum + i.qty, 0));
