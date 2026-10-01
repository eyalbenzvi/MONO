import { motionValue } from "framer-motion";

/** Card travel (px) where the swipe label and the buttons start to react, are fully shown, and lock (the commit point). */
export const SWIPE_START = 16;
export const SWIPE_SHOW = 64;
/** The commit point: the drag distance (110) through the card's elastic (0.9). */
export const SWIPE_LOCK = 110 * 0.9;

/** The top card's sideways travel, shared with the action buttons (one card drags at a time). */
export const swipeDrag = motionValue(0);
