"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AcceptedDesign } from "@/lib/upload/designs";
import { FORCE_KEY, MAKE_KEY } from "@/lib/upload/keys";
import { REFUSE_REASONS, localReview, parseForce, type ReviewTicket } from "@/lib/upload/review";
import type { UploadMode } from "@/types/shirt";

/**
 * "From yours" on this device (`mono-make`): each upload's metadata, the
 * review tickets of ordered uploads, and Open Call offers (an accepted one
 * is a design in this device's shop). Rasters stay in IndexedDB
 * (lib/upload/store); nothing here is sent anywhere.
 */
export interface UploadMeta {
  id: string;
  title: string;
  cls: "line" | "photo" | "vector" | "words";
  mode: UploadMode;
  size: "full" | "small";
  /** The tees it prints on, the chosen one first. */
  tees: ("black" | "white")[];
  hash: string;
  /** "catalogue" when it clears the Open Call's bar. */
  tier: "print" | "catalogue";
  /** A check came within 10% of its threshold (the review's person stage). */
  near: boolean;
  quality: number;
  /** Hamming distance to the nearest catalogue design. */
  distance: number;
  category: AcceptedDesign["category"];
  features: AcceptedDesign["features"];
  createdAt: number;
  /** Placed in an order (its working copy is gone then). */
  ordered?: boolean;
}

export interface MakeState {
  uploads: Record<string, UploadMeta>;
  /** Review tickets by ticket id. */
  reviews: Record<string, ReviewTicket>;
  /** Open Call offers by upload id. */
  offers: Record<string, AcceptedDesign>;
}

interface MakeActions {
  putUpload: (u: UploadMeta) => void;
  forgetUploads: (ids: string[]) => void;
  putTicket: (t: ReviewTicket) => void;
  putOffer: (o: AcceptedDesign) => void;
  withdraw: (uploadId: string) => void;
  clearAll: () => void;
  /** An order was placed: each uploaded line gets a review ticket (and a refused one's replacement, its old ticket's place). */
  submitReviews: (order: string, uploadIds: string[], replaces?: Record<string, string>) => ReviewTicket[];
}

/** A forced review state for demos: `?review=` on this page, else the one remembered for the tab (the upload page or the debug panel set it). */
export function reviewForce() {
  try {
    const q = new URLSearchParams(window.location.search).get("review");
    return parseForce(q ?? sessionStorage.getItem(FORCE_KEY));
  } catch {
    return undefined;
  }
}
export { FORCE_KEY };

export const initialMake = (): MakeState => ({ uploads: {}, reviews: {}, offers: {} });

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const str = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length < 200;
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Keys that would reach an object's prototype if copied onto it. */
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
/** The entries of a stored record, without keys that could touch a prototype. */
const entries = (x: unknown) => Object.entries(obj(x)).filter(([k]) => !UNSAFE.has(k));
/** Only the named fields (the ones the type has), so nothing else stored comes back in. */
function pick<T>(v: T, keys: readonly (keyof T)[]): T {
  const out = {} as T;
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = v[k];
  return out;
}
const UPLOAD_FIELDS = ["id", "title", "cls", "mode", "size", "tees", "hash", "tier", "near", "quality", "distance", "category", "features", "createdAt", "ordered"] as const satisfies readonly (keyof UploadMeta)[];
const TICKET_FIELDS = ["id", "uploadId", "order", "submittedAt", "near", "force", "replaces"] as const satisfies readonly (keyof ReviewTicket)[];
const OFFER_FIELDS = ["uploadId", "id", "title", "category", "credit", "submittedAt", "quality", "distance", "force", "withdrawn", "features", "colors"] as const satisfies readonly (keyof AcceptedDesign)[];

/** What localStorage held, reduced to well-formed entries and their known fields (anything else is dropped). */
export function sanitizeMake(raw: unknown): MakeState {
  const r = obj(raw);
  const uploads: Record<string, UploadMeta> = {};
  for (const [k, v] of entries(r.uploads)) {
    const u = v as UploadMeta;
    if (str(u?.id) && u.id === k && str(u.title) && str(u.hash) && num(u.createdAt) && Array.isArray(u.tees) && u.tees.length) uploads[k] = pick(u, UPLOAD_FIELDS);
  }
  const reviews: Record<string, ReviewTicket> = {};
  for (const [k, v] of entries(r.reviews)) {
    const t = v as ReviewTicket;
    const force = t?.force;
    const forceOk = !force || force.state === "person" || (force.state === "refused" && REFUSE_REASONS.includes(force.reason));
    if (str(t?.id) && t.id === k && str(t.uploadId) && str(t.order) && num(t.submittedAt) && typeof t.near === "boolean" && forceOk) reviews[k] = pick(t, TICKET_FIELDS);
  }
  const offers: Record<string, AcceptedDesign> = {};
  for (const [k, v] of entries(r.offers)) {
    const o = v as AcceptedDesign;
    if (str(o?.uploadId) && o.uploadId === k && str(o.id) && str(o.title) && str(o.credit) && num(o.submittedAt) && num(o.quality) && num(o.distance) && Array.isArray(o.colors) && o.colors.length) offers[k] = pick(o, OFFER_FIELDS);
  }
  return { uploads, reviews, offers };
}

export const useMakeStore = create<MakeState & MakeActions>()(
  persist(
    (set, get) => ({
      ...initialMake(),
      putUpload: (u) => set((s) => ({ uploads: { ...s.uploads, [u.id]: u } })),
      forgetUploads: (ids) =>
        set((s) => {
          const uploads = { ...s.uploads };
          for (const id of ids) delete uploads[id];
          return { uploads };
        }),
      putTicket: (t) => set((s) => ({ reviews: { ...s.reviews, [t.id]: t } })),
      putOffer: (o) => set((s) => ({ offers: { ...s.offers, [o.uploadId]: o } })),
      withdraw: (uploadId) => set((s) => (s.offers[uploadId] ? { offers: { ...s.offers, [uploadId]: { ...s.offers[uploadId], withdrawn: true } } } : {})),
      clearAll: () => set(initialMake()),
      submitReviews: (order, uploadIds, replaces = {}) => {
        const s = get();
        const review = localReview({ get: (id) => get().reviews[id], put: (t) => get().putTicket(t) });
        const force = reviewForce();
        const tickets = uploadIds.map((id) => review.submit({ order, uploadId: id, near: !!s.uploads[id]?.near, ...(force ? { force } : {}), ...(replaces[id] ? { replaces: replaces[id] } : {}) }));
        set((st) => ({ uploads: Object.fromEntries(Object.entries(st.uploads).map(([k, u]) => [k, uploadIds.includes(k) ? { ...u, ordered: true } : u])) }));
        return tickets;
      },
    }),
    {
      name: MAKE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s): MakeState => ({ uploads: s.uploads, reviews: s.reviews, offers: s.offers }),
      merge: (persisted, current) => ({ ...current, ...sanitizeMake(persisted) }),
    },
  ),
);
