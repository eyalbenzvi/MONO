"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { MoreMenu } from "@/components/MoreMenu";
import { track } from "@/lib/analytics";
import { AnimatePresence, motion } from "framer-motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DAILY_GOAL, archetypeOf, currentStreak, tasteLevel, today } from "@/lib/taste";
import { startOverWithUndo, useTasteStore } from "@/store/tasteStore";
import { shareTaste } from "@/lib/shareTaste";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/types/shirt";

/**
 * "Your taste", the one place for the growth bits: the profile in words and
 * bars (the five strongest leanings) with its level, the Daily 5 and streak,
 * Share my taste; starting over is behind ⋯. Opened from the Discover strip.
 */
export function TasteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, open, onClose);
  const vector = useTasteStore((s) => s.preferenceVector);
  const daily = useTasteStore((s) => s.daily);
  const { name } = archetypeOf(vector);
  const bars = [...FEATURE_KEYS].sort((a, b) => vector[b] - vector[a]).slice(0, 5);
  const todayCount = daily.day === today() ? daily.count : 0;
  const streak = currentStreak(daily);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    if (open) track("taste_sheet_open", { level: tasteLevel(useTasteStore.getState().preferenceVector) });
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Your taste"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="no-scrollbar fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-ink-900 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 ring-1 ring-white/10"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-neutral-400">Your taste</p>
                <h2 className="text-xl font-bold tracking-tight">{name}</h2>
              </div>
              <div className="-mr-2 flex items-center">
                {/* Starting over is rare and clears Saved too: behind ⋯ (with Undo right after). */}
                <MoreMenu
                  label="More for your taste"
                  items={[
                    {
                      label: "Reset taste (clears Saved, undo right after)",
                      icon: "rotate-ccw",
                      danger: true,
                      onSelect: () => {
                        onClose();
                        startOverWithUndo();
                        // The button that opened this sheet goes with the old profile:
                        // focus lands on the strip above the card instead of the page.
                        requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-strip]")?.focus({ preventScroll: true })));
                      },
                    },
                  ]}
                />
                <button type="button" onClick={onClose} data-autofocus aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-300 hover:text-white">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-2.5">
              {bars.map((k) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-neutral-300">{FEATURE_LABELS[k]}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="meter" aria-label={FEATURE_LABELS[k]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vector[k] * 100)}>
                    <span className="block h-full rounded-full bg-white" style={{ width: `${vector[k] * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-400">
              <span className="font-semibold text-white">{tasteLevel(vector)}</span> — every swipe sharpens it.
            </p>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
              <div>
                <p className="text-sm font-semibold">Daily 5</p>
                <p className="text-xs text-neutral-400">
                  Swipe five new tees a day{streak > 0 && <span className="whitespace-nowrap"> · {streak}-day streak</span>}
                </p>
              </div>
              <span className="ml-3 shrink-0 font-mono text-sm">
                {Math.min(todayCount, DAILY_GOAL)}/{DAILY_GOAL}
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                setSharing(true);
                try {
                  await shareTaste(vector);
                } finally {
                  setSharing(false);
                }
              }}
              disabled={sharing}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black disabled:opacity-60"
            >
              <Icon name="share-2" className="h-4 w-4" /> {sharing ? "Making your card…" : "Share my taste"}
            </button>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
