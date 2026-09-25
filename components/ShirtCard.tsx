"use client";

import { memo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass, Heart, RotateCcw, Share2, ZoomIn } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { LABEL, MatchBadge, STAGE_BG, STRONG_MATCH, TeeDot, TraitChips, useShowMatch } from "@/components/ui";
import { explainMatch } from "@/lib/recommendation";
import { familySize } from "@/lib/catalog";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { formatPrice } from "@/lib/format";
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  FEATURE_KEYS,
  FEATURE_LABELS,
  PRINT_SIZE_CM,
  type RecommendationStrategy,
  type ShirtProduct,
} from "@/types/shirt";

interface ShirtCardProps {
  shirt: ShirtProduct;
  strategy: RecommendationStrategy;
  score: number;
  isFlipped: boolean;
  isTop: boolean;
  /** Top card only: opens the full-screen zoom (owned by the swipe card). */
  onZoom?: () => void;
}

// Memoised: starting a swipe re-renders the stack (leaving flag, heart
// flight); the card content itself doesn't change, so skip that work.
export const ShirtCard = memo(function ShirtCard({ shirt, strategy, score, isFlipped, isTop, onZoom }: ShirtCardProps) {
  const showDetails = isFlipped && isTop;
  const reduceMotion = useReducedMotion();
  const showMatch = useShowMatch();
  const { done, total } = useCalibrationProgress();
  const openShare = useUiStore((s) => s.openShare);
  // backface-visibility hides a face visually but not from hit-testing, so the
  // face turned away must also stop taking pointer events.
  const hiddenFace = "pointer-events-none";
  const face = "absolute inset-0 overflow-hidden rounded-[28px] bg-ink-900 shadow-2xl shadow-black/70 ring-1 ring-white/10";

  return (
    <div className="relative h-full w-full [perspective:1400px]">
      <motion.div
        className="preserve-3d relative h-full w-full"
        initial={false}
        // Reduced motion: crossfade the faces instead of a 3D flip.
        animate={{ rotateY: showDetails && !reduceMotion ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* Face 1: the tee, print mocked up on the fabric */}
        <motion.div
          className={`backface-hidden ${face} flex flex-col ${showDetails ? hiddenFace : ""}`}
          animate={reduceMotion ? { opacity: showDetails ? 0 : 1 } : undefined}
          aria-hidden={showDetails}
        >
          <div className={`relative flex min-h-0 flex-1 flex-col ${STAGE_BG}`}>
            <div className="flex h-12 items-center justify-between px-4 pt-3">
              {showMatch ? (
                <MatchBadge score={score} strong={isTop && strategy === "greedy" && score >= STRONG_MATCH} />
              ) : isTop && strategy === "calibration" ? (
                <span className="rounded-full bg-black/60 px-3 py-1 font-mono text-xs font-bold text-white">
                  {Math.min(done + 1, total)} / {total}
                </span>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {strategy === "explore" && (
                  <span
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-white/50 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white"
                    title="Outside your usual — tells us more"
                  >
                    <Compass className="h-3.5 w-3.5" /> Wildcard
                  </span>
                )}
                {isTop && (
                  <button
                    type="button"
                    onClick={() => openShare(shirt.id, shirt.baseColor)}
                    aria-label={`Share ${shirt.title}`}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 before:absolute before:-inset-1.5 before:content-[''] hover:bg-black/80"
                  >
                    <Share2 className="h-[17px] w-[17px]" />
                  </button>
                )}
                {isTop && onZoom && (
                  <button
                    type="button"
                    onClick={onZoom}
                    aria-label="Zoom in on the print"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 before:absolute before:-inset-1.5 before:content-[''] hover:bg-black/80"
                  >
                    <ZoomIn className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-2 pt-1 [container-type:size]">
              <TeeMockup shirt={shirt} style={{ width: "min(100cqw, calc(100cqh * 340 / 440))" }} />
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 px-5 pb-4 pt-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{shirt.title}</h2>
              <p className="truncate text-xs text-neutral-400">
                {CATEGORY_LABELS[shirt.category]} · <TeeDot color={shirt.baseColor} /> {COLOR_LABELS[shirt.baseColor]} tee
              </p>
            </div>
            <span className="shrink-0 font-mono text-lg font-semibold">{formatPrice(shirt.price)}</span>
          </div>
        </motion.div>

        {/* Face 2: light details — buying happens on the product page */}
        <motion.div
          className={`backface-hidden ${reduceMotion ? "" : "rotate-y-180"} ${face} ${showDetails ? "" : hiddenFace}`}
          initial={false}
          animate={reduceMotion ? { opacity: showDetails ? 1 : 0 } : undefined}
          aria-hidden={!showDetails}
        >
          {isTop && <CardDetails shirt={shirt} score={score} />}
        </motion.div>
      </motion.div>
    </div>
  );
});


function CardDetails({ shirt, score }: { shirt: ShirtProduct; score: number }) {
  const toggleFlip = useUiStore((s) => s.toggleFlip);
  const requestSwipe = useTasteStore((s) => s.requestSwipe);
  const vector = useTasteStore((s) => s.preferenceVector);
  const showMatch = useShowMatch();
  const top = [...FEATURE_KEYS].sort((a, b) => shirt.features[b] - shirt.features[a]).slice(0, 3);
  const reasons = showMatch ? explainMatch(vector, shirt.features) : [];
  const black = shirt.baseColor === "black";

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
        <div className="flex items-center justify-between">
          {showMatch ? <MatchBadge score={score} /> : <span />}
          <button
            type="button"
            onClick={() => toggleFlip(false)}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-medium hover:bg-white/15"
          >
            <RotateCcw className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className={`w-24 shrink-0 rounded-2xl p-2 ${STAGE_BG}`}>
            <TeeMockup shirt={shirt} shadow={false} className="w-full" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight tracking-tight">{shirt.title}</h2>
            <p className="mt-0.5 text-sm text-neutral-400">{CATEGORY_LABELS[shirt.category]}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-neutral-300">{shirt.description}</p>

        {reasons.length > 0 && (
          <div className="mt-4">
            <p className={LABEL}>Why it matches you</p>
            <TraitChips keys={reasons} />
          </div>
        )}

        <p className="mt-4 text-sm text-neutral-300">
          {black ? "Black" : "White"} tee · {black ? "white" : "black"} ink · {PRINT_SIZE_CM.width}×{PRINT_SIZE_CM.height} cm print
          <span className="block text-xs text-neutral-400">Also available in {black ? "white" : "black"}</span>
        </p>

        {familySize(shirt) > 1 && (
          <Link
            href={`/shop/${shirt.id}/#variations`}
            className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/10"
          >
            {familySize(shirt) - 1} close variation{familySize(shirt) === 2 ? "" : "s"} in the shop <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}

        <div className="mt-5">
          <p className={LABEL}>Print DNA</p>
          <ul className="space-y-2">
            {top.map((k) => (
              <li key={k} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-neutral-300">{FEATURE_LABELS[k]}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-white" style={{ width: `${shirt.features[k] * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer actions stay visible */}
      <div className="grid grid-cols-[auto_auto_1fr] gap-2 border-t border-white/10 bg-ink-900 px-4 py-3">
        <button
          type="button"
          onClick={() => requestSwipe("like")}
          className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold hover:bg-white/15"
        >
          <Heart className="h-4 w-4" /> Like
        </button>
        <button
          type="button"
          onClick={() => useUiStore.getState().openShare(shirt.id, shirt.baseColor)}
          aria-label={`Share ${shirt.title}`}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <Link
          href={`/shop/${shirt.id}/`}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black"
        >
          Full details · {formatPrice(shirt.price)} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

