/**
 * The few names the rest of the site needs from "From yours" (the catalogue,
 * the bag, the stores, the debug panel), kept apart so that none of them
 * pulls the upload code or its copy into every page.
 */
export const YOURS_ID = "make-yours";
export const MAKE_KEY = "mono-make";
/** A forced review state for demos, remembered for the tab. */
export const FORCE_KEY = "mono-review";

export type RefuseReason = "logo" | "artwork" | "person" | "explicit" | "hate" | "words" | "quality";
export const REFUSE_REASONS: readonly RefuseReason[] = ["logo", "artwork", "person", "explicit", "hate", "words", "quality"];

/** An Open Call design's shop id: `mono-u-<base36>`. */
export const isUploadDesign = (id: string) => /^mono-u-[0-9a-z]+$/.test(id);

/** The Open Call's rule (lib/upload/openCall): offered for OFFER_MS, then accepted at ACCEPT_QUALITY with nothing within ACCEPT_DISTANCE. */
export const OFFER_MS = 30_000;
export const ACCEPT_QUALITY = 72;
export const ACCEPT_DISTANCE = 12;
export type OfferState = "offered" | "accepted" | "declined" | "withdrawn";
export function offerState(o: { withdrawn?: boolean; submittedAt: number; force?: "accepted" | "declined"; quality: number; distance: number }, now: number): OfferState {
  if (o.withdrawn) return "withdrawn";
  if (now - o.submittedAt < OFFER_MS) return "offered";
  if (o.force) return o.force;
  return o.quality >= ACCEPT_QUALITY && o.distance > ACCEPT_DISTANCE ? "accepted" : "declined";
}
