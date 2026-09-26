"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Share2, Sparkles } from "lucide-react";
import { DropSignup } from "@/components/DropSignup";
import { archetypeOf, encodeTaste, tasteOverlap } from "@/lib/taste";
import { renderTasteImage } from "@/lib/shareImage";
import { shareOrCopy } from "@/lib/clipboard";
import { siteRoot } from "@/lib/share";
import { track } from "@/lib/analytics";
import { FEATURE_LABELS } from "@/types/shirt";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG, TraitChips } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { SHIRTS, dedupeByFamily, paceByVariant, productHref } from "@/lib/catalog";
import { rankShirts, topTraits } from "@/lib/recommendation";
import { CALIBRATION_IDS } from "@/lib/deck";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

/** Shown once, when the taste test is finished: the rewarding hand-off into the shop. */
export function CalibrationComplete() {
  const hydrated = useUiStore((s) => s.hydrated);
  const acknowledged = useTasteStore((s) => s.calibrationAcknowledged);
  const acknowledge = useTasteStore((s) => s.acknowledgeCalibration);
  const vector = useTasteStore((s) => s.preferenceVector);
  const likedInTest = useTasteStore((s) => CALIBRATION_IDS.filter((id) => s.likedIds.includes(id)).length);
  const { complete, total } = useCalibrationProgress();
  const open = hydrated && complete && !acknowledged;
  const sheet = useRef<HTMLDivElement>(null);
  const close = useCallback(() => acknowledge(), [acknowledge]);
  useFocusTrap(sheet, open, close);

  // Three clearly different designs: different families and algorithms.
  const picks = open ? paceByVariant(dedupeByFamily(rankShirts(vector, SHIRTS)), 3).slice(0, 3) : [];
  const traits = open ? topTraits(vector, 3) : [];
  const archetype = archetypeOf(vector);
  const friend = useUiStore((s) => s.friendTaste);
  const [sharing, setSharing] = useState(false);
  const shareTaste = async () => {
    setSharing(true);
    try {
      const url = `${siteRoot()}/?taste=${encodeTaste(vector)}&utm_source=taste&utm_medium=share&utm_campaign=taste_profile`;
      const blob = await renderTasteImage(archetype.name, traits.map((k) => FEATURE_LABELS[k]), picks.map((p) => p.shirt));
      await shareOrCopy({ title: `${archetype.name} — MONO`, text: `My taste in tees: ${archetype.name}. What's yours?`, url, image: { blob, name: "mono-my-taste.png" } });
      track("share", { channel: "taste" });
    } finally {
      setSharing(false);
    }
  };

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
            className="no-scrollbar max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-ink-900 p-5 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.25 }}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
              <Burst /> Taste test complete
            </div>
            <h2 id="calib-title" className="mt-2 text-2xl font-bold tracking-tight">
              You&apos;re {archetype.name}
            </h2>
            <p className="text-sm text-neutral-300">Your shop is ready.</p>
            <p className="mt-1 text-sm text-neutral-400">
              You liked {likedInTest} of {total}.{traits.length > 0 ? " Here's what you're into:" : ""}
            </p>
            <TraitChips keys={traits} className="mt-3" stagger />

            <div className="mt-4 grid grid-cols-3 gap-2">
              {picks.map(({ shirt }, i) => (
                <Link
                  key={shirt.id}
                  href={productHref(shirt.id)}
                  onClick={close}
                  aria-label={`${shirt.title}, top pick`}
                  className={`relative block rounded-2xl p-2 pt-8 ring-1 ring-white/10 transition active:scale-95 ${STAGE_BG}`}
                >
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55 + i * 0.08 }}
                    className="absolute left-1.5 top-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-black"
                  >
                    Top pick
                  </motion.span>
                  <TeeMockup shirt={shirt} shadow={false} className="w-full" />
                </Link>
              ))}
            </div>

            {friend && (
              <div className="mt-4 rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10" role="status">
                <p className="text-sm font-semibold">Compared with your friend: {tasteOverlap(vector, friend)}% alike</p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  They&apos;re {archetypeOf(friend).name}
                  {(() => {
                    const both = topTraits(friend, 5).filter((k) => traits.includes(k)).map((k) => FEATURE_LABELS[k]);
                    return both.length ? ` · you're both into ${both.join(", ")}` : "";
                  })()}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={shareTaste}
              disabled={sharing}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" /> {sharing ? "Making your card…" : "Share my taste"}
            </button>

            <DropSignup source="calibration" className="!mt-4" />

            <div className="mt-5 grid gap-1">
              <Link
                href="/shop/"
                onClick={close}
                data-autofocus
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
              >
                See my shop <ArrowRight className="h-4 w-4" />
              </Link>
              <button type="button" onClick={close} className="h-11 rounded-full text-sm font-semibold text-neutral-300 hover:text-white">
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
      <Sparkles className="h-4 w-4" />
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
