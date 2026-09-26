"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { ShirtStrip } from "@/components/ShirtStrip";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { archetypeOf, tasteOverlap } from "@/lib/taste";
import { topPicks } from "@/lib/match";
import { TraitChips } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { topTraits } from "@/lib/recommendation";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

/**
 * Shown once, when the taste test is finished: the hand-off into the shop.
 * Just the result — archetype, three traits, three tees — one way on
 * ("See my shop") and a quiet "Keep swiping" (sharing your taste is in Your taste).
 */
export function CalibrationComplete() {
  const hydrated = useUiStore((s) => s.hydrated);
  const acknowledged = useTasteStore((s) => s.calibrationAcknowledged);
  const acknowledge = useTasteStore((s) => s.acknowledgeCalibration);
  const vector = useTasteStore((s) => s.preferenceVector);
  const { complete } = useCalibrationProgress();
  const open = hydrated && complete && !acknowledged;
  const sheet = useRef<HTMLDivElement>(null);
  const close = useCallback(() => acknowledge(), [acknowledge]);
  useFocusTrap(sheet, open, close);

  const picks = useMemo(() => (open ? topPicks(vector, 3) : []), [open, vector]);
  const traits = open ? topTraits(vector, 3) : [];
  const archetype = archetypeOf(vector);
  const friend = useUiStore((s) => s.friendTaste);


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            ref={sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calib-title"
            className="no-scrollbar max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-ink-900 p-5 !pb-0 shadow-2xl max-[339px]:p-4"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.25 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                  <Burst /> Taste test complete
                </p>
                <h2 id="calib-title" className="mt-1 text-2xl font-bold tracking-tight">
                  You&apos;re {archetype.name}
                </h2>
              </div>
            </div>
            <TraitChips keys={traits} className="mt-3" stagger />

            <div className="mt-4">
              <ShirtStrip shirts={picks} layout="grid" names={false} label="Top picks for you" onOpen={close} />
            </div>

            {friend && (
              <p className="mt-4 text-sm text-neutral-300" role="status">
                <span className="font-semibold text-white">{tasteOverlap(vector, friend)}% alike</span> with your friend, {archetypeOf(friend).name}
              </p>
            )}

            {/* The way out stays in reach on short screens (landscape, 280 px). */}
            {/* The dialog has no bottom padding (a sticky footer would stop above
                it and let content show through); the footer carries it. Phones
                sideways: the two side by side. */}
            <div className="sticky bottom-0 -mx-5 mt-4 grid gap-1 bg-ink-900 px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 max-[339px]:-mx-4 max-[339px]:px-4 [@media(max-height:500px)]:grid-cols-2">
              <Link
                href="/shop/"
                onClick={close}
                data-autofocus
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
              >
                See my shop <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
              <button type="button" onClick={close} className="h-10 rounded-full text-sm font-medium text-neutral-400 underline-offset-4 hover:text-white hover:underline">
                Keep swiping
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Sparkles icon with a one-time monochrome burst of 12 short rays. */
function Burst() {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      <Icon name="sparkles" className="h-4 w-4" />
      {!reduce &&
        Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              aria-hidden
              className="absolute left-1/2 top-1/2 h-px w-2 origin-left bg-white"
              style={{ rotate: `${(angle * 180) / Math.PI}deg` }}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{ x: Math.cos(angle) * 16, y: Math.sin(angle) * 16, opacity: [0, 1, 0] }}
              transition={{ duration: 0.4, delay: 0.45, ease: "easeOut" }}
            />
          );
        })}
    </span>
  );
}
