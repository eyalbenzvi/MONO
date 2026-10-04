import type { PanInfo } from "framer-motion";

/**
 * Swipe a white message bar (a toast, the bag confirmation) to the left to dismiss it: past 80 px, or
 * a flick, it slides off to the left; short of that it springs back. To the right it barely gives.
 * Vertical scrolling stays the page's (touch-action: pan-y), and a tap on the bar's link or button is
 * still a tap.
 */
export const SWIPE_AWAY = {
  drag: "x" as const,
  dragDirectionLock: true,
  dragConstraints: { left: 0, right: 0 },
  dragElastic: { left: 1, right: 0.08 },
  dragSnapToOrigin: true,
  style: { touchAction: "pan-y" as const },
};

export const swipedAway = (info: PanInfo) => info.offset.x < -80 || info.velocity.x < -500;

/** The exit: off to the left when swiped, the usual drop otherwise. */
export const exitFor = (swiped: boolean) => (swiped ? { x: -480, opacity: 0, transition: { duration: 0.18 } } : { y: 8, opacity: 0 });
