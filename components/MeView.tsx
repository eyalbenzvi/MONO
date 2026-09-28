"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ShirtStrip } from "@/components/ShirtStrip";
import { NeedDots } from "@/components/NeedDots";
import { getShirtById, productHref } from "@/lib/catalog";
import { cartTotals } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { topPicks } from "@/lib/match";
import { shareTaste } from "@/lib/shareTaste";
import { archetypeOf } from "@/lib/taste";
import { MAKE_KEY } from "@/lib/upload/designs";
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
                  <Link href={productHref(o.id)} className="truncate font-semibold text-white underline-offset-2 hover:underline">
                    {o.title}
                  </Link>
                ) : (
                  <span className="truncate font-semibold text-white">{o.title}</span>
                )}
                <button type="button" onClick={() => useMakeStore.getState().withdraw(o.uploadId)} className="shrink-0 text-xs text-neutral-400 underline underline-offset-2 hover:text-white">
                  Withdraw
                </button>
              </div>
              <p className="mt-0.5 text-xs text-neutral-400">{OFFER_STATE_LINE[state]}</p>
              {state === "accepted" && <p className="text-xs text-neutral-500">{SALES_LINE}</p>}
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
import { CART_KEY, useCartCount, useCartStore } from "@/store/cartStore";
import { TASTE_KEY, startOverWithUndo, useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { SIZE_LABELS, type ShirtProduct } from "@/types/shirt";

/**
 * The personal area ("You", the person icon): everything the site keeps for
 * this visitor, set like the About page — the taste the store has learned,
 * real counts, what it picks for you, Saved, the bag and last order, your
 * size, and (quietly, at the end) resetting or clearing it all. Nothing
 * leaves the browser.
 */
export function MeView() {
  const hydrated = useUiStore((s) => s.hydrated);
  const vector = useTasteStore((s) => s.preferenceVector);
  const likedIds = useTasteStore((s) => s.likedIds);
  const { complete: calibrated, phase } = useCalibrationProgress();
  const seen = useTasteStore((s) => s.seen.length);
  const cartCount = useCartCount();
  const lastOrder = useCartStore((s) => s.lastOrder);
  const cart = useCartStore((s) => s.cart);
  const preferred = useCartStore((s) => s.preferredSize);
  const [sharing, setSharing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const saved = useMemo(() => [...likedIds].reverse().map(getShirtById).filter((s): s is ShirtProduct => !!s), [likedIds]);
  const picks = useMemo(() => (calibrated ? topPicks(vector, 6) : []), [calibrated, vector]);

  if (!hydrated) return <div className="flex-1" />;
  // Set like the About page: a plain first line, the heavy word on the one inverted bar.
  const name = archetypeOf(vector).name;
  // Known: the archetype. After the test without enough likes and passes (or
  // after unsaving below them): not enough to go on. Before it: not yet.
  const [lead, word] = calibrated ? (name.startsWith("The ") ? ["The", name.slice(4)] : ["", name]) : phase === "more" ? ["Not", "enough."] : ["Not", "yet."];
  // Real counts only (zero shows as 0).
  const facts: [number, string][] = [
    [seen, "rated"],
    [saved.length, "saved"],
    [cartCount, "in bag"],
  ];

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-clip">
      <div className="mx-auto max-w-[560px] px-5 pb-16 pt-8">
        <p className={LABEL}>Your taste</p>
        {/* Sized to its longest word, so a long name (RETROFUTURIST) still fits the screen. */}
        <h1 className="mt-4 font-black uppercase leading-[0.95] tracking-[0.08em]" style={{ fontSize: fitFont(Math.max(...`${lead} ${word}`.split(" ").map((w) => w.length))) }}>
          {lead && <span className="block">{lead}</span>}
          <span className="-mx-2 my-1 block w-fit bg-white px-2 text-black">{word}</span>
        </h1>
        {phase === "more" && <NeedDots className="mt-4 -ml-1" />}

        <dl className="mt-8 grid grid-cols-3 border-y border-white/15">
          {facts.map(([n, label], i) => (
            <div key={label} className={`py-5 ${i ? "border-l border-white/15 pl-4" : ""}`}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-mono text-2xl font-bold tabular-nums text-white">{n}</dd>
              <dd aria-hidden className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                {label}
              </dd>
            </div>
          ))}
        </dl>

        {/* A bag with something in it: checkout is the first thing here, one tap to the delivery form. */}
        {cartCount > 0 && (
          <Link href="/cart/" onClick={() => useUiStore.getState().requestCheckout()} className={CTA}>
            Checkout · {cartCount} {cartCount === 1 ? "tee" : "tees"} · {formatPrice(cartTotals(cart).total)}
          </Link>
        )}
        {calibrated ? (
          <button
            type="button"
            disabled={sharing}
            onClick={async () => {
              setSharing(true);
              try {
                await shareTaste(vector);
              } finally {
                setSharing(false);
              }
            }}
            className={cartCount > 0 ? CTA_QUIET : CTA}
          >
            {sharing ? "Making card…" : "Share my taste"}
          </button>
        ) : (
          <Link href="/" className={cartCount > 0 ? CTA_QUIET : CTA}>
            {phase === "more" ? "Keep swiping" : "Start swiping"}
          </Link>
        )}

        {picks.length > 0 && (
          <Section title="Picked for you" action={<SectionLink href="/shop/" label="All" aria="All tees, ranked for you" />}>
            <ShirtStrip shirts={picks} label="Picked for you" quickAdd source="me" />
          </Section>
        )}

        {/* Saved stays while it holds anything: it may be what's being edited. */}
        {(calibrated || saved.length > 0) && (
          <Section
            title="Saved"
            action={
              saved.length > 0 ? (
                <button type="button" onClick={() => useUiStore.getState().setSavedOpen(true)} aria-label="Edit saved" className={ACTION}>
                  Edit
                </button>
              ) : undefined
            }
          >
            {saved.length ? <ShirtStrip shirts={saved.slice(0, 12)} label="Saved" quickAdd source="saved" /> : <p className="text-sm text-neutral-500">Nothing saved yet.</p>}
          </Section>
        )}

        <YourOffers />

        <Section title="Account">
          <div className="border-t border-white/15">
            <Row href="/cart/" label="Bag" value={String(cartCount)} />
            {lastOrder && <Row label="Last order" value={`${lastOrder.number} · ${formatPrice(lastOrder.total)}`} />}
            {lastOrder && <LastOrderUploads order={lastOrder.number} />}
            {preferred && <Row label="Size" value={SIZE_LABELS[preferred]} />}
            <Row href="/about/" label="About" />
          </div>
        </Section>

        {/* The quiet end: destructive actions as plain text. */}
        <div className="mt-10 flex gap-6" aria-live="polite">
          {seen > 0 && (
            <button type="button" onClick={() => startOverWithUndo()} className={QUIET}>
              Reset taste
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (!confirmClear) return setConfirmClear(true);
              // Everything this site stored, gone: taste, Saved, bag, last order, and uploaded files (IndexedDB too).
              localStorage.removeItem(TASTE_KEY);
              localStorage.removeItem(CART_KEY);
              localStorage.removeItem(MAKE_KEY);
              await import("@/lib/upload/store").then((m) => (m.available() ? m.clearUploads() : undefined)).catch(() => {});
              window.location.assign(window.location.pathname.replace(/me\/?$/, ""));
            }}
            onBlur={() => setConfirmClear(false)}
            className={`${QUIET} ${confirmClear ? "text-white" : ""}`}
          >
            {confirmClear ? "Tap again" : "Clear data"}
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-600">Saved in this browser only.</p>
      </div>
    </div>
  );
}

/** Heavy caps with wide tracking run about 0.85em a letter: the largest size (to 3.75rem) that fits `chars` in the column. */
const fitFont = (chars: number) => `min(3.75rem, 11vw, calc((min(100vw, 560px) - 3.5rem) / ${(chars * 0.85).toFixed(2)}))`;

const LABEL = "text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500";
const ACTION = "text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-white";
const QUIET = "text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500 underline-offset-4 hover:text-white hover:underline";
const CTA =
  "mt-8 flex h-14 w-full items-center justify-center rounded-full bg-white text-sm font-black uppercase tracking-[0.2em] text-black disabled:opacity-60";
/** The same action, second to Checkout when the bag holds something. */
const CTA_QUIET =
  "mt-3 flex h-12 w-full items-center justify-center rounded-full text-xs font-bold uppercase tracking-[0.2em] text-neutral-300 ring-1 ring-white/20 hover:text-white disabled:opacity-60";

function SectionLink({ href, label, aria }: { href: string; label: string; aria: string }) {
  return (
    <Link href={href} aria-label={aria} className={ACTION}>
      {label}
    </Link>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-white/15 pt-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className={LABEL}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, href }: { label: string; value?: string; href?: string }) {
  const inner = (
    <>
      <span className="text-sm text-white">{label}</span>
      <span className="flex items-center gap-2 font-mono text-sm tabular-nums text-neutral-500">
        {value}
        {href && <Icon name="arrow-right" className="h-4 w-4 text-neutral-500" />}
      </span>
    </>
  );
  const cls = "flex h-14 items-center justify-between border-b border-white/15";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-white/[0.02]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
