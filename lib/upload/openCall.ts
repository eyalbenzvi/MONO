/**
 * The Open Call, simulated (brief 6.7): a cleared upload of the catalogue
 * tier can be offered; 30 s later it is `accepted` when its print scores at
 * least 72 and no catalogue design is within Hamming 12 of it, else
 * `declined` ("Not this time"). `?review=` can force either. An accepted
 * design joins the shop on this device only, as `mono-u-<base36>`.
 */
export const OFFER_MS = 30_000;
export const ACCEPT_QUALITY = 72;
export const ACCEPT_DISTANCE = 12;

export type OfferState = "offered" | "accepted" | "declined" | "withdrawn";

export interface Offer {
  uploadId: string;
  /** The shop id it takes if accepted. */
  id: string;
  title: string;
  category: string;
  /** "Anonymous" when none was given. */
  credit: string;
  submittedAt: number;
  quality: number;
  /** Hamming distance to the nearest catalogue design. */
  distance: number;
  force?: "accepted" | "declined";
  withdrawn?: boolean;
}

export function offerState(o: Offer, now: number): OfferState {
  if (o.withdrawn) return "withdrawn";
  if (now - o.submittedAt < OFFER_MS) return "offered";
  if (o.force) return o.force;
  return o.quality >= ACCEPT_QUALITY && o.distance > ACCEPT_DISTANCE ? "accepted" : "declined";
}

/** `?review=accept` / `?review=decline` force the curation; anything else leaves it to the rule. */
export const parseOfferForce = (v: string | null | undefined): Offer["force"] => (v === "accept" ? "accepted" : v === "decline" ? "declined" : undefined);

/** A shop id for an accepted upload: `mono-u-` and base 36 of when it was offered. */
export const shopId = (submittedAt: number) => `mono-u-${submittedAt.toString(36)}`;
export const isUploadDesign = (id: string) => /^mono-u-[0-9a-z]+$/.test(id);

export const OFFER_LINE = "$6 a tee, $10 a pair. You keep the rights. We review it again.";
export const OFFER_STATE_LINE: Record<OfferState, string> = {
  offered: "Offered. We look at it again.",
  accepted: "Accepted. In the shop now.",
  declined: "Not this time.",
  withdrawn: "Withdrawn.",
};
export const SALES_LINE = "Sales: none yet (this is a demo)";
