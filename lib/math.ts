/** Small shared number helpers. */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Into 0..1. */
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A value that differs on every call: tells a repeat of the same toast or note from the one before. */
export const nonce = () => Date.now() + Math.random();
