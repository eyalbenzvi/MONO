/**
 * Product analytics, provider-agnostic: every event is pushed onto
 * `window.dataLayer` (the Google Tag Manager / GA4 / Segment convention), so
 * a tag manager can forward it once a provider is chosen. No third-party
 * script is loaded here.
 *
 *   track("swipe", { action, id })
 *   trackEcommerce("add_to_cart", { items: [itemOf(shirt, { color, size })], source: "grid" })
 *
 * Commerce events follow GA4's shape (currency, value, items[]); the rest
 * are product events. Nothing personal is sent (no name, email or address).
 */
import type { BaseColor, ShirtProduct, ShirtSize } from "@/types/shirt";
import { CATEGORY_LABELS } from "@/types/shirt";

export type CommerceEvent =
  | "view_item_list"
  | "select_item"
  | "view_item"
  | "add_to_cart"
  | "remove_from_cart"
  | "view_cart"
  | "begin_checkout"
  | "purchase";

export type AnalyticsEvent =
  | CommerceEvent
  | "landing"
  | "page_view"
  | "swipe"
  | "undo"
  | "calibration_complete"
  | "taste_sheet_open"
  | "shop_view"
  | "select_size"
  | "save"
  | "share"
  | "share_taste";

export type AnalyticsProps = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  if (typeof window === "undefined") return;
  try {
    (window.dataLayer ??= []).push({ event, ...props, ts: Date.now() });
    if (process.env.NODE_ENV === "development") console.debug("[track]", event, props);
  } catch {
    /* analytics must never break the app */
  }
}

/* ------------------------------------------------------------------ */
/* Commerce (GA4 shape)                                                */
/* ------------------------------------------------------------------ */

/** Where an add to the bag happened. */
export type AddSource = "product" | "grid" | "minibag" | "cart_xsell" | "empty_bag" | "saved" | "confirm" | "discover_card" | "shared_list";

export interface EcomItem {
  item_id: string;
  item_name: string;
  item_category: string;
  /** The tee colour. */
  item_variant: BaseColor;
  size?: ShirtSize;
  price: number;
  quantity: number;
  /** Per unit (the pair's saving, shared across its two tees). */
  discount?: number;
  index?: number;
}

export function itemOf(shirt: ShirtProduct, { color = shirt.baseColor, size, quantity = 1, discount, index }: { color?: BaseColor; size?: ShirtSize; quantity?: number; discount?: number; index?: number } = {}): EcomItem {
  return {
    item_id: shirt.id,
    item_name: shirt.title,
    item_category: CATEGORY_LABELS[shirt.category],
    item_variant: color,
    ...(size ? { size } : {}),
    price: shirt.price,
    quantity,
    ...(discount ? { discount } : {}),
    ...(index !== undefined ? { index } : {}),
  };
}

/** What the items are worth after their discounts (the pair counts as $90, not $96). */
export const itemsValue = (items: EcomItem[]) => Math.round(items.reduce((sum, i) => sum + (i.price - (i.discount ?? 0)) * i.quantity, 0) * 100) / 100;

export function trackEcommerce(event: CommerceEvent, { items, value, ...rest }: { items: EcomItem[]; value?: number; source?: AddSource } & AnalyticsProps) {
  track(event, { currency: "USD", value: value ?? itemsValue(items), items, ...rest });
}

/* ------------------------------------------------------------------ */
/* Attribution                                                         */
/* ------------------------------------------------------------------ */

const FIRST_TOUCH_KEY = "mono-first-touch";

/** Query parameters that are read once and then removed from the address bar. */
export const LANDING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "ref", "taste", "list"] as const;

export interface Landing {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ref: string | null;
  has_taste: boolean;
  has_list: boolean;
  landing_path: string;
  referrer: string | null;
}

let landed = false;

/**
 * Record how this visit arrived, before any page removes the tags from the
 * address bar: a `landing` event, and the first touch of the session (kept
 * in sessionStorage, attached to a purchase). Runs once per page load.
 */
export function captureLanding(loc: Pick<Location, "search" | "pathname"> = window.location, referrer = document.referrer): Landing | null {
  if (landed) return null;
  landed = true;
  const q = new URLSearchParams(loc.search);
  const landing: Landing = {
    utm_source: q.get("utm_source"),
    utm_medium: q.get("utm_medium"),
    utm_campaign: q.get("utm_campaign"),
    ref: q.get("ref"),
    has_taste: q.has("taste"),
    has_list: q.has("list"),
    landing_path: loc.pathname,
    referrer: referrer || null,
  };
  track("landing", { ...landing });
  try {
    if (!sessionStorage.getItem(FIRST_TOUCH_KEY)) sessionStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(landing));
  } catch {
    /* storage unavailable */
  }
  return landing;
}

/** The session's first touch (for the purchase), if recorded. */
export function firstTouch(): Partial<Landing> | null {
  try {
    const raw = sessionStorage.getItem(FIRST_TOUCH_KEY);
    return raw ? (JSON.parse(raw) as Partial<Landing>) : null;
  } catch {
    return null;
  }
}

/** Test hook: forget that this page load's landing was recorded. */
export const resetLanding = () => {
  landed = false;
};
