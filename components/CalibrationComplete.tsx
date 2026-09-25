"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { MatchBadge, STAGE_BG, TraitChips } from "@/components/ui";
import { MOCK_SHIRTS } from "@/lib/mockData";
import { rankShirts, topTraits } from "@/lib/recommendation";
import { useCalibrationProgress, useShirtStore } from "@/store/useShirtStore";

/** Shown once, when the calibration set is finished: the hand-off into the shop. */
export function CalibrationComplete() {
  const hydrated = useShirtStore((s) => s.hydrated);
  const acknowledged = useShirtStore((s) => s.calibrationAcknowledged);
  const acknowledge = useShirtStore((s) => s.acknowledgeCalibration);
  const vector = useShirtStore((s) => s.preferenceVector);
  const likes = useShirtStore((s) => s.likedIds.length);
  const { complete } = useCalibrationProgress();
  const open = hydrated && complete && !acknowledged;

  const picks = open ? rankShirts(vector, MOCK_SHIRTS).slice(0, 3) : [];
  const traits = open ? topTraits(vector, 3) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calib-title"
            className="w-full max-w-md rounded-[28px] border border-white/10 bg-ink-900 p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.25 }}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              <Sparkles className="h-3.5 w-3.5" /> Calibration complete
            </div>
            <h2 id="calib-title" className="mt-2 text-2xl font-bold tracking-tight">
              Your taste profile is ready
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              {likes} like{likes === 1 ? "" : "s"} across 10 deliberately different prints. The shop is now ranked for you.
            </p>
            {traits.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-neutral-500">You lean towards</p>
                <TraitChips keys={traits} />
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              {picks.map(({ shirt, score }) => (
                <div key={shirt.id} className={`relative rounded-2xl p-2 pt-7 ${STAGE_BG}`}>
                  <div className="absolute left-1.5 top-1.5">
                    <MatchBadge score={score} size="sm" />
                  </div>
                  <TeeMockup shirt={shirt} shadow={false} className="w-full" />
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-2">
              <Link
                href="/shop/"
                onClick={acknowledge}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
              >
                Open my shop <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={acknowledge}
                className="h-11 rounded-full text-sm font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/5"
              >
                Keep swiping
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
