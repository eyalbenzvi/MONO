"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ActionButtons } from "@/components/ActionButtons";
import { CalibrationComplete } from "@/components/CalibrationComplete";
import { CardStack } from "@/components/CardStack";
import { tierOf } from "@/lib/match";
import { biggestShift, profileSharpness } from "@/lib/recommendation";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { SHIRTS } from "@/lib/catalog";
import { archetypeOf, tasteLevel } from "@/lib/taste";
import { TasteSheet } from "@/components/TasteSheet";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { FEATURE_LABELS } from "@/types/shirt";

/**
 * Phones held sideways hide the strip above the card, so its essentials sit
 * atop the button column: the taste-test counter, then "Your taste".
 */
function SidewaysStatus() {
  const { done, total, complete } = useCalibrationProgress();
  const [sheet, setSheet] = useState(false);
  return (
    <div className="hidden justify-center pb-1 pr-[max(env(safe-area-inset-right),16px)] sideways:flex">
      {complete ? (
        <>
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            aria-label="Your taste profile"
            className="flex h-10 items-center rounded-full px-3 text-xs font-semibold text-neutral-300 ring-1 ring-white/15 hover:text-white"
          >
            Your taste
          </button>
          <TasteSheet open={sheet} onClose={() => setSheet(false)} />
        </>
      ) : (
        <span className="font-mono text-xs text-neutral-300" aria-label={`Taste test: card ${Math.min(done + 1, total)} of ${total}`}>
          {Math.min(done + 1, total)}/{total}
        </span>
      )}
    </div>
  );
}

/**
 * Desktop (≥ 1024 px), until the taste test is done: a narrow column beside
 * the card saying what's going on. Phones get the one-line goal instead.
 */
function HowItWorks() {
  const { complete } = useCalibrationProgress();
  if (complete) return null;
  return (
    <aside className="pointer-events-none absolute left-[max(2rem,calc(50%-210px-22rem))] top-1/3 hidden w-72 lg:block">
      <h2 className="text-xl font-bold tracking-tight">{CALIBRATION_TOTAL} swipes → your shop.</h2>
      <ul className="mt-3 space-y-2 text-sm text-neutral-300">
        <li>→ Like what you&apos;d wear, ← pass on the rest.</li>
        <li>Every swipe teaches MONO your taste in prints.</li>
        <li>Then the shop ranks all {SHIRTS.length.toLocaleString("en-US")} designs for you.</li>
      </ul>
    </aside>
  );
}

/** The top strip keeps one fixed height across phases so the card never jumps. */
const STRIP = "mx-auto flex h-11 w-full max-w-[420px] shrink-0 flex-col justify-center px-4 outline-none";

export function DiscoverPage() {
  const hydrated = useHydrated();

  // Keyboard shortcuts (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Any open dialog (zoom, share, taste-test screen) owns the keyboard:
      // Escape there closes only that dialog, never the card flip. Read from
      // state, not the DOM: a closing dialog stays in the DOM while it
      // animates out, and must not swallow the next key.
      if (useUiStore.getState().dialogs > 0) return;
      // Leave browser / OS shortcuts alone (⌘Z, Ctrl+R, Alt+←…).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Keys typed into a field, or pressed on a focused control, belong to
      // that control: Space/Backspace on a button must not swipe or undo.
      // Escape never activates a control, so it closes the details from anywhere.
      if (e.key === "Escape") {
        if (useUiStore.getState().isFlipped) useUiStore.getState().toggleFlip(false);
        return;
      }
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (t instanceof Element && t.closest('button, a, [role="button"], [role="radio"], [role="tab"], [contenteditable=""], [contenteditable="true"]')) return;
      const { requestSwipe, undoLast } = useTasteStore.getState();
      const { toggleFlip } = useUiStore.getState();
      if (e.key === "ArrowRight") requestSwipe("like");
      else if (e.key === "ArrowLeft") requestSwipe("dislike");
      else if (e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Phones held sideways (the `sideways` variant): the strip hides and the
  // buttons stand in a column beside the card, which keeps the height.
  return (
    <div className="flex min-h-0 flex-1 flex-col sideways:flex-row">
      <div className="sideways:hidden">{hydrated ? <TopStrip /> : <div className={STRIP} />}</div>
      {/* In the static HTML too (what the page is, for crawlers and a first paint). */}
      <HowItWorks />
      <section className="relative min-h-0 flex-1 px-4 pb-1 pt-1 sideways:py-2">
        {hydrated ? <CardStack /> : <CardSkeleton />}
      </section>
      {/* `contents` in portrait (no box); sideways, a column: status + buttons. */}
      <div className="contents sideways:flex sideways:flex-col sideways:justify-center">
        {hydrated && <SidewaysStatus />}
        <ActionButtons />
      </div>
      <CalibrationComplete />
    </div>
  );
}

function TopStrip() {
  const { done, total, complete } = useCalibrationProgress();
  const onboardingSeen = useTasteStore((s) => s.onboardingSeen);
  const vector = useTasteStore((s) => s.preferenceVector);
  const friend = useUiStore((s) => s.friendTaste);
  const [sheet, setSheet] = useState(false);

  if (complete) {
    const sharp = profileSharpness(vector);
    // A new level is shown quietly: the word here changes (no toast).
    const word = tasteLevel(vector);
    return (
      <div className={STRIP} data-strip tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            aria-label={`Your taste: ${word}. Open your taste profile`}
            className="-ml-1 flex h-10 min-w-0 items-center gap-2 rounded-full px-1 text-neutral-400 hover:text-white"
          >
            <span className="max-[339px]:hidden">Your taste</span>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <motion.span
                className="block h-full rounded-full bg-white"
                initial={false}
                animate={{ width: `${Math.max(8, sharp * 100)}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 28 }}
              />
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={word} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="truncate font-medium text-white">
                {word}
              </motion.span>
            </AnimatePresence>
          </button>
          <TasteSheet open={sheet} onClose={() => setSheet(false)} />
        </div>
      </div>
    );
  }

  // The one progress indicator: a thin bar (which card of the taste test is on screen).
  const current = Math.min(done + 1, total);
  return (
    <div className={STRIP} data-strip tabIndex={-1}>
      {/* Minimal: just the bar (a friend's link says whose taste this is, once). */}
      {friend && !onboardingSeen && (
        <p className="h-4 truncate text-center text-[13px] font-medium leading-4 text-white">
          Your friend is {archetypeOf(friend).name} — swipe {CALIBRATION_TOTAL} to compare
        </p>
      )}
      <div className="mt-1 flex items-center">
        <div
          className="flex flex-1 gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={`Card ${current} of ${total}`}
          aria-label="Taste test progress"
        >
          {Array.from({ length: total }, (_, i) => (
            <motion.span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-white" : "bg-white/15"}`}
              animate={i === done ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
              transition={i === done ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
              style={i === done ? { backgroundColor: "rgba(255,255,255,0.55)" } : undefined}
            />
          ))}
        </div>

      </div>
    </div>
  );
}


function CardSkeleton() {
  return (
    <div className="relative mx-auto h-full w-full max-w-[420px]">
      <div className="absolute inset-0 animate-pulse rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
    </div>
  );
}
