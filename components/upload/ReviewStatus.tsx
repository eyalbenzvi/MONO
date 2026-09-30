"use client";

import Link from "next/link";
import { Suspense, lazy, useEffect, useState } from "react";
import { REFUSAL_FALLBACK, REFUSAL_LINE, STATUS_LINE, nextChange, stateAt, type ReviewState, type ReviewTicket } from "@/lib/upload/review";
import { getShirtById } from "@/lib/catalog";
import { YOURS_ID } from "@/lib/upload/keys";
import { useMakeStore } from "@/store/makeStore";

const UploadMockup = lazy(() => import("@/components/upload/UploadMockup"));

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
 * its title, a short timeline of dots (checking, a person when its checks
 * came close, cleared) and one status line; a refusal shows the print, says
 * why and offers "Upload another" (bound to the same order line); a
 * cleared file of the catalogue tier offers the Open Call.
 */
export function ReviewStatus({ ticket, offer }: { ticket: ReviewTicket; offer?: (uploadId: string) => void }) {
  const state = useReviewState(ticket);
  const meta = useMakeStore((s) => s.uploads[ticket.uploadId]);
  const offered = useMakeStore((s) => !!s.offers[ticket.uploadId]);
  const reason = ticket.force?.state === "refused" ? REFUSAL_LINE[ticket.force.reason] : REFUSAL_FALLBACK;
  // The stages this file goes through: a person only when its checks came close.
  const stages: ReviewState[] = ticket.near || ticket.force?.state === "person" ? ["queued", "person", "cleared"] : ["queued", "cleared"];
  const at = state === "refused" ? 0 : stages.indexOf(state);
  return (
    <div data-review={state} className="rounded-control bg-white/[0.04] px-3 py-3 text-left text-sm ring-1 ring-white/10">
      <div className="flex gap-3">
        {state === "refused" && meta && (
          <Suspense fallback={null}>
            <div className="w-14 shrink-0 overflow-hidden rounded-lg">
              <UploadMockup shirt={getShirtById(YOURS_ID)!} uploadId={ticket.uploadId} color={meta.tees[0]} className="w-full" label={meta.title} />
            </div>
          </Suspense>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{meta?.title ?? "Your file"}</p>
          {state !== "refused" && (
            <ol className="mt-2 flex items-center gap-1.5" aria-label={`Step ${at + 1} of ${stages.length}`}>
              {stages.map((st, i) => (
                <li key={st} aria-current={i === at ? "step" : undefined} className={`h-2 w-2 rounded-full ${i === at ? "bg-white" : i < at ? "bg-neutral-500" : "bg-white/15"}`} />
              ))}
            </ol>
          )}
          <p role="status" className="mt-1.5 text-xs text-neutral-300">
            {STATUS_LINE[state]}
          </p>
          {state === "refused" && (
            <>
              <p className="mt-1 text-xs text-neutral-400">{reason}</p>
              <Link href={`/make/yours/?replace=${ticket.id}`} className="mt-2 inline-flex h-11 items-center rounded-control bg-white px-4 text-xs font-medium text-black">
                Upload another
              </Link>
            </>
          )}
          {state === "cleared" && offer && meta?.tier === "catalogue" && !offered && (
            <button type="button" onClick={() => offer(ticket.uploadId)} className="mt-1 h-11 text-xs text-neutral-400 underline underline-offset-2 hover:text-white">
              Offer to the catalogue →
            </button>
          )}
        </div>
      </div>
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
