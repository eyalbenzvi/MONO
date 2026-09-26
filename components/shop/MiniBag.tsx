"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG } from "@/components/ui";
import { getShirtById } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useUiStore, type AddedNote } from "@/store/useUiStore";

const SHOW_MS = 2500;

/**
 * The one confirmation after any add to the bag (product page, quick add on
 * a card, Discover, Saved): a single row under the header — the tee,
 * "Added · M", Undo and "View bag". Leaves by itself after 2.5 s, not while
 * the pointer or focus is on it. Not modal, and up top so it never covers
 * the sizes, the buy bar or the card being rated.
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
  const undo = () => {
    if (note) useCartStore.getState().undoAdd(note);
    close();
  };

  const shirt = note ? getShirtById(note.id) : undefined;
  return (
    <AnimatePresence>
      {note && shirt && (
        <motion.div
          key={note.nonce}
          role="region"
          aria-label="Added to bag"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
          }}
          className="fixed inset-x-3 top-[calc(var(--header-h)+8px)] z-[45] flex items-center gap-2 rounded-2xl bg-ink-900/95 p-2 pr-1 max-[399px]:pl-3 shadow-2xl shadow-black ring-1 ring-white/15 backdrop-blur-md md:left-auto md:right-6 md:w-[380px]"
        >
          <div className={`w-10 shrink-0 rounded-lg p-0.5 max-[399px]:hidden ${STAGE_BG}`}>
            <TeeMockup shirt={shirt} color={note.color} shadow={false} className="w-full" />
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" aria-live="polite">
            <Check className="-mt-0.5 mr-1 inline h-4 w-4" strokeWidth={3} />
            {note.pair ? "Added the pair" : "Added"} · {note.size}
          </p>
          <button type="button" onClick={undo} className="h-10 shrink-0 px-2 text-xs font-semibold text-neutral-300 underline underline-offset-4 hover:text-white">
            Undo
          </button>
          <Link href="/cart/" onClick={close} className="flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-sm font-bold text-black">
            View bag
          </Link>
          <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-8 shrink-0 items-center justify-center text-neutral-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
