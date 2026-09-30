"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { ShirtCard } from "@/components/ShirtCard";
import { BUTTON_PRIMARY } from "@/components/ui";
import { useInPlaceZoom } from "@/hooks/useInPlaceZoom";
import { getShirtById } from "@/lib/catalog";
import { matchScore } from "@/lib/recommendation";
import { startOverWithUndo, useTasteStore, type DeckEntry } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

/** A mouse or trackpad (not touch): keyboard hints are for these. */
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(window.matchMedia("(pointer: fine)").matches), []);
  return fine;
}

/** A short haptic tick, once the page has been touched (before that, browsers refuse and log an error). */
const buzz = (ms: number) => {
  if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === false) return;
  navigator.vibrate?.(ms);
};
import { CATEGORY_LABELS, COLOR_LABELS, type SwipeAction } from "@/types/shirt";

/** Pointer travel that commits a swipe on release. */
const SWIPE_DISTANCE = 110;
/** Sideways drag elasticity: the card moves this share of the pointer travel. */
const ELASTIC_X = 0.9;
/** Card travel at the commit point, where the tint locks in. */
const STAMP_LOCK = SWIPE_DISTANCE * ELASTIC_X;
const SWIPE_VELOCITY = 550;
/** Raw pointer travel upward that opens details (the damped card moves ~⅛ of it). */
const FLIP_DISTANCE = 80;
/** The spring a card returns to the centre on (a cancelled drag, an undo). */
const SNAP_BACK = { type: "spring", stiffness: 500, damping: 32 } as const;
/** Button / keyboard swipes: short and snappy. */
const BUTTON_FLY_S = 0.26;
/** The most a card leans while dragged or flung (degrees). */
const MAX_TILT = 6;
/** Reduced motion: the card fades out instead of flying (ms). */
const REDUCED_FADE_MS = 150;
/** An upward drag flips to details only when it's this much more vertical than sideways. */
const VERTICAL_DOMINANCE = 1.5;

// Framer's tap gesture listens natively, so React's stopPropagation on child
// controls doesn't stop it — filter taps that start on interactive elements.
const INTERACTIVE = "button, a, input, select, textarea, label";
const fromControl = (e: Event | React.PointerEvent) =>
  e.target instanceof Element && e.target.closest(INTERACTIVE) !== null;

export function CardStack() {
  const deck = useTasteStore((s) => s.deck);
  const vector = useTasteStore((s) => s.preferenceVector);
  const isFlipped = useUiStore((s) => s.isFlipped);
  // "Reset taste" wipes taste and Saved: offer an Undo that restores it all.
  const startOver = startOverWithUndo;
  const [hearts, setHearts] = useState<{ id: number; from: DOMRect; to: DOMRect }[]>([]);
  const reduceMotion = useReducedMotion();

  const visible = deck.slice(0, 3);

  // A save sends a small heart from the card to the You tab.
  const onLiked = useCallback(
    (cardRect: DOMRect) => {
      buzz(8);
      if (reduceMotion) return;
      const target = document.querySelector("[data-saved-target]");
      if (!target) return;
      setHearts((h) => [...h, { id: Date.now() + Math.random(), from: cardRect, to: target.getBoundingClientRect() }]);
    },
    [reduceMotion],
  );

  if (visible.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h2 className="text-xl font-medium">You&rsquo;ve seen the whole drop</h2>
        <p className="max-w-xs text-sm text-neutral-400">Your edit is ranked by every swipe.</p>
        <Link href="/shop/" className={`mt-2 w-full max-w-xs ${BUTTON_PRIMARY}`}>
          See your edit
        </Link>
        <button type="button" onClick={startOver} className="h-11 min-w-11 px-5 text-sm text-neutral-400 hover:text-white">
          Reset taste
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-full w-full max-w-[420px]">
      {visible
        .map((entry, depth) => ({ entry, depth }))
        .reverse()
        .map(({ entry, depth }) => {
          const shirt = getShirtById(entry.id);
          if (!shirt) return null;
          const score = matchScore(vector, shirt.features);
          return depth === 0 ? (
            <TopCard key={entry.id} entry={entry} score={score} isFlipped={isFlipped} onLiked={onLiked} />
          ) : (
            <motion.div
              key={entry.id}
              className="pointer-events-none absolute inset-0 will-change-transform"
              initial={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: 0 }}
              animate={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: depth === 1 ? 1 : 0.6 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              aria-hidden
            >
              <ShirtCard shirt={shirt} strategy={entry.strategy} score={score} isFlipped={false} isTop={false} />
            </motion.div>
          );
        })}

      {/* Heart flights (fixed layer, above everything) */}
      <AnimatePresence>
        {hearts.map((h) => (
          <HeartFlight key={h.id} from={h.from} to={h.to} onDone={() => setHearts((all) => all.filter((x) => x.id !== h.id))} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function HeartFlight({ from, to, onDone }: { from: DOMRect; to: DOMRect; onDone: () => void }) {
  const x0 = from.left + from.width / 2 - 8;
  const y0 = from.top + from.height / 2 - 8;
  const x1 = to.left + to.width / 2 - 8;
  const y1 = to.top + to.height / 2 - 8;
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[70] text-white"
      initial={{ x: x0, y: y0, scale: 1.4, opacity: 1 }}
      // Curved path: rise first, then arc into the icon.
      animate={{ x: [x0, (x0 + x1) / 2, x1], y: [y0, Math.min(y0, y1) - 40, y1], scale: [1.4, 1.1, 0.7], opacity: [1, 1, 0.9] }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      onAnimationComplete={onDone}
      aria-hidden
    >
      <Icon name="heart" className="h-4 w-4 fill-current" />
    </motion.div>
  );
}

function TopCard({
  entry,
  score,
  isFlipped,
  onLiked,
}: {
  entry: DeckEntry;
  score: number;
  isFlipped: boolean;
  onLiked: (rect: DOMRect) => void;
}) {
  const shirt = getShirtById(entry.id)!;
  const commitSwipe = useTasteStore((s) => s.commitSwipe);
  const toggleFlip = useUiStore((s) => s.toggleFlip);
  const queueHead = useUiStore((s) => s.swipeQueue[0]);
  const onboardingSeen = useTasteStore((s) => s.onboardingSeen);
  const firstEver = useTasteStore((s) => s.seen.length === 0);
  const undoFx = useUiStore((s) => (s.undoFx?.id === entry.id ? s.undoFx : null));
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // A gentle lean (never more than MAX_TILT), and a tint instead of words:
  // a light wash towards Save, a dim towards Pass.
  const rotate = useTransform(x, [-240, 0, 240], [-MAX_TILT, 0, MAX_TILT]);
  const saveTint = useTransform(x, [20, STAMP_LOCK], [0, 0.14]);
  const passTint = useTransform(x, [-STAMP_LOCK, -20], [0.4, 0]);
  // Crossing the commit point: the phone ticks once, so you know letting go
  // now counts.
  const lockedRef = useRef<SwipeAction | null>(null);
  useMotionValueEvent(x, "change", (v) => {
    const next: SwipeAction | null = v >= STAMP_LOCK ? "like" : v <= -STAMP_LOCK ? "dislike" : null;
    if (next === lockedRef.current) return;
    lockedRef.current = next;
    if (next && !leaving.current) buzz(4);
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  // Mirrors `leaving` for rendering: a card on its way out takes no gestures.
  const [isLeaving, setIsLeaving] = useState(false);
  const dragged = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fallback.current) clearTimeout(fallback.current);
  }, []);

  const flyOut = useCallback(
    (action: SwipeAction, velocity?: { x: number; y: number }, fromQueue = false) => {
      if (leaving.current) return;
      leaving.current = true;
      setIsLeaving(true);
      if (action === "like" && cardRef.current) onLiked(cardRef.current.getBoundingClientRect());
      else buzz(8);
      const dir = action === "like" ? 1 : -1;
      const width = typeof window !== "undefined" ? window.innerWidth : 500;
      const targetX = dir * (width + 200);
      // Drags carry their throw speed; buttons/keys use a fixed snappy duration.
      const duration = velocity
        ? Math.min(0.45, Math.max(0.2, Math.abs(targetX - x.get()) / Math.max(Math.abs(velocity.x), 900)))
        : BUTTON_FLY_S;
      // Commit exactly once — when the fly-out finishes, or via the fallback
      // timer if something interrupts the animation (framer-motion stops a
      // running value animation when the element is touched again, and
      // onComplete then never fires; that used to leave the card stuck).
      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        if (fallback.current) clearTimeout(fallback.current);
        commitSwipe(entry.id, action, fromQueue);
      };
      fallback.current = setTimeout(commit, duration * 1000 + 150);
      const el = cardRef.current;
      const targetY = y.get() + (velocity?.y ?? 0) * duration * 0.4;
      if (el && typeof el.animate === "function") {
        // Fly out on the compositor (Web Animations): a busy main thread —
        // React re-rendering, the next card mounting — can't stall or skip
        // it, so the card always visibly leaves. Framer's own release spring
        // is stopped so x stays put (and the tint stays on).
        x.stop();
        y.stop();
        // Reduced motion: the card fades where it is, no flight or turn.
        const anim = reduceMotion
          ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REDUCED_FADE_MS, easing: "ease-out", fill: "forwards" })
          : el.animate([{ transform: getComputedStyle(el).transform }, { transform: `translateX(${targetX}px) translateY(${targetY}px) rotate(${dir * MAX_TILT}deg)` }], {
              duration: duration * 1000,
              easing: "cubic-bezier(0.2, 0.7, 0.4, 1)",
              fill: "forwards",
            });
        if (reduceMotion && fallback.current) {
          clearTimeout(fallback.current);
          fallback.current = setTimeout(commit, REDUCED_FADE_MS + 150);
        }
        anim.onfinish = commit;
      } else {
        animate(y, targetY, { duration, ease: "easeOut" });
        animate(x, targetX, { duration, ease: [0.2, 0.7, 0.4, 1], onComplete: commit });
      }
    },
    [commitSwipe, entry.id, onLiked, x, y, reduceMotion],
  );

  // Pinch zooms the picture in place; the card lets go of the finger and
  // settles, and swipes wait until the picture is back to its whole.
  const zoom = useInPlaceZoom(cardRef, !isFlipped && !isLeaving, () => {
    animate(x, 0, SNAP_BACK);
    animate(y, 0, SNAP_BACK);
  });
  const { reset: resetZoom } = zoom;
  // Flipping or leaving shows the whole picture again.
  useEffect(() => {
    if (isFlipped || isLeaving) resetZoom(true);
  }, [isFlipped, isLeaving, resetZoom]);

  // Queued button / keyboard swipes — the head of the queue runs on this card.
  useEffect(() => {
    if (!queueHead) return;
    // Like / Pass while zoomed: the picture comes back whole, then the card goes.
    resetZoom(true);
    flyOut(queueHead.action, undefined, true);
  }, [queueHead, flyOut, resetZoom]);

  // Undo: fly back in from the side the card left.
  useEffect(() => {
    if (!undoFx) return;
    const width = typeof window !== "undefined" ? window.innerWidth : 500;
    x.set((undoFx.action === "like" ? 1 : -1) * (width + 100));
    animate(x, 0, {
      type: "spring",
      stiffness: 400,
      damping: 30,
      onComplete: () => useUiStore.setState({ undoFx: null }),
    });
  }, [undoFx, x]);

  // First-run hint: one gentle wiggle, so the card shows it moves.
  // With reduced motion the strip's words explain it alone.
  const hinted = useRef(false);
  useEffect(() => {
    if (onboardingSeen || !firstEver || reduceMotion || hinted.current) return;
    hinted.current = true;
    const t = setTimeout(() => {
      if (dragged.current || leaving.current) return;
      animate(x, [0, 36, -36, 0], { duration: 0.9, ease: "easeInOut" });
    }, 600);
    return () => clearTimeout(t);
  }, [onboardingSeen, firstEver, reduceMotion, x]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    // A drag that turned into a pinch never swipes: the card settles.
    if (zoom.zoomed || zoom.moved()) {
      animate(x, 0, SNAP_BACK);
      animate(y, 0, SNAP_BACK);
      return;
    }
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return flyOut("like", velocity);
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return flyOut("dislike", velocity);
    // Details only for a clearly vertical flick: a thumb arc must not flip the card.
    if ((offset.y < -FLIP_DISTANCE || velocity.y < -500) && Math.abs(offset.y) > VERTICAL_DOMINANCE * Math.abs(offset.x)) toggleFlip();
    // Snap back.
    animate(x, 0, SNAP_BACK);
    animate(y, 0, SNAP_BACK);
  };

  return (
    <motion.div
      ref={cardRef}
      // will-change: the card is its own compositor layer, so dragging and
      // flying it moves a cached bitmap instead of repainting the tee.
      // Keyboard users reach the card itself: ← / → / space act on it (see
      // DiscoverPage); the keys are described only where there's a keyboard.
      tabIndex={0}
      role="group"
      aria-roledescription="card"
      aria-label={`${shirt.title}, ${CATEGORY_LABELS[shirt.category]}, ${COLOR_LABELS[shirt.baseColor].toLowerCase()} tee`}
      aria-describedby={finePointer ? "card-keys" : undefined}
      className={`absolute inset-0 outline-none will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isFlipped ? "" : "cursor-grab touch-none active:cursor-grabbing"} ${isLeaving ? "pointer-events-none" : ""}`}
      style={{ x, y, rotate }}
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      // Drag is disabled while flipped so the details panel can scroll natively.
      // No direction lock: a thumb arc that starts slightly upward used to
      // lock the card to the vertical axis, so it ignored the sideways finger
      // (yet the swipe still counted on release). Vertical travel is damped
      // by dragElastic instead.
      drag={!isFlipped && !isLeaving && !zoom.zoomed}
      // Sideways swipes are free; vertical travel is heavily damped so the
      // card never slides over the header.
      dragElastic={{ left: ELASTIC_X, right: ELASTIC_X, top: 0.12, bottom: 0.08 }}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragMomentum={false}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={onDragEnd}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onTap={(e) => {
        // The details face handles its own taps (an empty spot flips back).
        if (isFlipped || leaving.current || dragged.current || fromControl(e)) return;
        // Zoomed: a tap brings the whole picture back. Otherwise a second tap
        // soon after zooms in there; a single tap shows the details.
        zoom.tap(e as PointerEvent, () => !leaving.current && toggleFlip(true));
      }}
    >
      <ShirtCard shirt={shirt} strategy={entry.strategy} score={score} isFlipped={isFlipped} isTop zoom={zoom.values} zoomed={zoom.zoomed} />
      <span className="sr-only" aria-live="polite">
        {zoom.announce}
      </span>

      {/* The swipe's tint: no words, just light or shade over the card. */}
      <motion.div aria-hidden style={{ opacity: saveTint }} className="pointer-events-none absolute inset-0 bg-white will-change-[opacity]" />
      <motion.div aria-hidden style={{ opacity: passTint }} className="pointer-events-none absolute inset-0 bg-black will-change-[opacity]" />
      {finePointer && (
        <span id="card-keys" className="sr-only">
          Left arrow passes, right arrow saves, space shows details.
        </span>
      )}
    </motion.div>
  );
}
