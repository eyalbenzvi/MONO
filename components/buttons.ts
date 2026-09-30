// No "use client": server pages (About, the 404) use the same button classes.
/**
 * The one button look (sentence case, 14px medium, 48px tall, one corner
 * radius for every control): the primary action is white, the secondary a
 * hairline outline. Links that act as buttons use the same classes.
 */
export const BUTTON_PRIMARY =
  "flex h-12 min-w-11 items-center justify-center gap-2 rounded-control bg-white px-6 text-sm font-medium text-black transition-colors duration-150 hover:bg-neutral-200 disabled:opacity-50";
export const BUTTON_SECONDARY =
  "flex h-12 min-w-11 items-center justify-center gap-2 rounded-control px-6 text-sm font-medium text-white ring-1 ring-inset ring-white/25 transition-colors duration-150 hover:bg-white/5 disabled:opacity-50";
/** A quiet text action (a link or button in words), still a 44px target. */
export const TEXT_ACTION = "inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-muted underline-offset-4 hover:text-white hover:underline";
