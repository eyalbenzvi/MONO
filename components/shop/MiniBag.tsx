"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG } from "@/components/ui";
import { productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { useUiStore } from "@/store/useUiStore";
import type { ShirtProduct } from "@/types/shirt";

const SHOW_MS = 2500;

/**
 * Small bottom sheet after "Add to bag" on the product page: what was added,
 * the way to checkout, and a few prints that pair well (quick add in the
 * remembered size). Leaves by itself after 2.5 s — not while the pointer or
 * focus is on it. Not modal: the page stays usable underneath.
 */
export function MiniBag({ shirt, similar }: { shirt: ShirtProduct; similar: ShirtProduct[] }) {
  const added = useUiStore((s) => (s.added?.id === shirt.id ? s.added : null));
  // Kept locally: a quick add from inside the sheet replaces the store's note.
  const [note, setNote] = useState<typeof added>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  const shown = useRef<number | null>(null);

  // Only adds made on this page (not a restored note from earlier).
  useEffect(() => {
    if (!added || shown.current === added.nonce) return;
    shown.current = added.nonce;
    setNote(added);
    setOpen(added.nonce);
  }, [added]);
  useEffect(() => {
    if (open === null || held) return;
    const t = setTimeout(() => setOpen(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [open, held]);
  // Leaving the page closes it.
  useEffect(() => () => useUiStore.getState().clearAdded(), []);

  const pairs = similar.slice(0, 3);
  return (
    <AnimatePresence>
      {open !== null && note && (
        <motion.div
          key={open}
          role="region"
          aria-label="Added to bag"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
          }}
          // Above the phone's sticky buy bar; a corner card on desktop.
          // Phones: above the sticky buy bar. Wider screens: a card under the
          // bag icon (top right), clear of the buy buttons and details.
          className="fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),12px)+76px)] z-40 rounded-3xl bg-ink-900/95 p-3 shadow-2xl shadow-black ring-1 ring-white/15 backdrop-blur-md md:inset-x-auto md:bottom-auto md:right-6 md:top-[calc(var(--header-h)+8px)] md:w-[360px] md:max-h-[calc(100dvh-var(--header-h)-16px)] md:overflow-y-auto"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className={`w-12 shrink-0 rounded-xl p-1 ${STAGE_BG}`}>
              <TeeMockup shirt={shirt} color={note.color} shadow={false} className="w-full" />
            </div>
            <p className="min-w-0 flex-1 whitespace-nowrap text-sm font-semibold" aria-live="polite">
              <Check className="-mt-0.5 mr-1 inline h-4 w-4" strokeWidth={3} />
              {note.pair ? "Added the pair" : "Added"} · {note.size}
            </p>
            {/* Below 400 px Checkout gets its own full-width row. */}
            <Link href="/cart/" className="order-last flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-black max-[399px]:w-full min-[400px]:order-none">
              Checkout <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="-mr-1 flex h-10 w-8 shrink-0 items-center justify-center text-neutral-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {pairs.length > 0 && (
            // Short screens (phones sideways): just the confirmation.
            <div className="mt-3 border-t border-white/10 pt-3 [@media(max-height:500px)]:hidden">
              <p className="mb-2 text-xs text-neutral-400">Pairs well with</p>
              <ul className="grid grid-cols-3 gap-2">
                {pairs.map((p) => (
                  <li key={p.id} className="flex min-w-0 flex-col items-center gap-1.5">
                    <Link href={productHref(p.id)} className={`w-full rounded-xl p-1.5 ${STAGE_BG}`} aria-label={`${p.title}, ${formatPrice(p.price)}`}>
                      <TeeMockup shirt={p} shadow={false} className="w-full" />
                    </Link>
                    <p className="w-full truncate text-center text-xs text-neutral-300">{p.title}</p>
                    <QuickAdd shirt={p} compact />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
