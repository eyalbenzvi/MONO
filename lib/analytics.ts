/**
 * Product analytics, provider-agnostic: every event is pushed onto
 * `window.dataLayer` (the Google Tag Manager / GA4 / Segment convention), so
 * a tag manager can forward it once a provider is chosen. No third-party
 * script is loaded here.
 *
 *   track("add_to_cart", { id, size, color, price })
 *
 * Events: swipe, calibration_complete, shop_view, product_view,
 * select_size, add_to_cart, begin_checkout, purchase, save, share, plus
 * feature events added later (email_signup, …).
 */
export type AnalyticsEvent =
  | "swipe"
  | "calibration_complete"
  | "shop_view"
  | "product_view"
  | "select_size"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "save"
  | "share"
  | "email_signup"
  | "share_taste";

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined | string[]>;

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
