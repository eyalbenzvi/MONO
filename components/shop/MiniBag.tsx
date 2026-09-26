"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG } from "@/components/ui";
import { productHref } from "@/lib/catalog";
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
          className="fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),12px)+76px)] z-40 rounded-3xl bg-ink-900/95 p-3 shadow-2xl shadow-black ring-1 ring-white/15 backdrop-blur-md md:inset-x-auto md:bottom-6 md:right-6 md:w-[360px]"
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 shrink-0 rounded-xl p-1 ${STAGE_BG}`}>
              <TeeMockup shirt={shirt} color={note.color} shadow={false} className="w-full" />
            </div>
            <p className="min-w-0 flex-1 text-sm font-semibold" aria-live="polite">
              <Check className="-mt-0.5 mr-1 inline h-4 w-4" strokeWidth={3} />
              {note.pair ? "Added the pair" : "Added"} · {note.size}
            </p>
            <Link href="/cart/" className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-black">
              Checkout <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="-mr-1 flex h-10 w-8 shrink-0 items-center justify-center text-neutral-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {pairs.length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-xs text-neutral-400">Pairs well with</p>
              <ul className="grid grid-cols-3 gap-2">
                {pairs.map((p) => (
                  <li key={p.id} className="flex flex-col items-center gap-1.5">
                    <Link href={productHref(p.id)} className={`w-full rounded-xl p-1.5 ${STAGE_BG}`} aria-label={p.title}>
                      <TeeMockup shirt={p} shadow={false} className="w-full" />
                    </Link>
                    <QuickAdd shirt={p} />
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
