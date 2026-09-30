"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { NeedLine } from "@/components/NeedLine";
import { SavedList } from "@/components/SavedList";
import { TasteSummary } from "@/components/TasteSummary";
import { BUTTON_PRIMARY, TEXT_ACTION } from "@/components/ui";
import { getShirtById, productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { MAKE_KEY } from "@/lib/upload/keys";
import { OFFER_STATE_LINE, SALES_LINE, offerState } from "@/lib/upload/openCall";
import { useMakeStore } from "@/store/makeStore";
import { ReviewStatus, useOrderTickets } from "@/components/upload/ReviewStatus";

/** "Your offers": each upload offered to the Open Call, its state, and Withdraw (on this device only). */
function YourOffers() {
  const offers = useMakeStore((s) => s.offers);
  const [now, setNow] = useState(() => Date.now());
  const list = Object.values(offers).filter((o) => !o.withdrawn).sort((a, b) => b.submittedAt - a.submittedAt);
  const pending = list.some((o) => offerState(o, now) === "offered");
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pending]);
  if (!list.length) return null;
  return (
    <Section title="Your offers">
      <ul className="border-t border-white/15" data-offers>
        {list.map((o) => {
          const state = offerState(o, now);
          return (
            <li key={o.uploadId} className="border-b border-white/15 py-3 text-sm" data-offer={state}>
              <div className="flex items-baseline justify-between gap-3">
                {state === "accepted" ? (
                  <Link href={productHref(o.id)} className="truncate font-medium text-white underline-offset-2 hover:underline">
                    {o.title}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-white">{o.title}</span>
                )}
                <button type="button" onClick={() => useMakeStore.getState().withdraw(o.uploadId)} className="shrink-0 text-xs text-neutral-400 underline underline-offset-2 hover:text-white">
                  Withdraw
                </button>
              </div>
              <p className="mt-0.5 text-xs text-neutral-400">{OFFER_STATE_LINE[state]}</p>
              {state === "accepted" && <p className="text-xs text-neutral-400">{SALES_LINE}</p>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** The last order's uploaded prints and their (simulated) review. */
function LastOrderUploads({ order }: { order: string }) {
  const tickets = useOrderTickets(order);
  if (!tickets.length) return null;
  return (
    <div className="space-y-2 py-2" data-upload-reviews>
      {tickets.map((t) => (
        <ReviewStatus key={t.id} ticket={t} offer={(id) => useUiStore.getState().openOffer(id)} />
      ))}
    </div>
  );
}
import { CART_KEY, useCartStore } from "@/store/cartStore";
import { TASTE_KEY, startOverWithUndo, useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { SIZE_LABELS, type ShirtProduct } from "@/types/shirt";

/**
 * You: everything the site keeps for this visitor, on one page in three
 * parts — Your taste (the one place to reset it), Saved in full, and orders
 * and settings. Nothing leaves the browser.
 */
export function MeView() {
  const hydrated = useUiStore((s) => s.hydrated);
  const vector = useTasteStore((s) => s.preferenceVector);
  const likedIds = useTasteStore((s) => s.likedIds);
  const { complete: calibrated, phase } = useCalibrationProgress();
  const seen = useTasteStore((s) => s.seen.length);
  const lastOrder = useCartStore((s) => s.lastOrder);
  const preferred = useCartStore((s) => s.preferredSize);
  const [confirmClear, setConfirmClear] = useState(false);
  // Reset takes its own button away: focus goes to the section's heading, not the body.
  const tasteHeading = useRef<HTMLHeadingElement>(null);
  const reset = () => {
    startOverWithUndo();
    requestAnimationFrame(() => tasteHeading.current?.focus());
  };

  const saved = useMemo(() => [...likedIds].reverse().map(getShirtById).filter((s): s is ShirtProduct => !!s), [likedIds]);

  if (!hydrated) return <div className="flex-1" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-clip">
      <div className="mx-auto max-w-[560px] px-5 pb-16 pt-6">
        <h1 className="text-[28px] font-medium leading-tight">You</h1>

        <Section title="Your taste" headingRef={tasteHeading}>
          {calibrated ? (
            <TasteSummary vector={vector} heading="h3" eyebrow={false}>
              <button type="button" onClick={reset} className={`${TEXT_ACTION} justify-start`}>
                Reset taste
              </button>
            </TasteSummary>
          ) : phase === "more" ? (
            <NeedLine />
          ) : (
            <>
              <p className="text-[20px] font-medium">Not yet.</p>
              <p className="mt-1 text-sm text-muted">Swipe ten tees and we&rsquo;ll learn it.</p>
              {seen > 0 && (
                <button type="button" onClick={reset} className={`${TEXT_ACTION} mt-2 justify-start`}>
                  Reset taste
                </button>
              )}
            </>
          )}
        </Section>

        {/* Saved stays while it holds anything: it may be what's being edited. */}
        <Section title="Saved">
          <SavedList items={saved} />
        </Section>

        <YourOffers />

        <Section title="Orders & settings">
          <div className="border-t border-white/10">
            {lastOrder && <Row label="Last order" value={`${lastOrder.number} · ${formatPrice(lastOrder.total)}`} mono />}
            {lastOrder && <LastOrderUploads order={lastOrder.number} />}
            {preferred && <Row label="Size" value={SIZE_LABELS[preferred]} />}
            <Row label="About" href="/about/" />
          </div>
          {/* The quiet end: clearing everything, as plain text, with a second tap. */}
          <div className="mt-4" aria-live="polite">
            <button
              type="button"
              onClick={async () => {
                if (!confirmClear) return setConfirmClear(true);
                // Everything this site stored, gone: taste, Saved, bag, last order, searches, and uploaded files (IndexedDB too).
                for (const k of [TASTE_KEY, CART_KEY, MAKE_KEY]) localStorage.removeItem(k);
                for (const store of [localStorage, sessionStorage]) for (const k of Object.keys(store)) if (k.startsWith("mono-")) store.removeItem(k);
                await import("@/lib/upload/store").then((m) => (m.available() ? m.clearUploads() : undefined)).catch(() => {});
                window.location.assign(window.location.pathname.replace(/me\/?$/, ""));
              }}
              onBlur={() => setConfirmClear(false)}
              className={`${TEXT_ACTION} justify-start ${confirmClear ? "text-white" : ""}`}
            >
              {confirmClear ? "Tap again" : "Clear data"}
            </button>
            <p className="text-xs text-muted">Saved in this browser only.</p>
          </div>
        </Section>
      </div>
    </div>
      {/* Until the taste is known, the page's one action, within the thumb (above the tab bar). */}
      {!calibrated && (
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <Link href="/" className={`mx-auto w-full max-w-[560px] ${BUTTON_PRIMARY}`}>
            {phase === "more" ? "Keep swiping" : "Start the taste test"}
          </Link>
        </div>
      )}
    </div>
  );
}

function Section({ title, headingRef, children }: { title: string; headingRef?: React.Ref<HTMLHeadingElement>; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="mb-4 text-xs text-muted outline-none">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, href, mono = false }: { label: string; value?: string; href?: string; mono?: boolean }) {
  const inner = (
    <>
      <span className="text-sm text-white">{label}</span>
      <span className={`flex items-center gap-2 text-sm tabular-nums text-muted ${mono ? "font-mono text-xs" : ""}`}>
        {value}
        {href && <Icon name="arrow-right" className="h-4 w-4" />}
      </span>
    </>
  );
  const cls = "flex h-14 items-center justify-between border-b border-white/10";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-white/[0.02]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
