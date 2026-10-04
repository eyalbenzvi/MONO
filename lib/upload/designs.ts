/**
 * Uploaded prints as shop products, resolved by id like the made-for-you
 * ones (lib/catalog getShirtById):
 * - `make-yours`: the bag's product for any uploaded print (its picture comes
 *   from the line's raster, its title from the `mono-make` store);
 * - `mono-u-<base36>`: an upload the Open Call accepted, on this device only.
 *   It is read straight from the persisted `mono-make` state, so a bag line
 *   of it resolves before any store has loaded.
 */
import { MAKE_KEY, YOURS_ID, isUploadDesign, offerState } from "./keys";
import type { Offer } from "./openCall";
import { STORE_POLICY } from "@/lib/store-policy";
import { asShopCategory, type FeatureVector, type ShirtCategory, type ShirtProduct } from "@/types/shirt";

export { MAKE_KEY, YOURS_ID };

/** What an accepted design needs to stand in the shop (kept with its offer). */
export interface AcceptedDesign extends Offer {
  category: ShirtCategory;
  features: FeatureVector;
  /** The tee it prints best on, first; both when both pass. */
  colors: ("black" | "white")[];
}

/** The persisted `mono-make` offers, read directly (null off the browser or when there are none). */
function persistedOffers(): Record<string, AcceptedDesign> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAKE_KEY);
    if (!raw) return null;
    // Parsed once per stored value: the bag and the taste ask per line.
    if (parsed?.raw !== raw) parsed = { raw, offers: (JSON.parse(raw)?.state?.offers ?? null) as Record<string, AcceptedDesign> | null };
    return parsed.offers;
  } catch {
    return null;
  }
}
let parsed: { raw: string; offers: Record<string, AcceptedDesign> | null } | null = null;

/** The accepted designs now (accepted and not withdrawn), newest first. */
export function acceptedDesigns(offers: Record<string, AcceptedDesign> | null = persistedOffers(), now = Date.now()): AcceptedDesign[] {
  return Object.values(offers ?? {})
    .filter((o) => o && typeof o.id === "string" && isUploadDesign(o.id) && offerState(o, now) === "accepted")
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

/** An accepted design as a product, built on a catalogue design of its category (for the model photo and the layout). */
export function uploadProduct(id: string, base: ShirtProduct | undefined, offers?: Record<string, AcceptedDesign> | null): ShirtProduct | undefined {
  if (!base || !isUploadDesign(id)) return undefined;
  const d = acceptedDesigns(offers).find((o) => o.id === id);
  if (!d) return undefined;
  return {
    ...base,
    id,
    title: d.title,
    // Accepted before the categories went by subject: the category its kind went to.
    category: asShopCategory(d.category) ?? base.category,
    features: d.features,
    colors: d.colors,
    baseColor: d.colors[0],
    family: id,
    variant: "upload",
    price: base.price,
    rank: Number.MAX_SAFE_INTEGER,
    weak: false,
  };
}

/** The credit line under an accepted design: `By Noa L. · Open Call 01`. */
export const creditLine = (d: Pick<Offer, "credit">) => `By ${d.credit} · ${STORE_POLICY.openCall.call}`;
