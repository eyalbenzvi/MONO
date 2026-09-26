"use client";

import { memo } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MoreMenu } from "@/components/MoreMenu";
import { TeeMockup } from "@/components/TeeMockup";
import { LABEL, MatchBadge, STAGE_BG, TeeDot, TraitChips, useShowMatch } from "@/components/ui";
import { tierOf } from "@/lib/match";
import { explainMatch } from "@/lib/recommendation";
import { productHref } from "@/lib/catalog";
import { useShirtDetails } from "@/lib/details";
import { canUndo, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  printSizeLabel,
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
  const vector = useTasteStore((s) => s.preferenceVector);
  const tier = showMatch ? tierOf(vector, score) : null;
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
          {...inert(showDetails)}
        >
          <div className={`relative flex min-h-0 flex-1 flex-col ${STAGE_BG}`}>
            <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-2 pt-6 [container-type:size]">
              <TeeMockup shirt={shirt} priority={isTop} style={{ width: "min(100cqw, calc(100cqh * 340 / 440))" }} />
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 px-5 pb-4 pt-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{shirt.title}</h2>
            </div>
          </div>
        </motion.div>

        {/* Face 2: light details — buying happens on the product page */}
        <motion.div
          className={`backface-hidden ${reduceMotion ? "" : "rotate-y-180"} ${face} ${showDetails ? "" : hiddenFace}`}
          initial={false}
          animate={reduceMotion ? { opacity: showDetails ? 1 : 0 } : undefined}
          aria-hidden={!showDetails}
          {...inert(!showDetails)}
        >
          {isTop && <CardDetails shirt={shirt} score={score} onZoom={onZoom} />}
        </motion.div>
      </motion.div>
    </div>
  );
});


/**
 * The face turned away is inert: out of the tab order and the accessibility
 * tree, and it takes no clicks (React 18 has no `inert` prop yet, so the
 * attribute is set as a string).
 */
const inert = (on: boolean) => (on ? ({ inert: "" } as Record<string, string>) : {});

function CardDetails({ shirt, score, onZoom }: { shirt: ShirtProduct; score: number; onZoom?: () => void }) {
  const toggleFlip = useUiStore((s) => s.toggleFlip);
  const vector = useTasteStore((s) => s.preferenceVector);
  const showMatch = useShowMatch();
  const reasons = showMatch ? explainMatch(vector, shirt.features) : [];
  const black = shirt.baseColor === "black";
  const details = useShirtDetails(shirt.id);
  const openShare = useUiStore((s) => s.openShare);
  const undoable = useTasteStore(canUndo);

  return (
    <div className="flex h-full flex-col">
      {/* Fades at the bottom so text scrolling under the footer never looks cut. */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 [mask-image:linear-gradient(#000_calc(100%-24px),transparent)]">
        <div className="flex items-center justify-between">
          <span />
          <div className="flex items-center gap-1">
          {/* Secondary actions live in one menu, not on the card. */}
          <MoreMenu
            label={`More for ${shirt.title}`}
            items={[
              ...(onZoom ? [{ label: "Zoom in on the print", icon: "zoom-in" as const, onSelect: onZoom }] : []),
              { label: "Share", icon: "share-2" as const, onSelect: () => openShare(shirt.id, shirt.baseColor) },
              // Undo lives here (and on Z), not as a button under the card.
              ...(undoable ? [{ label: "Undo last swipe", icon: "rotate-ccw" as const, onSelect: () => useTasteStore.getState().undoLast() }] : []),
            ]}
          />
          {/* Closes the details. */}
          <button
            type="button"
            onClick={() => toggleFlip(false)}
            aria-label="Back to the tee"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
          </div>
        </div>

        <div className="mt-4 flex gap-4">
          {/* Short screens (phones sideways) skip the thumbnail: room for the text. */}
          <div className={`w-24 shrink-0 rounded-2xl p-2 [@media(max-height:500px)]:hidden ${STAGE_BG}`}>
            <TeeMockup shirt={shirt} shadow={false} className="w-full" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight tracking-tight">{shirt.title}</h2>
            <p className="mt-0.5 text-sm text-neutral-400">{CATEGORY_LABELS[shirt.category]}</p>
          </div>
        </div>

        {/* Fetched with the card (lib/details); the space is held so nothing jumps. */}
        <p className="mt-4 min-h-[4.5rem] text-sm leading-relaxed text-neutral-300">{details?.description}</p>


      </div>

      {/* One action here: Like / Pass sit on the buttons below the card. */}
      <div className="border-t border-white/10 bg-ink-900 px-4 py-3">
        <Link
          href={productHref(shirt.id)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black"
        >
          View tee <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

