/**
 * What sits fixed at the bottom of the screen (the tab bar, a sticky buy
 * bar, the shop's control row): each part says how much of the bottom it
 * takes, and `--dock` is the tallest, so the toast and the mini bag sit just
 * above whatever is there.
 */
const parts = new Map<string, number>();

function publish() {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--dock", `${Math.max(0, ...parts.values())}px`);
}

/** `px`: the distance from the bottom of the screen to the part's top edge (null removes it). */
export function setDock(id: string, px: number | null) {
  if (px === null) parts.delete(id);
  else parts.set(id, Math.round(px));
  publish();
}
