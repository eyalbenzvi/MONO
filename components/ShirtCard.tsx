"use client";

import { memo, useMemo, useRef } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { SIZES } from "@/lib/images";
import { BUTTON_PRIMARY, useShowMatch } from "@/components/ui";
import { becauseOf } from "@/lib/because";
import { explainMatch } from "@/lib/recommendation";
import { traitLine } from "@/lib/taste";
import { productHref } from "@/lib/catalog";
import { useShirtDetails } from "@/lib/details";
import { canUndo, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import type { InPlaceZoom } from "@/hooks/useInPlaceZoom";
import { CATEGORY_LABELS, type RecommendationStrategy, type ShirtProduct } from "@/types/shirt";

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
  const likedIds = useTasteStore((s) => s.likedIds);
  const vector = useTasteStore((s) => s.preferenceVector);
  // The learning, felt (once the taste is known): the closest tee you saved,
  // else the traits in common, in words; the explore cards say they're a change.
  const reason = useMemo(() => {
    if (!showMatch) return null;
    if (strategy === "explore") return "Something different";
    const because = becauseOf(shirt, likedIds);
    if (because) return `Because you saved ${because.title}`;
    const shared = explainMatch(vector, shirt.features, 2);
    return shared.length ? traitLine(shared) : null;
    // The vector is read when the card is dealt, not re-read on every swipe behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMatch, shirt, likedIds, strategy]);
  // backface-visibility hides a face visually but not from hit-testing, so the
  // face turned away must also stop taking pointer events.
  const hiddenFace = "pointer-events-none";
  // The face turned away is also hidden outright past 90°: a phone draws a face's
  // own layers (a picture, a transformed child) through backface-visibility, so while
  // the page was pinch-zoomed the tee showed through the details.
  const turn = useMotionValue(showDetails && !reduceMotion ? 180 : 0);
  const frontVisibility = useTransform(turn, (r) => (r < 90 ? "visible" : "hidden"));
  const backVisibility = useTransform(turn, (r) => (r < 90 ? "hidden" : "visible"));
  // Square, full-bleed: the photo is the card (no frame, no stage behind it).
  const face = "absolute inset-0 overflow-hidden bg-ink-900";

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
          <div data-zoom-stage className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <motion.div
              className="flex min-h-0 flex-1 items-center justify-center [container-type:size]"
              style={zoom ? { scale: zoom.scale, x: zoom.x, y: zoom.y } : undefined}
            >
              <TeeMockup shirt={shirt} priority={isTop} sizes={SIZES.card} zoomed={zoomed} style={{ width: "min(100cqw, calc(100cqh * 512 / 704))" }} />
            </motion.div>
          </div>

          <div className={`flex items-end justify-between gap-3 px-5 pb-4 pt-3 transition-opacity duration-200 ${zoomed ? "opacity-40" : ""}`}>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-medium tracking-tight">{shirt.title}</h2>
              {reason && <p className="mt-0.5 truncate text-xs text-muted">{reason}</p>}
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

function CardDetails({ shirt }: { shirt: ShirtProduct; score: number }) {
  const toggleFlip = useUiStore((s) => s.toggleFlip);
  const details = useShirtDetails(shirt.id);
  const openShare = useUiStore((s) => s.openShare);
  const undoable = useTasteStore(canUndo);
  const scroller = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; top: number } | null>(null);
  const round = "flex h-12 w-12 shrink-0 items-center justify-center rounded-control ring-1 ring-inset ring-white/25 hover:bg-white/5";

  // An empty spot tapped, or a drag down from the top of the text, turns back to the tee.
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, top: scroller.current?.scrollTop ?? 0 };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || (e.target instanceof Element && e.target.closest("button, a"))) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < TAP_SLOP || (dy > FLIP_BACK_DRAG && s.top <= 0 && dy > Math.abs(dx))) toggleFlip(false);
  };

  return (
    <div className="flex h-full flex-col" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* Fades at the bottom so text scrolling under the footer never looks cut. */}
      <div ref={scroller} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 [mask-image:linear-gradient(#000_calc(100%-24px),transparent)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-2">
            <h2 className="text-xl font-medium leading-tight">{shirt.title}</h2>
            <p className="mt-0.5 text-sm text-muted">{CATEGORY_LABELS[shirt.category]}</p>
          </div>
          {/* Closes the details (as a tap on an empty spot, Esc, or a drag down). */}
          <button type="button" onClick={() => toggleFlip(false)} aria-label="Back to the tee" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-neutral-300 hover:text-white">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Fetched with the card (lib/details); the space is held so nothing jumps. */}
        <p className="mt-4 min-h-[4.5rem] text-sm leading-relaxed text-neutral-300">{details?.description}</p>
      </div>

      {/* Within the thumb: undo, share and the tee's page (Save / Pass sit on the buttons below the card). */}
      <div className="flex items-center gap-2 border-t border-white/10 bg-ink-900 px-4 py-3">
        {undoable && (
          <button type="button" onClick={() => useTasteStore.getState().undoLast()} aria-label="Undo last swipe" title="Undo last swipe" className={round}>
            <Icon name="rotate-ccw" className="h-5 w-5" />
          </button>
        )}
        <button type="button" onClick={() => openShare(shirt.id, shirt.baseColor)} aria-label={`Share ${shirt.title}`} className={`${round} w-auto px-4 text-sm font-medium`}>
          Share
        </button>
        <Link href={productHref(shirt.id)} className={`flex-1 ${BUTTON_PRIMARY}`}>
          View tee →
        </Link>
      </div>
    </div>
  );
}

/** A pointer that moved less than this (px) tapped. */
const TAP_SLOP = 8;
/** A drag down this far (px) from the top of the details turns back to the tee. */
const FLIP_BACK_DRAG = 80;
