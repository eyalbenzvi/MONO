/**
 * Store promises shown to shoppers. PENDING APPROVAL: these are placeholder
 * facts for the demo store — confirm each one (exchanges, shipping time,
 * fabric, returns, fit advice) before they are presented as real policy.
 * Everything that states a policy reads from here, so one edit updates
 * every surface.
 */
export const STORE_POLICY = {
  /** Quiet trust line under the size selector (product page). */
  trust: [
    { key: "exchange", text: "Free size exchanges" },
    { key: "shipping", text: "Ships in 3–5 days" },
    { key: "fabric", text: "100% organic cotton" },
  ],
  /** Fit advice at the top of the size guide. */
  fit: "Fits true to size. Between sizes? Go up.",
  /** Near the checkout button in the bag. */
  returns: "Free 30-day returns",
  /** A made-for-you tee's price, and the pair of one print in black and white (lib/cart unitPrice / pairPrice). */
  customPrice: 75,
  customPairPrice: 130,
  /** What the Open Call pays a maker per tee and per pair sold, and its name (brief 6.7; pending approval like the rest). */
  openCall: { perTee: 6, perPair: 10, call: "Open Call 01" },
  /** Under the returns line in the bag, when it holds a personalised tee. */
  customReturns: "Made for you: size exchanges only",
  /**
   * Delivery estimate for "Arrives …": business days to print and ship,
   * plus business days in transit (ranges, low–high).
   */
  delivery: { shipDays: [3, 5], transitDays: [2, 4] },
  /** Countries offered at checkout (ISO code, name). */
  countries: [
    ["US", "United States"],
    ["GB", "United Kingdom"],
    ["CA", "Canada"],
    ["IL", "Israel"],
    ["DE", "Germany"],
    ["FR", "France"],
    ["NL", "Netherlands"],
    ["AU", "Australia"],
  ],
  /** First visit, under the Discover strip. */
  firstVisit: "Organic cotton · Printed to order · Free returns",
} as const;

export type TrustKey = (typeof STORE_POLICY.trust)[number]["key"];
