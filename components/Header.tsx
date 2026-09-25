"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useShirtStore, CALIBRATION_TOTAL } from "@/store/useShirtStore";

export function Header({ onOpenLiked }: { onOpenLiked: () => void }) {
  const likedCount = useShirtStore((s) => s.likedIds.length);
  const swipes = useShirtStore((s) => s.swipeHistory.length);
  const calibrating = swipes < CALIBRATION_TOTAL;

  return (
    <header className="relative z-20 shrink-0 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="mx-auto flex max-w-[420px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 grid-cols-2 overflow-hidden rounded-lg ring-1 ring-white/15">
            <span className="bg-white" />
            <span className="bg-black" />
            <span className="bg-black" />
            <span className="bg-white" />
          </div>
          <div className="leading-none">
            <h1 className="text-lg font-black tracking-[0.3em]">MONO</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Black · White · Back print
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLiked}
          aria-label={`Liked items (${likedCount})`}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition active:scale-90 hover:bg-white/10"
        >
          <Heart className="h-5 w-5" />
          <AnimatePresence>
            {likedCount > 0 && (
              <motion.span
                key={likedCount}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 font-mono text-[11px] font-bold text-black"
              >
                {likedCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Calibration progress */}
      <div className="mx-auto mt-3 flex max-w-[420px] items-center gap-3">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full bg-white"
            initial={false}
            animate={{ width: `${Math.min(1, swipes / CALIBRATION_TOTAL) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {calibrating ? `Calibrating ${swipes}/${CALIBRATION_TOTAL}` : "Personalized"}
        </span>
      </div>
    </header>
  );
}
