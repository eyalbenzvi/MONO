/**
 * When a grid print's thumbnail (240 px wide) would look soft — the page is
 * pinch-zoomed, or the screen is dense enough — and the print is on screen:
 * then, and only then, the full file is fetched (PrintImage `progressive`).
 * At normal zoom a grid page costs no extra bytes.
 */

/** The thumbnail is short of pixels at this size (15% slack). */
export const needsFull = (cssWidth: number, dpr: number, scale: number, naturalWidth: number) => cssWidth * dpr * scale > naturalWidth * 1.15;

const watchers = new Set<() => void>();
let listening = false;
let raf = 0;

/** The visual viewport (what a pinch shows) and the screen's density, for one check. */
export interface View {
  scale: number;
  dpr: number;
  L: number;
  T: number;
  W: number;
  H: number;
}

function view(): View {
  const vv = window.visualViewport;
  return { scale: vv?.scale ?? 1, dpr: window.devicePixelRatio || 1, L: vv?.offsetLeft ?? 0, T: vv?.offsetTop ?? 0, W: vv?.width ?? window.innerWidth, H: vv?.height ?? window.innerHeight };
}

/** Whether the print in `el` (its thumbnail loaded) is on screen and would look soft. */
export function wantsFull(el: Element, v: View): boolean {
  const img = el.querySelector("img");
  if (!img?.naturalWidth) return false;
  const r = el.getBoundingClientRect();
  if (!needsFull(r.width, v.dpr, v.scale, img.naturalWidth)) return false;
  const mx = v.W * 0.3;
  const my = v.H * 0.3;
  return r.right > v.L - mx && r.left < v.L + v.W + mx && r.bottom > v.T - my && r.top < v.T + v.H + my;
}

let current: View | null = null;
/** The view of the check running now (each watcher measures its own print against it). */
export const checkView = () => current ?? view();

/** Re-check on the next frame (pinch, pan, zoom, scroll, a thumbnail loading). */
export function scheduleSharpness() {
  if (typeof window === "undefined" || raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    current = view();
    for (const w of [...watchers]) w();
    current = null;
  });
}

/**
 * Runs `check` at most once a frame on zoom, scroll and resize (the shop
 * scrolls inside its own element, so scrolls are caught in the capture
 * phase). Returns a cleanup.
 */
export function watchSharpness(check: () => void): () => void {
  if (!listening) {
    listening = true;
    window.visualViewport?.addEventListener("resize", scheduleSharpness);
    window.visualViewport?.addEventListener("scroll", scheduleSharpness);
    window.addEventListener("resize", scheduleSharpness);
    document.addEventListener("scroll", scheduleSharpness, { capture: true, passive: true });
  }
  watchers.add(check);
  scheduleSharpness();
  return () => void watchers.delete(check);
}
