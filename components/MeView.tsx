"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ShirtStrip } from "@/components/ShirtStrip";
import { getShirtById, SHIRTS } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { topPicks } from "@/lib/match";
import { shareTaste } from "@/lib/shareTaste";
import { DAILY_GOAL, archetypeOf, currentStreak, tasteLevel, today } from "@/lib/taste";
import { CART_KEY, useCartCount, useCartStore } from "@/store/cartStore";
import { TASTE_KEY, startOverWithUndo, useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { CATEGORY_LABELS, FEATURE_KEYS, FEATURE_LABELS, SIZE_LABELS, type ShirtProduct } from "@/types/shirt";

/**
 * The personal area ("You", the person icon): everything the site keeps for
 * this visitor, in one place — the taste the store has learned and why,
 * what it picks for you, Saved, the bag and the last order, your size,
 * sharing, and clearing it all. Nothing leaves the browser.
 */
export function MeView() {
  const hydrated = useUiStore((s) => s.hydrated);
  const vector = useTasteStore((s) => s.preferenceVector);
  const likedIds = useTasteStore((s) => s.likedIds);
  const { complete: calibrated } = useCalibrationProgress();
  const seen = useTasteStore((s) => s.seen.length);
  const daily = useTasteStore((s) => s.daily);
  const cartCount = useCartCount();
  const lastOrder = useCartStore((s) => s.lastOrder);
  const preferred = useCartStore((s) => s.preferredSize);
  const [sharing, setSharing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const saved = useMemo(() => [...likedIds].reverse().map(getShirtById).filter((s): s is ShirtProduct => !!s), [likedIds]);
  const picks = useMemo(() => (calibrated ? topPicks(vector, 6) : []), [calibrated, vector]);
  // Where the taste leans, by category: the categories of what was saved.
  const favourites = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of saved) n.set(s.category, (n.get(s.category) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => CATEGORY_LABELS[c as ShirtProduct["category"]]);
  }, [saved]);

  if (!hydrated) return <div className="flex-1" />;
  const { name } = archetypeOf(vector);
  const bars = [...FEATURE_KEYS].sort((a, b) => vector[b] - vector[a]).slice(0, 4);
  const streak = currentStreak(daily);
  const todayCount = daily.day === today() ? daily.count : 0;

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        {/* Taste */}
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Your taste</p>
        {calibrated ? (
          <>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{name}</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {tasteLevel(vector)} · learned from {seen} tee{seen === 1 ? "" : "s"} you rated
              {favourites.length > 0 && <> · most saved: {favourites.join(", ")}</>}
            </p>
            <ul className="mt-5 space-y-2.5">
              {bars.map((k) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-neutral-300">{FEATURE_LABELS[k]}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-white" style={{ width: `${vector[k] * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2">
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
                className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-black disabled:opacity-60"
              >
                <Icon name="share-2" className="h-4 w-4" /> {sharing ? "Making your card…" : "Share my taste"}
              </button>
              <Link href="/" className="flex h-10 items-center rounded-full px-4 text-sm font-medium text-neutral-300 ring-1 ring-white/15 hover:text-white">
                Keep swiping · {Math.min(todayCount, DAILY_GOAL)}/{DAILY_GOAL} today{streak > 1 ? ` · ${streak}-day streak` : ""}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Not learned yet</h1>
            <p className="mt-2 text-sm text-neutral-400">Swipe 10 tees and the whole shop is ranked for you.</p>
            <Link href="/" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-black">
              Start <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </>
        )}

        {picks.length > 0 && (
          <Section title="Picked for you" action={<Link href="/shop/" className="text-xs text-neutral-400 hover:text-white">All, ranked →</Link>}>
            <ShirtStrip shirts={picks} label="Picked for you" />
          </Section>
        )}

        <Section
          title={`Saved${saved.length ? ` · ${saved.length}` : ""}`}
          action={
            saved.length > 0 ? (
              <button type="button" onClick={() => useUiStore.getState().setSavedOpen(true)} className="text-xs text-neutral-400 hover:text-white">
                Manage →
              </button>
            ) : undefined
          }
        >
          {saved.length ? (
            <ShirtStrip shirts={saved.slice(0, 12)} label="Saved" />
          ) : (
            <p className="text-sm text-neutral-500">Swipe right in Discover, or tap ♥ in the shop.</p>
          )}
        </Section>

        <Section title="Bag & orders">
          <div className="divide-y divide-white/10 text-sm">
            <Row href="/cart/" label="Bag" value={cartCount ? `${cartCount} item${cartCount === 1 ? "" : "s"}` : "Empty"} />
            {lastOrder && <Row label="Last order" value={`${lastOrder.number} · ${formatPrice(lastOrder.total)}`} />}
            <Row label="Your size" value={preferred ? SIZE_LABELS[preferred] : "Picked on your first add"} />
          </div>
        </Section>

        <Section title="MONO">
          <div className="divide-y divide-white/10 text-sm">
            <Row href="/about/" label="About" value={`${SHIRTS.length.toLocaleString("en-US")} designs`} />
            <Row label="Your data" value="Stays in this browser" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {calibrated && (
              <button type="button" onClick={() => startOverWithUndo()} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-neutral-400 ring-1 ring-white/10 hover:text-white">
                <Icon name="rotate-ccw" className="h-3.5 w-3.5" /> Reset my taste
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!confirmClear) return setConfirmClear(true);
                // Everything this site stored, gone: taste, Saved, bag, last order.
                localStorage.removeItem(TASTE_KEY);
                localStorage.removeItem(CART_KEY);
                window.location.assign(window.location.pathname.replace(/me\/?$/, ""));
              }}
              onBlur={() => setConfirmClear(false)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs ring-1 ${confirmClear ? "bg-white text-black ring-white" : "text-neutral-400 ring-white/10 hover:text-white"}`}
            >
              <Icon name="trash-2" className="h-3.5 w-3.5" /> {confirmClear ? "Tap again to clear everything" : "Clear all my data"}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <span className="text-neutral-300">{label}</span>
      <span className="flex items-center gap-1 text-neutral-500">
        {value}
        {href && <Icon name="arrow-right" className="h-3.5 w-3.5" />}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="flex h-12 items-center justify-between hover:text-white">
      {inner}
    </Link>
  ) : (
    <div className="flex h-12 items-center justify-between">{inner}</div>
  );
}
