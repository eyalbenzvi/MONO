"use client";

import { memo, useMemo } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { MoreMenu } from "@/components/MoreMenu";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG, useShowMatch } from "@/components/ui";
import { tierOf } from "@/lib/match";
import { becauseOf } from "@/lib/because";
import { productHref } from "@/lib/catalog";
import { useShirtDetails } from "@/lib/details";
import { canUndo, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import type { InPlaceZoom } from "@/hooks/useInPlaceZoom";
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
  /** Top card only: the in-place zoom of the picture (owned by the swipe card). */
  zoom?: InPlaceZoom["values"];
  zoomed?: boolean;
}

// Memoised: starting a swipe re-renders the stack (leaving flag, heart
// flight); the card content itself doesn't change, so skip that work.
export const ShirtCard = memo(function ShirtCard({ shirt, strategy, score, isFlipped, isTop, zoom, zoomed = false }: ShirtCardProps) {
  const showDetails = isFlipped && isTop;
  const reduceMotion = useReducedMotion();
  const showMatch = useShowMatch();
  const vector = useTasteStore((s) => s.preferenceVector);
  const tier = showMatch ? tierOf(vector, score) : null;
  const likedIds = useTasteStore((s) => s.likedIds);
  const because = useMemo(() => (showMatch ? becauseOf(shirt, likedIds) : null), [showMatch, shirt, likedIds]);
  // backface-visibility hides a face visually but not from hit-testing, so the
  // face turned away must also stop taking pointer events.
  const hiddenFace = "pointer-events-none";
  // The face turned away is also hidden outright past 90°: a phone draws a face's own
  // layers (the print's canvas, the photo) through backface-visibility, so while
  // the page was pinch-zoomed the tee showed through the details.
  const turn = useMotionValue(showDetails && !reduceMotion ? 180 : 0);
  const frontVisibility = useTransform(turn, (r) => (r < 90 ? "visible" : "hidden"));
  const backVisibility = useTransform(turn, (r) => (r < 90 ? "hidden" : "visible"));
  const face = "absolute inset-0 overflow-hidden rounded-[28px] bg-ink-900 shadow-2xl shadow-black/70 ring-1 ring-white/10";

  return (
    <div className="relative h-full w-full [perspective:1400px]">
      <motion.div
        className="preserve-3d relative h-full w-full"
        initial={false}
        // Reduced motion: crossfade the faces instead of a 3D flip.
        style={{ rotateY: turn }}
        animate={{ rotateY: showDetails && !reduceMotion ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* Face 1: the tee, print mocked up on the fabric */}
        <motion.div
          className={`backface-hidden ${face} flex flex-col ${showDetails ? hiddenFace : ""}`}
          style={reduceMotion ? undefined : { visibility: frontVisibility }}
          animate={reduceMotion ? { opacity: showDetails ? 0 : 1 } : undefined}
          aria-hidden={showDetails}
          {...inert(showDetails)}
        >
          {/* The frame: a pinch zooms the picture inside it (useInPlaceZoom). */}
          <div data-zoom-stage className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${STAGE_BG}`}>
            <motion.div
              className="flex min-h-0 flex-1 items-center justify-center px-3 pb-2 pt-6 [container-type:size]"
              style={zoom ? { scale: zoom.scale, x: zoom.x, y: zoom.y } : undefined}
            >
              <TeeMockup shirt={shirt} priority={isTop} style={{ width: "min(100cqw, calc(100cqh * 512 / 704))" }} />
            </motion.div>
          </div>

          <div className={`flex items-end justify-between gap-3 px-5 pb-4 pt-3 transition-opacity duration-200 ${zoomed ? "opacity-40" : ""}`}>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{shirt.title}</h2>
              {/* The learning, felt: the closest thing you liked (once the taste is known). */}
              {because && (
                <p className="mt-0.5 truncate text-xs text-neutral-400">
                  Because you liked {because.title}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Face 2: light details — buying happens on the product page */}
        <motion.div
          className={`backface-hidden ${reduceMotion ? "" : "rotate-y-180"} ${face} ${showDetails ? "" : hiddenFace}`}
          initial={false}
          style={reduceMotion ? undefined : { visibility: backVisibility }}
          animate={reduceMotion ? { opacity: showDetails ? 1 : 0 } : undefined}
          aria-hidden={!showDetails}
          {...inert(!showDetails)}
        >
          {isTop && <CardDetails shirt={shirt} score={score} />}
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

function CardDetails({ shirt, score }: { shirt: ShirtProduct; score: number }) {
  const toggleFlip = useUiStore((s) => s.toggleFlip);
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
          {/* Direct actions, same round buttons as the close: share, and undo when there's a swipe to undo. */}
          {undoable && (
            <button
              type="button"
              onClick={() => useTasteStore.getState().undoLast()}
              aria-label="Undo last swipe"
              title="Undo last swipe"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
            >
              <Icon name="rotate-ccw" className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => openShare(shirt.id, shirt.baseColor)}
            aria-label={`Share ${shirt.title}`}
            title="Share"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
          >
            <Icon name="share-2" className="h-5 w-5" />
          </button>
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
            <TeeMockup shirt={shirt} shadow={false} thumb className="w-full" />
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

