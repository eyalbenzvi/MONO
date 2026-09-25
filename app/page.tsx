"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ActionButtons } from "@/components/ActionButtons";
import { CalibrationComplete } from "@/components/CalibrationComplete";
import { CardStack } from "@/components/CardStack";
import { useHydrated } from "@/components/AppShell";
import { STRONG_MATCH } from "@/components/ui";
import { biggestShift, profileSharpness } from "@/lib/recommendation";
import { useCalibrationProgress, useShirtStore } from "@/store/useShirtStore";
import { FEATURE_LABELS } from "@/types/shirt";

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
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (t instanceof Element && t.closest('button, a, [role="button"], [role="radio"], [role="tab"], [contenteditable=""], [contenteditable="true"]')) return;
      const { requestSwipe, toggleFlip, undoLast, isFlipped } = useShirtStore.getState();
      if (e.key === "ArrowRight") requestSwipe("like");
      else if (e.key === "ArrowLeft") requestSwipe("dislike");
      else if (e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === "Escape" && isFlipped) toggleFlip(false);
      else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {hydrated ? <TopStrip /> : <div className={STRIP} />}
      <section className="relative min-h-0 flex-1 px-4 pb-1 pt-1">
        {hydrated ? <CardStack /> : <CardSkeleton />}
        {hydrated && <LearnChip />}
      </section>
      <ActionButtons />
      <CalibrationComplete />
    </>
  );
}

function TopStrip() {
  const { done, total, complete } = useCalibrationProgress();
  const onboardingSeen = useShirtStore((s) => s.onboardingSeen);
  const vector = useShirtStore((s) => s.preferenceVector);

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
          <div className="flex min-w-0 items-center gap-2 text-neutral-400">
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
          </div>
          <Link href="/shop/" className="flex h-10 shrink-0 items-center gap-1 font-semibold text-white">
            Your shop <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const label = flash ?? (done === total - 1 ? "Last one!" : `Taste test · ${done} of ${total}`);
  return (
    <div className={STRIP}>
      {!onboardingSeen && (
        <p className="mb-1.5 truncate text-center text-[13px] font-medium text-white">
          Rate 10 tees. We&apos;ll build your shop from your taste.
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Taste test progress">
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
        {onboardingSeen && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={`shrink-0 text-xs ${flash || done === total - 1 ? "font-semibold text-white" : "text-neutral-400"}`}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/**
 * "The app is learning" feedback: after each swipe, the trait that moved most
 * floats up for a moment (+ Geometric / − Typography). Only for the first
 * 20 swipes, so it teaches without nagging.
 */
function LearnChip() {
  const lastUpdate = useShirtStore((s) => s.lastUpdate);
  const history = useShirtStore((s) => s.swipeHistory);
  const last = history[history.length - 1];
  const show = lastUpdate && last && last.source !== "shop" && last.shirtId === lastUpdate.shirtId && history.length <= 20;

  let text: string | null = null;
  if (show) {
    if (lastUpdate.action === "like" && last.strategy === "greedy" && last.matchScore >= STRONG_MATCH) text = "Nailed it";
    else {
      const key = biggestShift(lastUpdate.before, lastUpdate.after, lastUpdate.action);
      if (key) text = `${lastUpdate.action === "like" ? "+" : "−"} ${FEATURE_LABELS[key]}`;
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center" aria-live="polite">
      <AnimatePresence>
        {text && (
          <motion.span
            key={history.length}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [8, 0, -6, -12] }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }}
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
