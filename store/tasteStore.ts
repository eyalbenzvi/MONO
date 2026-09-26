"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { matchScore, updateUserVector } from "@/lib/recommendation";
import { CALIBRATION_IDS, CALIBRATION_TOTAL, DECK_SIZE, buildDeck as dealDeck, calibrationDone, type DeckEntry } from "@/lib/deck";
import { getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { useUiStore } from "@/store/useUiStore";
import { FEATURE_KEYS, createInitialVector, type RecommendationStrategy, type SwipeAction, type SwipeEvent, type UserProfileVector } from "@/types/shirt";
import { TASTE_LEVELS, countSwipe, emptyDaily, tasteLevel, type Daily, type TasteLevel } from "@/lib/taste";

export { DECK_SIZE, type DeckEntry };

export const TASTE_KEY = "mono-taste";
/** Swipe events kept for Undo, stats and the debug panel (`seen` keeps every id). */
export const HISTORY_LIMIT = 500;

export interface LastUpdate {
  shirtId: string;
  action: SwipeAction;
  before: UserProfileVector;
  after: UserProfileVector;
  /** The Daily 5 before this swipe (Undo puts it back). */
  daily?: Daily;
}

/** Everything about the user's taste that survives a reload. */
export interface TasteState {
  likedIds: string[];
  dislikedIds: string[];
  preferenceVector: UserProfileVector;
  /** The most recent HISTORY_LIMIT swipe / save events, oldest first. */
  swipeHistory: SwipeEvent[];
  /** Every design ever swiped or saved, in order: the deck never deals their families again. */
  seen: string[];
  deck: DeckEntry[];
  lastUpdate: LastUpdate | null;
  /** The "taste profile ready" screen has been shown. */
  calibrationAcknowledged: boolean;
  /** First-run coach marks dismissed (after the first swipe). */
  onboardingSeen: boolean;
  /** "Daily 5": new tees swiped today (after the taste test), and the streak of days that reached five. */
  daily: Daily;
  /** Taste levels already reached (announced once, never again after an undo). */
  milestones: TasteLevel[];
}

interface TasteActions {
  fillDeck: () => void;
  requestSwipe: (action: SwipeAction) => void;
  /** `fromQueue` = this commit consumed the head of the UI swipe queue. */
  commitSwipe: (shirtId: string, action: SwipeAction, fromQueue?: boolean) => void;
  /** One-level undo of the last Discover swipe (vector, lists, deck). */
  undoLast: () => void;
  /** Heart in the shop / drawer: save (a "like" that also trains) or unsave. */
  toggleSaved: (id: string) => void;
  removeLiked: (id: string) => void;
  /** Put a removed tee back in Saved without training on it again. */
  /** Put a removed id back (at its old position in likedIds, when given). */
  restoreSaved: (id: string, at?: number) => void;
  acknowledgeCalibration: () => void;
  reset: () => void;
  /** The persisted part of the state (e.g. to undo a reset). */
  snapshot: () => TasteState;
  restore: (snap: TasteState) => void;
}

const buildDeck = (deck: DeckEntry[], vector: UserProfileVector, seen: string[]) => dealDeck(deck, vector, seen, CALIBRATION_IDS);

export const initialTaste = (): TasteState => ({
  likedIds: [],
  dislikedIds: [],
  preferenceVector: createInitialVector(),
  swipeHistory: [],
  seen: [],
  deck: buildDeck([], createInitialVector(), []),
  lastUpdate: null,
  calibrationAcknowledged: false,
  onboardingSeen: false,
  daily: emptyDaily(),
  milestones: [],
});

export const tasteOf = (s: TasteState): TasteState => ({
  likedIds: s.likedIds,
  dislikedIds: s.dislikedIds,
  preferenceVector: s.preferenceVector,
  swipeHistory: s.swipeHistory,
  seen: s.seen,
  deck: s.deck,
  lastUpdate: s.lastUpdate,
  calibrationAcknowledged: s.calibrationAcknowledged,
  onboardingSeen: s.onboardingSeen,
  daily: s.daily,
  milestones: s.milestones,
});

const pushEvent = (history: SwipeEvent[], e: SwipeEvent) => [...history, e].slice(-HISTORY_LIMIT);
const addSeen = (seen: string[], id: string) => (seen.includes(id) ? seen : [...seen, id]);

/**
 * The last swipe can be undone only if it came from Discover, nothing
 * trained since, and taking it back wouldn't reopen a taste test whose
 * result screen was already shown.
 */
export const canUndo = (s: Pick<TasteState, "swipeHistory" | "lastUpdate" | "seen" | "calibrationAcknowledged">) => {
  const last = s.swipeHistory[s.swipeHistory.length - 1];
  if (!last || last.source === "shop" || !s.lastUpdate || s.lastUpdate.shirtId !== last.shirtId) return false;
  if (!s.calibrationAcknowledged) return true;
  const without = s.seen.filter((id) => id !== last.shirtId);
  return calibrationDone(CALIBRATION_IDS, without) >= CALIBRATION_TOTAL;
};

/* ------------------------------------------------------------------ */
/* Guard for state read from localStorage (it may be hand-edited, from  */
/* an older build, or truncated): keep what is well-formed, reset the   */
/* rest to defaults.                                                    */
/* ------------------------------------------------------------------ */

const isStr = (x: unknown): x is string => typeof x === "string";
const ids = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter(isStr).filter((id) => !!getShirtById(id)))] : []);
function vectorOf(x: unknown): UserProfileVector {
  const v = createInitialVector();
  if (x && typeof x === "object")
    for (const k of FEATURE_KEYS) {
      const n = (x as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n)) v[k] = Math.min(1, Math.max(0, n));
    }
  return v;
}

const STRATEGIES: readonly RecommendationStrategy[] = ["calibration", "greedy", "explore"];
const strategyOf = (x: unknown): RecommendationStrategy => (STRATEGIES.includes(x as RecommendationStrategy) ? (x as RecommendationStrategy) : "greedy");
const num = (x: unknown, max = Infinity) => (typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0);
const isAction = (x: unknown): x is SwipeAction => x === "like" || x === "dislike";

/** A history event, field by field: anything else it carried is dropped. */
function eventOf(x: unknown): SwipeEvent | null {
  const e = x as Partial<Record<keyof SwipeEvent, unknown>> | null;
  if (!e || !isStr(e.shirtId) || !isAction(e.action) || !getShirtById(e.shirtId)) return null;
  return {
    shirtId: e.shirtId,
    action: e.action,
    source: e.source === "shop" ? "shop" : "swipe",
    matchScore: num(e.matchScore, 100),
    strategy: strategyOf(e.strategy),
    timestamp: num(e.timestamp),
  };
}

export function sanitizeTaste(raw: unknown): TasteState {
  const d = initialTaste();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<Record<keyof TasteState, unknown>>;
  const history = Array.isArray(r.swipeHistory) ? r.swipeHistory.map(eventOf).filter((e): e is SwipeEvent => !!e).slice(-HISTORY_LIMIT) : [];
  const seen = ids(r.seen);
  for (const e of history) if (!seen.includes(e.shirtId)) seen.push(e.shirtId);
  const lu = r.lastUpdate as LastUpdate | null | undefined;
  return {
    likedIds: ids(r.likedIds),
    dislikedIds: ids(r.dislikedIds),
    preferenceVector: vectorOf(r.preferenceVector),
    swipeHistory: history,
    seen,
    deck: Array.isArray(r.deck)
      ? (r.deck as Partial<DeckEntry>[]).filter((e) => e && isStr(e.id) && !!getShirtById(e.id)).map((e) => ({ id: e.id as string, strategy: strategyOf(e.strategy) }))
      : [],
    lastUpdate:
      lu && isStr(lu.shirtId) && isAction(lu.action)
        ? { shirtId: lu.shirtId, action: lu.action, before: vectorOf(lu.before), after: vectorOf(lu.after), ...(lu.daily ? { daily: dailyOf(lu.daily) } : {}) }
        : null,
    calibrationAcknowledged: r.calibrationAcknowledged === true,
    onboardingSeen: r.onboardingSeen === true,
    daily: dailyOf(r.daily),
    milestones: Array.isArray(r.milestones) ? TASTE_LEVELS.filter((l) => (r.milestones as unknown[]).includes(l)) : [],
  };
}

const isDay = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
function dailyOf(x: unknown): Daily {
  const d = x as Partial<Daily> | null | undefined;
  if (!d || !isDay(d.day)) return emptyDaily();
  const n = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  return { day: d.day, count: n(d.count), streak: n(d.streak), last: isDay(d.last) ? d.last : null };
}

/**
 * v1 → v2 adds the Daily 5 counter (starting empty); v2 → v3 adds the
 * taste levels already reached (none yet: the next one is announced once);
 * v3 → v4 adds the "photographic" dimension, at neutral: nobody has rated
 * a photograph yet, so it isn't guessed from the drawn prints they liked
 * (the photographs in the taste test are dealt next and measure it).
 */
export function migrateTaste(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== "object") return persisted;
  const s = { ...(persisted as Record<string, unknown>) };
  if (version < 2) s.daily = emptyDaily();
  if (version < 3) s.milestones = [];
  if (version < 4) {
    const neutral = (v: unknown) => (v && typeof v === "object" ? { ...(v as object), photographic: 0.5 } : v);
    s.preferenceVector = neutral(s.preferenceVector);
    if (s.lastUpdate && typeof s.lastUpdate === "object") {
      const lu = s.lastUpdate as Record<string, unknown>;
      s.lastUpdate = { ...lu, before: neutral(lu.before), after: neutral(lu.after) };
    }
  }
  return s;
}

export const useTasteStore = create<TasteState & TasteActions>()(
  persist(
    (set, get) => ({
      ...initialTaste(),

      fillDeck: () => {
        const { deck, preferenceVector, seen } = get();
        set({ deck: buildDeck(deck, preferenceVector, seen) });
      },

      requestSwipe: (action) => {
        const ui = useUiStore.getState();
        if (get().deck.length === 0 || ui.swipeQueue.length >= 5) return;
        useUiStore.setState({ swipeQueue: [...ui.swipeQueue, { action, nonce: Date.now() + Math.random() }] });
      },

      commitSwipe: (shirtId, action, fromQueue = false) => {
        const state = get();
        const top = state.deck[0];
        const shirt = getShirtById(shirtId);
        // Guard against duplicate commits (e.g. a button press racing a drag).
        if (!top || top.id !== shirtId || !shirt) return;

        const before = state.preferenceVector;
        const after = updateUserVector(before, shirt.features, action);
        const score = matchScore(before, shirt.features);
        const swipeHistory = pushEvent(state.swipeHistory, { shirtId, action, source: "swipe", matchScore: score, strategy: top.strategy, timestamp: Date.now() });
        const seen = addSeen(state.seen, shirtId);
        // Keep the card that is already visible underneath; re-rank everything
        // behind it with the freshly updated vector.
        const deck = buildDeck(state.deck.slice(1, 2), after, seen);
        const calibrationJustDone =
          !state.calibrationAcknowledged && calibrationDone(CALIBRATION_IDS, state.seen) < CALIBRATION_TOTAL && calibrationDone(CALIBRATION_IDS, seen) >= CALIBRATION_TOTAL;

        // The Daily 5 counts new tees swiped after the taste test — not the
        // test itself, and not a card brought back by Undo (Undo restores it).
        const daily = state.calibrationAcknowledged && !state.seen.includes(shirtId) ? countSwipe(state.daily) : state.daily;
        // A taste level reached for the first time (after the taste test).
        const level = tasteLevel(after);
        const milestone = state.calibrationAcknowledged && level !== TASTE_LEVELS[0] && !state.milestones.includes(level) ? level : null;
        set({
          preferenceVector: after,
          swipeHistory,
          seen,
          daily,
          milestones: milestone ? [...state.milestones, milestone] : state.milestones,
          // Never list an id twice (it may already be saved from the shop).
          likedIds: action === "like" && !state.likedIds.includes(shirtId) ? [...state.likedIds, shirtId] : state.likedIds,
          dislikedIds: action === "dislike" && !state.dislikedIds.includes(shirtId) ? [...state.dislikedIds, shirtId] : state.dislikedIds,
          deck,
          lastUpdate: { shirtId, action, before, after, daily: state.daily },
          // The gesture legend stays until the first real swipe (flipping or
          // zooming doesn't count as having learned to swipe).
          onboardingSeen: true,
        });
        const ui = useUiStore.getState();
        useUiStore.setState({
          isFlipped: false,
          undoFx: null,
          // The taste test just finished: drop queued button swipes so they
          // don't keep playing behind the "taste test complete" screen.
          swipeQueue: calibrationJustDone ? [] : fromQueue ? ui.swipeQueue.slice(1) : ui.swipeQueue,
        });
        track("swipe", { action, strategy: top.strategy, matchScore: score, id: shirtId });
        if (calibrationJustDone) track("calibration_complete", { swipes: seen.length });
      },

      undoLast: () => {
        const state = get();
        if (!canUndo(state) || !state.lastUpdate) return;
        const last = state.swipeHistory[state.swipeHistory.length - 1];
        const drop = (list: string[]) => {
          const i = list.lastIndexOf(last.shirtId);
          return i === -1 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
        };
        const restored: DeckEntry = { id: last.shirtId, strategy: last.strategy };
        set({
          preferenceVector: state.lastUpdate.before,
          swipeHistory: state.swipeHistory.slice(0, -1),
          seen: drop(state.seen),
          likedIds: last.action === "like" ? drop(state.likedIds) : state.likedIds,
          dislikedIds: last.action === "dislike" ? drop(state.dislikedIds) : state.dislikedIds,
          deck: [restored, ...state.deck.filter((e) => e.id !== restored.id)].slice(0, DECK_SIZE),
          daily: state.lastUpdate.daily ?? state.daily,
          lastUpdate: null,
        });
        useUiStore.setState({ isFlipped: false, swipeQueue: [], undoFx: { id: last.shirtId, action: last.action, nonce: Date.now() } });
        track("undo", { id: last.shirtId, action: last.action });
      },


      toggleSaved: (id) => {
        const state = get();
        const shirt = getShirtById(id);
        if (!shirt) return;
        if (state.likedIds.includes(id)) {
          set({ likedIds: state.likedIds.filter((x) => x !== id) });
          return;
        }
        // Saving from the shop is an explicit like: train on it, and mark it
        // seen so Discover doesn't serve it again. Each design trains once:
        // one already swiped or saved before (save → unsave → save…) is
        // saved again without moving the vector.
        const alreadySeen = state.seen.includes(id);
        const before = state.preferenceVector;
        const after = alreadySeen ? before : updateUserVector(before, shirt.features, "like");
        const swipeHistory = alreadySeen
          ? state.swipeHistory
          : pushEvent(state.swipeHistory, { shirtId: id, action: "like", source: "shop", matchScore: matchScore(before, shirt.features), strategy: "greedy", timestamp: Date.now() });
        const seen = addSeen(state.seen, id);
        const topStays = state.deck[0] && state.deck[0].id !== id ? [state.deck[0]] : [];
        set({
          likedIds: [...state.likedIds, id],
          dislikedIds: state.dislikedIds.filter((x) => x !== id),
          preferenceVector: after,
          swipeHistory,
          seen,
          // A save of something already swiped adds no history event, so there
          // is nothing Undo could revert correctly: clear it (canUndo → false)
          // rather than letting Undo roll back this save as if it were the swipe.
          lastUpdate: alreadySeen ? null : { shirtId: id, action: "like", before, after },
          deck: alreadySeen ? state.deck : buildDeck(topStays, after, seen),
        });
        if (!alreadySeen && !topStays.length) useUiStore.setState({ isFlipped: false });
        track("save", { id });
      },

      removeLiked: (id) => set((s) => ({ likedIds: s.likedIds.filter((x) => x !== id) })),

      restoreSaved: (id, at) =>
        set((s) => {
          if (s.likedIds.includes(id)) return {};
          const i = at === undefined ? s.likedIds.length : Math.min(Math.max(0, at), s.likedIds.length);
          return { likedIds: [...s.likedIds.slice(0, i), id, ...s.likedIds.slice(i)] };
        }),

      acknowledgeCalibration: () => set({ calibrationAcknowledged: true }),

      reset: () => {
        set(initialTaste());
        useUiStore.setState({ isFlipped: false, swipeQueue: [], undoFx: null });
      },

      snapshot: () => tasteOf(get()),
      restore: (snap) => {
        set(snap);
        useUiStore.setState({ isFlipped: false, swipeQueue: [], undoFx: null });
      },
    }),
    {
      name: TASTE_KEY,
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateTaste,
      skipHydration: true,
      partialize: (s): TasteState => tasteOf(s),
      // Only well-formed state is taken from storage.
      merge: (persisted, current) => ({ ...current, ...sanitizeTaste(persisted) }),
    },
  ),
);

/**
 * How many calibration prints the user has already seen (any source).
 * Once the result was shown the test stays complete, even when a new
 * catalog brings new calibration prints (the photographs): those are
 * still dealt first, but the app doesn't go back into test mode.
 */
export function useCalibrationProgress() {
  // Counted per family: saving a sibling of a calibration print in the shop
  // also counts. Selects a primitive so the result is referentially stable.
  const done = useTasteStore((s) => calibrationDone(CALIBRATION_IDS, s.seen));
  const acknowledged = useTasteStore((s) => s.calibrationAcknowledged);
  return { done, total: CALIBRATION_TOTAL, complete: acknowledged || done >= CALIBRATION_TOTAL };
}

/** Reset taste and Saved, with an Undo toast that restores it all. */
export function startOverWithUndo() {
  const { snapshot, reset, restore } = useTasteStore.getState();
  const before = snapshot();
  reset();
  useUiStore.getState().showToast("Started over", { label: "Undo", run: () => restore(before) });
}
