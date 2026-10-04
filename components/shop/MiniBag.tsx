"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { useUiStore, type AddedNote } from "@/store/useUiStore";
import { SWIPE_AWAY, exitFor, swipedAway } from "@/lib/swipeAway";
import { TeeMockup } from "@/components/TeeMockup";
import { SIZES } from "@/lib/images";
import { COLOR_LABELS, SIZE_LABELS } from "@/types/shirt";

/** How long the confirmation stays (held while the pointer or focus is on it). */
const SHOW_MS = 5000;

/**
 * The one confirmation after any add to the bag (product page, Discover,
 * You, the bag's picks): a white bar at the bottom, just above the tab bar or
 * the sticky button (--dock), that names what went in: the tee's picture (a
 * catalogue design; a personalised or uploaded print has none to show here),
 * "✓ Added" with its title, its colour and size ("Black · M", or "Black + White
 * · M" for the pair), and Checkout (straight to the delivery form). Leaves by
 * itself after 5 s, or swiped left (lib/swipeAway); not modal.
 */
export function MiniBag() {
  const added = useUiStore((s) => s.added);
  const [note, setNote] = useState<AddedNote | null>(null);
  const [held, setHeld] = useState(false);
  const [swiped, setSwiped] = useState(false);
  const shown = useRef<number | null>(null);

  // A new add replaces the note and starts its own timer.
  useEffect(() => {
    if (!added || shown.current === added.nonce) return;
    shown.current = added.nonce;
    setNote(added);
    setHeld(false);
    setSwiped(false);
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
          exit={exitFor(swiped)}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          {...SWIPE_AWAY}
          onDragEnd={(_, info) => {
            if (!swipedAway(info)) return;
            setSwiped(true);
            close();
          }}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
          }}
          className="fixed inset-x-3 bottom-[max(calc(var(--dock-bag,0px)+8px),calc(env(safe-area-inset-bottom)+8px))] z-toast mx-auto flex h-16 max-w-lg items-center justify-between gap-3 rounded-control bg-white pl-2 pr-1.5 text-black shadow-2xl shadow-black"
        >
          <div className="flex min-w-0 items-center gap-3" aria-live="polite">
            {!note.custom && !note.upload ? (
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded-[3px] bg-neutral-200" aria-hidden>
                <TeeMockup shirt={shirt} color={note.color} sizes={SIZES.thumb} className="h-full w-full object-cover" />
              </div>
            ) : (
              <span className="w-1" aria-hidden />
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">
                ✓ {note.pair ? "Added the pair" : "Added"}
                <span className="sr-only">:</span> <span className="font-normal">{shirt.title}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-600">
                {note.pair && note.added.length > 1 ? note.added.map((c) => COLOR_LABELS[c]).join(" + ") : COLOR_LABELS[note.color]} · {SIZE_LABELS[note.size]}
              </p>
            </div>
          </div>
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
