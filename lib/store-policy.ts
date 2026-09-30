/**
 * Store promises shown to shoppers, the one source: every surface that
 * states a policy (returns, delivery, fabric, fit) renders it from here, so
 * two places can never say different things. PENDING APPROVAL: placeholder
 * facts for the preview store — confirm each before it is real policy.
 */
export const STORE_POLICY = {
  /** Returns and exchanges, in one phrase everywhere (product page, bag, Make, structured data). */
  returns: "Free returns and exchanges within 30 days",
  returnDays: 30,
  /** The one exception, for made-for-you tees (printed for one person): scoped, so it never contradicts `returns`. */
  customReturns: "Made-for-you tees: free size exchanges within 30 days.",
  /** The fabric, in one wording (the trust line, the Details spec, Make). */
  fabric: "Organic cotton, 220 gsm",
  /** Fit advice (the size guide). */
  fit: "True to size. Between sizes, size up.",
  /** What the Open Call pays a maker per tee and per pair sold, and its name (brief 6.7; pending approval like the rest). */
  openCall: { perTee: 6, perPair: 10, call: "Open Call 01" },
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
} as const;

