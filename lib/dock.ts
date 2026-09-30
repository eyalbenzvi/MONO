/**
 * What sits fixed at the bottom of the screen (the tab bar, a sticky buy
 * bar, the shop's control row): each part says how much of the bottom it
 * takes, and `--dock` is the tallest, so the toast and the mini bag sit just
 * above whatever is there.
 */
const parts = new Map<string, { px: number; buy: boolean }>();

/**
 * `--dock-bag` is where the mini bag sits: over a page's own buy bar (which
 * already says "In your bag · Checkout", and whose sizes sit just above it),
 * so it's the dock without the buy bars.
 */
function publish() {
  if (typeof document === "undefined") return;
  const all = [...parts.values()];
  document.documentElement.style.setProperty("--dock", `${Math.max(0, ...all.map((p) => p.px))}px`);
  document.documentElement.style.setProperty("--dock-bag", `${Math.max(0, ...all.filter((p) => !p.buy).map((p) => p.px))}px`);
}

/** `px`: the distance from the bottom of the screen to the part's top edge (null removes it). `buy`: a page's own buy bar. */
export function setDock(id: string, px: number | null, buy = false) {
  if (px === null) parts.delete(id);
  else parts.set(id, { px: Math.round(px), buy });
  publish();
}
