/**
 * The simulated review of an uploaded print (a mockup: no server, no person).
 * After an order, each uploaded line gets a ticket; its state follows from
 * wall time alone, so it survives reloads and needs no timers:
 *
 * - `queued` for REVIEW_MS, then `cleared`;
 * - a file whose print checks came within 10% of a threshold (measure `near`)
 *   passes through `person` for another REVIEW_MS first;
 * - a forced state (`?review=refuse:<reason>` or `?review=person`, or the
 *   debug panel) is fixed at submit time: a refusal lands when the queue ends.
 *
 * The page says "Up to 2 days"; the order confirmation says the review is
 * simulated.
 */

export type ReviewState = "queued" | "person" | "cleared" | "refused";
import { REFUSE_REASONS, type RefuseReason } from "./keys";
export { REFUSE_REASONS, type RefuseReason } from "./keys";

/** How long each stage lasts (20 s of wall time). */
export const REVIEW_MS = 20_000;

export type Force = { state: "refused"; reason: RefuseReason } | { state: "person" };

export interface ReviewTicket {
  id: string;
  uploadId: string;
  /** The order it came with. */
  order: string;
  submittedAt: number;
  /** A check came within 10% of its threshold: a person looks too. */
  near: boolean;
  force?: Force;
  /** The ticket this one replaces (a refused file's "Upload another"). */
  replaces?: string;
}

export interface Review {
  submit(order: { order: string; uploadId: string; near: boolean; force?: Force; replaces?: string }): ReviewTicket;
  status(id: string): ReviewState;
}

/** A ticket's state at `now`. */
export function stateAt(t: Pick<ReviewTicket, "submittedAt" | "near" | "force">, now: number): ReviewState {
  const since = now - t.submittedAt;
  if (since < REVIEW_MS) return "queued";
  if (t.force?.state === "refused") return "refused";
  if ((t.near || t.force?.state === "person") && since < 2 * REVIEW_MS) return "person";
  return "cleared";
}

/** When the state next changes (ms from now), or null when it's final. */
export function nextChange(t: Pick<ReviewTicket, "submittedAt" | "near" | "force">, now: number): number | null {
  const since = now - t.submittedAt;
  if (since < REVIEW_MS) return REVIEW_MS - since;
  const person = (t.near || t.force?.state === "person") && t.force?.state !== "refused";
  if (person && since < 2 * REVIEW_MS) return 2 * REVIEW_MS - since;
  return null;
}

/** The status line for each state (order confirmation, /me's last order). */
export const STATUS_LINE: Record<ReviewState, string> = {
  queued: "Checking your file. Up to 2 days.",
  person: "A person is looking at this one.",
  cleared: "Cleared. Printing next.",
  refused: "We can't print this one. Nothing was charged.",
};

export const REFUSAL_LINE: Record<RefuseReason, string> = {
  logo: "It has someone else's logo.",
  artwork: "It looks like someone else's artwork.",
  person: "It shows someone who hasn't agreed.",
  explicit: "It's explicit.",
  hate: "It targets people.",
  words: "The words name a brand.",
  quality: "It didn't pass our print check.",
};
/** Any refusal without a known reason. */
export const REFUSAL_FALLBACK = REFUSAL_LINE.quality;

/** "What we won't print": the seven lines, as the rights step shows them. */
export const WONT_PRINT = [
  "Someone else's logo, brand or character.",
  "Someone else's artwork, photograph, screenshot or album cover.",
  "Famous people, or anyone who hasn't agreed.",
  "Anything sexual.",
  "Anything that targets people.",
  "Symbols of hate or terror.",
  "Claims about a named person.",
];

/** A forced state from `?review=` (refuse:<reason> or person); anything else is none. */
export function parseForce(v: string | null | undefined): Force | undefined {
  if (!v) return undefined;
  if (v === "person") return { state: "person" };
  const m = /^refuse:([a-z]+)$/.exec(v);
  return m && (REFUSE_REASONS as readonly string[]).includes(m[1]) ? { state: "refused", reason: m[1] as RefuseReason } : undefined;
}

/** The on-device review: tickets kept by the caller (the `mono-make` store), states read from the clock. */
export function localReview(tickets: { get: (id: string) => ReviewTicket | undefined; put: (t: ReviewTicket) => void }, now: () => number = Date.now): Review {
  return {
    submit(o) {
      const t: ReviewTicket = { id: `r${now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, submittedAt: now(), ...o };
      tickets.put(t);
      return t;
    },
    status(id) {
      const t = tickets.get(id);
      return t ? stateAt(t, now()) : "refused";
    },
  };
}
