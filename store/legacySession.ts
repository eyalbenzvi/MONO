/**
 * One-time migration of the old single-store session ("mono-session-v1",
 * versions 3–6) into the split stores: taste ("mono-taste") and the bag
 * ("mono-cart"). Runs before the stores rehydrate. Older than v3 (the
 * 25-shirt demo catalog) is dropped, as before.
 *
 * The old in-place migrations are replayed first: v4 made tee colour a bag
 * choice (lines get their design's original colour), v5/v6 added feature
 * dimensions (stored vectors are extended with a neutral 0.5).
 */
import { getShirtById } from "@/lib/catalog";
import { CART_KEY, sanitizeCart } from "@/store/cartStore";
import { TASTE_KEY, sanitizeTaste } from "@/store/tasteStore";
import { createInitialVector, type CartItem, type SwipeEvent, type UserProfileVector } from "@/types/shirt";

export const LEGACY_KEY = "mono-session-v1";

interface LegacyV6 {
  likedIds?: string[];
  dislikedIds?: string[];
  preferenceVector?: Partial<UserProfileVector>;
  swipeHistory?: SwipeEvent[];
  deck?: { id: string; strategy: string }[];
  selectedSizes?: Record<string, string>;
  selectedColors?: Record<string, string>;
  lastUpdate?: { shirtId: string; action: string; before?: Partial<UserProfileVector>; after?: Partial<UserProfileVector> } | null;
  cart?: Partial<CartItem>[];
  lastOrder?: { items?: Partial<CartItem>[]; [k: string]: unknown } | null;
  calibrationAcknowledged?: boolean;
  onboardingSeen?: boolean;
}

const extend = (v: Partial<UserProfileVector> | undefined) => ({ ...createInitialVector(), ...(v ?? {}) });
const withColor = (items: Partial<CartItem>[] = []) =>
  items.flatMap((i) => {
    const shirt = i.id ? getShirtById(i.id) : undefined;
    return shirt ? [{ ...i, color: i.color ?? shirt.baseColor }] : [];
  });

/** Replays the old migrate() chain (v3–v5 → v6 shape). Returns null for < v3. */
export function upgradeLegacy(state: LegacyV6, version: number): LegacyV6 | null {
  if (version < 3) return null;
  return {
    ...state,
    preferenceVector: extend(state.preferenceVector),
    lastUpdate: state.lastUpdate ? { ...state.lastUpdate, before: extend(state.lastUpdate.before), after: extend(state.lastUpdate.after) } : null,
    selectedColors: state.selectedColors ?? {},
    cart: withColor(state.cart),
    lastOrder: state.lastOrder ? { ...state.lastOrder, items: withColor(state.lastOrder.items) } : null,
  };
}

/** Splits a (v6-shaped) legacy session into the taste and cart stores' persisted states. */
export function splitLegacy(s: LegacyV6) {
  const taste = sanitizeTaste({
    likedIds: s.likedIds,
    dislikedIds: s.dislikedIds,
    preferenceVector: s.preferenceVector,
    swipeHistory: s.swipeHistory,
    // Every swiped / saved id was in the full history before it was capped.
    seen: (s.swipeHistory ?? []).map((e) => e.shirtId),
    deck: s.deck,
    lastUpdate: s.lastUpdate,
    calibrationAcknowledged: s.calibrationAcknowledged,
    onboardingSeen: s.onboardingSeen,
  });
  const cart = sanitizeCart({ cart: s.cart, lastOrder: s.lastOrder, selectedSizes: s.selectedSizes, selectedColors: s.selectedColors });
  return { taste, cart };
}

/**
 * Moves an old session into the new keys (unless they already exist) and
 * removes the old key. Safe to call on every load.
 */
export function migrateLegacySession(storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return;
  try {
    const raw = storage.getItem(LEGACY_KEY);
    if (!raw) return;
    const { state, version } = JSON.parse(raw) as { state: LegacyV6; version: number };
    const upgraded = upgradeLegacy(state ?? {}, version ?? 0);
    if (upgraded) {
      const { taste, cart } = splitLegacy(upgraded);
      if (!storage.getItem(TASTE_KEY)) storage.setItem(TASTE_KEY, JSON.stringify({ state: taste, version: 1 }));
      if (!storage.getItem(CART_KEY)) storage.setItem(CART_KEY, JSON.stringify({ state: cart, version: 1 }));
    }
    storage.removeItem(LEGACY_KEY);
  } catch {
    // Unreadable old session: drop it rather than fail the app.
    storage.removeItem(LEGACY_KEY);
  }
}
