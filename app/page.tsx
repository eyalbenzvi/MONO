"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ActionButtons } from "@/components/ActionButtons";
import { CalibrationComplete } from "@/components/CalibrationComplete";
import { CardStack } from "@/components/CardStack";
import { useHydrated } from "@/components/AppShell";
import { useCalibrationProgress, useShirtStore } from "@/store/useShirtStore";

export default function DiscoverPage() {
  const hydrated = useHydrated();
  const { done, total, complete } = useCalibrationProgress();

  // Keyboard shortcuts for desktop testing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const { requestSwipe, toggleFlip } = useShirtStore.getState();
      if (e.key === "ArrowRight") requestSwipe("like");
      else if (e.key === "ArrowLeft") requestSwipe("dislike");
      else if (e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        toggleFlip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mx-auto flex w-full max-w-[420px] shrink-0 items-center gap-3 px-4 pt-1">
        {complete ? (
          <Link
            href="/shop/"
            className="flex w-full items-center justify-between rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-neutral-400 ring-1 ring-white/10 hover:text-white"
          >
            <span className="font-mono uppercase tracking-wider">Personalized · every swipe keeps training</span>
            <span className="flex items-center gap-1 font-semibold text-white">
              Shop <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ) : (
          <>
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-white"
                initial={false}
                animate={{ width: `${(hydrated ? done / total : 0) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              Calibrating {hydrated ? done : 0}/{total}
            </span>
          </>
        )}
      </div>
      <section className="relative min-h-0 flex-1 px-4 pb-2 pt-3">
        {hydrated ? <CardStack /> : <CardSkeleton />}
      </section>
      <ActionButtons />
      <CalibrationComplete />
    </>
  );
}

function CardSkeleton() {
  return (
    <div className="relative mx-auto h-full w-full max-w-[420px]">
      <div className="absolute inset-0 animate-pulse rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
    </div>
  );
}
