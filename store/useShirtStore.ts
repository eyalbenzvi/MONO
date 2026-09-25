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
import { MOCK_SHIRTS, getShirtById } from "@/lib/mockData";
import {
  createInitialVector,
  type RecommendationStrategy,
  type ShirtSize,
  type SwipeAction,
  type UserProfileVector,
  type UserSession,
} from "@/types/shirt";

export const DECK_SIZE = 3;

const CALIBRATION_IDS = getCalibrationQueue(MOCK_SHIRTS, CALIBRATION_SIZE).map((s) => s.id);

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

interface ShirtState extends UserSession {
  deck: DeckEntry[];
  selectedSizes: Record<string, ShirtSize>;
  lastUpdate: LastUpdate | null;
  /** UI-only (not persisted) */
  hydrated: boolean;
  isFlipped: boolean;
  swipeRequest: { action: SwipeAction; nonce: number } | null;

  fillDeck: () => void;
  requestSwipe: (action: SwipeAction) => void;
  commitSwipe: (shirtId: string, action: SwipeAction) => void;
  toggleFlip: (value?: boolean) => void;
  removeLiked: (id: string) => void;
  setSize: (id: string, size: ShirtSize) => void;
  reset: () => void;
  setHydrated: () => void;
}

/** Draws cards until the deck is full: calibration set first, then the engine. */
function buildDeck(
  deck: DeckEntry[],
  vector: UserProfileVector,
  swipedIds: string[],
): DeckEntry[] {
  const next = deck.filter((e) => getShirtById(e.id));
  const seen = new Set([...swipedIds, ...next.map((e) => e.id)]);
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

const initialSession = (): UserSession & Pick<ShirtState, "deck" | "selectedSizes" | "lastUpdate"> => ({
  likedIds: [],
  dislikedIds: [],
  preferenceVector: createInitialVector(),
  swipeHistory: [],
  deck: buildDeck([], createInitialVector(), []),
  selectedSizes: {},
  lastUpdate: null,
});

export const useShirtStore = create<ShirtState>()(
  persist(
    (set, get) => ({
      ...initialSession(),
      hydrated: false,
      isFlipped: false,
      swipeRequest: null,

      fillDeck: () => {
        const { deck, preferenceVector, swipeHistory } = get();
        set({ deck: buildDeck(deck, preferenceVector, swipeHistory.map((h) => h.shirtId)) });
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
        const swipeHistory = [
          ...state.swipeHistory,
          {
            shirtId,
            action,
            matchScore: matchScore(before, shirt.features),
            strategy: top.strategy,
            timestamp: Date.now(),
          },
        ];

        // Keep the card that is already visible underneath; re-rank everything
        // behind it with the freshly updated vector.
        const kept = state.deck.slice(1, 2);
        const deck = buildDeck(kept, after, swipeHistory.map((h) => h.shirtId));

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

      removeLiked: (id) => set((s) => ({ likedIds: s.likedIds.filter((x) => x !== id) })),

      setSize: (id, size) => set((s) => ({ selectedSizes: { ...s.selectedSizes, [id]: size } })),

      reset: () => set({ ...initialSession(), isFlipped: false, swipeRequest: null }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "mono-session-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        likedIds: s.likedIds,
        dislikedIds: s.dislikedIds,
        preferenceVector: s.preferenceVector,
        swipeHistory: s.swipeHistory,
        deck: s.deck,
        selectedSizes: s.selectedSizes,
        lastUpdate: s.lastUpdate,
      }),
    },
  ),
);

export const CALIBRATION_TOTAL = CALIBRATION_IDS.length;
