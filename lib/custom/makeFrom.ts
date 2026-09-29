/** Set on the way to a Make product page (the index's cards, the sibling links): where the visit came from, for Back and analytics. */
export const FROM_KEY = "mono-make-from";
export function markFrom(from: "index" | "sibling") {
  try {
    sessionStorage.setItem(FROM_KEY, from);
  } catch {
    /* storage unavailable */
  }
}
