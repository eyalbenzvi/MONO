"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ActionButtons } from "@/components/ActionButtons";
import { CalibrationComplete } from "@/components/CalibrationComplete";
import { CardStack } from "@/components/CardStack";
import { tierOf } from "@/lib/match";
import { biggestShift, profileSharpness } from "@/lib/recommendation";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { SHIRTS } from "@/lib/catalog";
import { STORE_POLICY } from "@/lib/store-policy";
import { TasteSheet } from "@/components/TasteSheet";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { FEATURE_LABELS } from "@/types/shirt";

/**
 * Desktop (≥ 1024 px), until the taste test is done: a narrow column beside
 * the card saying what's going on. Phones get the one-line goal instead.
 */
function HowItWorks() {
  const { complete } = useCalibrationProgress();
  if (complete) return null;
  return (
    <aside className="pointer-events-none absolute left-[max(2rem,calc(50%-210px-19rem))] top-1/3 hidden w-60 lg:block">
      <h2 className="text-xl font-bold tracking-tight">{CALIBRATION_TOTAL} swipes → your shop.</h2>
      <ul className="mt-3 space-y-2 text-sm text-neutral-300">
        <li>→ Like what you&apos;d wear, ← pass on the rest.</li>
        <li>Every swipe teaches MONO your taste in prints.</li>
        <li>Then the shop ranks all {SHIRTS.length.toLocaleString("en-US")} designs for you.</li>
      </ul>
      <p className="mt-4 text-xs text-neutral-400">{STORE_POLICY.firstVisit}</p>
    </aside>
  );
}

/** The top strip keeps one fixed height across phases so the card never jumps. */
const STRIP = "mx-auto flex h-10 w-full max-w-[420px] shrink-0 flex-col justify-center px-4";

export default function DiscoverPage() {
  const hydrated = useHydrated();

  // Keyboard shortcuts (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Any open dialog (zoom, share, taste-test screen) owns the keyboard:
      // Escape there closes only that dialog, never the card flip.
      if (document.querySelector('[role="dialog"]')) return;
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
      {hydrated && <HowItWorks />}
      <section className="relative min-h-0 flex-1 px-4 pb-1 pt-1 sideways:py-2">
        {hydrated ? <CardStack /> : <CardSkeleton />}
        {hydrated && <LearnChip />}
      </section>
      <ActionButtons />
      <CalibrationComplete />
    </div>
  );
}

function TopStrip() {
  const { done, total, complete } = useCalibrationProgress();
  const onboardingSeen = useTasteStore((s) => s.onboardingSeen);
  const vector = useTasteStore((s) => s.preferenceVector);
  const [sheet, setSheet] = useState(false);

  // Milestone copy: "Halfway there" flashes for 1.5 s at 5/10; "Last one!" at 9/10.
  const [flash, setFlash] = useState<string | null>(null);
  const prev = useRef(done);
  useEffect(() => {
    if (done !== prev.current && done === Math.floor(total / 2)) {
      setFlash("Halfway there");
      const t = setTimeout(() => setFlash(null), 1500);
      prev.current = done;
      return () => clearTimeout(t);
    }
    prev.current = done;
  }, [done, total]);

  if (complete) {
    const sharp = profileSharpness(vector);
    const word = sharp < 0.4 ? "Sharpening" : sharp < 0.75 ? "Focused" : "Dialled in";
    return (
      <div className={STRIP}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            aria-label={`Your taste: ${word}. Open your taste profile`}
            className="-ml-1 flex h-10 min-w-0 items-center gap-2 rounded-full px-1 text-neutral-400 hover:text-white"
          >
            <span>Your taste</span>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <motion.span
                className="block h-full rounded-full bg-white"
                initial={false}
                animate={{ width: `${Math.max(8, sharp * 100)}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 28 }}
              />
            </span>
            <span className="truncate font-medium text-white">{word}</span>
          </button>
          <TasteSheet open={sheet} onClose={() => setSheet(false)} />
          <Link href="/shop/" className="flex h-10 shrink-0 items-center gap-1 font-semibold text-white">
            Your shop <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // The one progress counter: which card of the taste test is on screen.
  const current = Math.min(done + 1, total);
  const label = flash ?? (done === total - 1 ? "Last one" : `${current}/${total}`);
  // First visit (before the first swipe) on phones: one quiet line of store
  // basics under the bar; the strip grows for it, just this once.
  const firstVisit = !onboardingSeen && done === 0;
  return (
    <div className={firstVisit ? STRIP.replace("h-10", "min-h-10 lg:h-10") : STRIP}>
      {!onboardingSeen && (
        <p className={`truncate text-center text-[13px] font-medium text-white ${firstVisit ? "mb-1 leading-4" : "mb-1.5"}`}>
          Rate {CALIBRATION_TOTAL} tees. We&apos;ll build your shop from your taste.
        </p>
      )}
      <div className="flex items-center gap-3">
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`shrink-0 font-mono text-xs ${flash || done === total - 1 ? "font-semibold text-white" : "text-neutral-300"}`}
            aria-hidden
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
      {firstVisit && <p className="mt-1 truncate text-center text-xs leading-4 text-neutral-400 lg:hidden">{STORE_POLICY.firstVisit}</p>}
    </div>
  );
}

/**
 * "The app is learning" feedback: after each swipe, the trait that moved most
 * shows for a moment inside the top of the card ("More geometric" / "Less
 * minimal"). Only for the first 20 swipes, so it teaches without nagging.
 */
function LearnChip() {
  const lastUpdate = useTasteStore((s) => s.lastUpdate);
  const history = useTasteStore((s) => s.swipeHistory);
  const last = history[history.length - 1];
  const show = lastUpdate && last && last.source !== "shop" && last.shirtId === lastUpdate.shirtId && history.length <= 20;

  let text: string | null = null;
  if (show) {
    // A like on a card the engine rated a top or strong match for you.
    const tier = lastUpdate.action === "like" && last.strategy === "greedy" ? tierOf(lastUpdate.before, last.matchScore) : null;
    if (tier === "top" || tier === "strong") text = "Nailed it";
    else {
      const key = biggestShift(lastUpdate.before, lastUpdate.after, lastUpdate.action);
      if (key) text = `${lastUpdate.action === "like" ? "More" : "Less"} ${FEATURE_LABELS[key].toLowerCase()}`;
    }
  }

  return (
    // Inside the card's top row (centre), clear of its edge and its buttons.
    <div className="pointer-events-none absolute inset-x-0 top-[25px] z-30 flex justify-center sideways:top-[29px]" aria-live="polite">
      <AnimatePresence>
        {text && (
          <motion.span
            key={history.length}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] }}
            transition={{ duration: 1.4, times: [0, 0.15, 0.8, 1] }}
            className={`rounded-full px-3 py-1 text-xs font-bold shadow-lg ${
              lastUpdate?.action === "like" ? "bg-white text-black" : "bg-black/70 text-white ring-1 ring-white/20"
            }`}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
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
