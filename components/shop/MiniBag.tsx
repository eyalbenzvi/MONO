"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { useUiStore, type AddedNote } from "@/store/useUiStore";
import { SIZE_LABELS } from "@/types/shirt";

/** How long the confirmation stays (held while the pointer or focus is on it). */
const SHOW_MS = 5000;

/**
 * The one confirmation after any add to the bag (product page, Discover,
 * You, the bag's picks): a single line at the bottom, just above the tab bar
 * or the sticky button (--dock): "✓ Added · M" and Checkout (straight to the
 * delivery form). Leaves by itself after 5 s; not modal.
 */
export function MiniBag() {
  const added = useUiStore((s) => s.added);
  const [note, setNote] = useState<AddedNote | null>(null);
  const [held, setHeld] = useState(false);
  const shown = useRef<number | null>(null);

  // A new add replaces the note and starts its own timer.
  useEffect(() => {
    if (!added || shown.current === added.nonce) return;
    shown.current = added.nonce;
    setNote(added);
    setHeld(false);
  }, [added]);
  const close = useCallback(() => {
    setNote(null);
    setHeld(false);
    useUiStore.getState().clearAdded();
  }, []);
  useEffect(() => {
    if (!note || held) return;
    const t = setTimeout(close, SHOW_MS);
    return () => clearTimeout(t);
  }, [note, held, close]);

  const shirt = note ? getShirtById(note.id) : undefined;
  return (
    <AnimatePresence>
      {note && shirt && (
        <motion.div
          key={note.nonce}
          role="region"
          aria-label="Added to bag"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
          }}
          className="fixed inset-x-3 bottom-[calc(var(--dock,0px)+8px)] z-toast mx-auto flex h-14 max-w-lg items-center justify-between gap-3 rounded-control bg-white pl-4 pr-1.5 text-black shadow-2xl shadow-black"
        >
          <p className="min-w-0 truncate text-sm font-medium" aria-live="polite">
            ✓ {note.pair ? "Added the pair" : "Added"} · {SIZE_LABELS[note.size]}
          </p>
          <Link
            href="/cart/"
            onClick={() => {
              track("minibag_checkout", { id: note.id });
              useUiStore.getState().requestCheckout();
              close();
            }}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-control bg-black px-4 text-sm font-medium text-white"
          >
            Checkout
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
