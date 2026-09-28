"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REFUSAL_FALLBACK, REFUSAL_LINE, STATUS_LINE, nextChange, stateAt, type ReviewTicket } from "@/lib/upload/review";
import { useMakeStore } from "@/store/makeStore";

/** The clock the review states are read from, ticking only when a state is due to change. */
function useReviewState(t: ReviewTicket) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const wait = nextChange(t, now);
    if (wait === null) return;
    const id = setTimeout(() => setNow(Date.now()), wait + 50);
    return () => clearTimeout(id);
  }, [t, now]);
  return stateAt(t, now);
}

/**
 * One uploaded print's review, as the order confirmation and /me show it:
 * its title and one status line; a refusal says why and offers "Upload
 * another" (bound to the same order line); a cleared file of the catalogue
 * tier offers the Open Call (`offer`, when given).
 */
export function ReviewStatus({ ticket, offer }: { ticket: ReviewTicket; offer?: (uploadId: string) => void }) {
  const state = useReviewState(ticket);
  const meta = useMakeStore((s) => s.uploads[ticket.uploadId]);
  const offered = useMakeStore((s) => !!s.offers[ticket.uploadId]);
  const reason = ticket.force?.state === "refused" ? REFUSAL_LINE[ticket.force.reason] : REFUSAL_FALLBACK;
  return (
    <div data-review={state} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-left text-sm ring-1 ring-white/10">
      <p className="font-semibold text-white">{meta?.title ?? "Your file"}</p>
      <p role="status" className="mt-0.5 text-xs text-neutral-300">
        {STATUS_LINE[state]}
      </p>
      {state === "refused" && (
        <p className="mt-1 text-xs text-neutral-400">
          {reason}{" "}
          <Link href={`/make/yours/?replace=${ticket.id}`} className="text-neutral-200 underline underline-offset-2 hover:text-white">
            Upload another
          </Link>
        </p>
      )}
      {state === "cleared" && offer && meta?.tier === "catalogue" && !offered && (
        <button type="button" onClick={() => offer(ticket.uploadId)} className="mt-1 text-xs text-neutral-400 underline underline-offset-2 hover:text-white">
          Offer it to the catalogue ›
        </button>
      )}
    </div>
  );
}

/** The tickets of one order, newest replacement standing in for the one it replaced. */
export function useOrderTickets(order: string | undefined): ReviewTicket[] {
  const reviews = useMakeStore((s) => s.reviews);
  if (!order) return [];
  const mine = Object.values(reviews).filter((t) => t.order === order);
  const replaced = new Set(mine.flatMap((t) => (t.replaces ? [t.replaces] : [])));
  return mine.filter((t) => !replaced.has(t.id)).sort((a, b) => a.submittedAt - b.submittedAt);
}
