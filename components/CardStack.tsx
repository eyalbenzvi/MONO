"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { ArrowRight, Heart, RefreshCw, X } from "lucide-react";
import { ShirtCard } from "@/components/ShirtCard";
import { ZoomViewer } from "@/components/ZoomViewer";
import { getShirtById } from "@/lib/catalog";
import { matchScore } from "@/lib/recommendation";
import { useShirtStore, type DeckEntry } from "@/store/useShirtStore";
import type { SwipeAction } from "@/types/shirt";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 550;
/** Raw pointer travel upward that opens details (the damped card moves ~⅛ of it). */
const FLIP_DISTANCE = 80;
/** Button / keyboard swipes: short and snappy. */
const BUTTON_FLY_S = 0.26;

// Framer's tap gesture listens natively, so React's stopPropagation on child
// controls doesn't stop it — filter taps that start on interactive elements.
const INTERACTIVE = "button, a, input, select, textarea, label";
const fromControl = (e: Event | React.PointerEvent) =>
  e.target instanceof Element && e.target.closest(INTERACTIVE) !== null;

export function CardStack() {
  const deck = useShirtStore((s) => s.deck);
  const vector = useShirtStore((s) => s.preferenceVector);
  const isFlipped = useShirtStore((s) => s.isFlipped);
  const reset = useShirtStore((s) => s.reset);
  const likedCount = useShirtStore((s) => s.likedIds.length);
  const [hearts, setHearts] = useState<{ id: number; from: DOMRect; to: DOMRect }[]>([]);
  const reduceMotion = useReducedMotion();

  const visible = deck.slice(0, 3);

  // A like sends a small heart from the card to the Saved icon in the header.
  const onLiked = useCallback(
    (cardRect: DOMRect) => {
      navigator.vibrate?.(8);
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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          <RefreshCw className="h-7 w-7 text-neutral-400" />
        </div>
        <h2 className="text-lg font-semibold">You&apos;ve seen the whole drop</h2>
        <p className="max-w-xs text-sm text-neutral-400">
          {likedCount > 0
            ? `${likedCount} tee${likedCount === 1 ? "" : "s"} saved. Your shop is ranked by everything you swiped.`
            : "Nothing caught your eye yet — the shop is still ranked by what you passed on."}
        </p>
        <Link
          href="/shop/"
          className="mt-2 flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black active:scale-95"
        >
          See my shop <ArrowRight className="h-4 w-4" />
        </Link>
        <button type="button" onClick={reset} className="h-11 rounded-full px-5 text-sm font-medium text-neutral-400 hover:text-white">
          Start over
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
      <Heart className="h-4 w-4 fill-current" />
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
  const commitSwipe = useShirtStore((s) => s.commitSwipe);
  const toggleFlip = useShirtStore((s) => s.toggleFlip);
  const queueHead = useShirtStore((s) => s.swipeQueue[0]);
  const onboardingSeen = useShirtStore((s) => s.onboardingSeen);
  const firstEver = useShirtStore((s) => s.swipeHistory.length === 0);
  const undoFx = useShirtStore((s) => (s.undoFx?.id === entry.id ? s.undoFx : null));
  const reduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-16, 0, 16]);
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const infoOpacity = useTransform(y, [-14, -3], [1, 0]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);
  const openZoom = useCallback(() => setZoom(true), []);
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
      else navigator.vibrate?.(8);
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
        // is stopped so x stays put (and the LIKE / NOPE stamp stays lit).
        x.stop();
        y.stop();
        const from = getComputedStyle(el).transform;
        const to = `translateX(${targetX}px) translateY(${targetY}px) rotate(${dir * 22}deg)`;
        const anim = el.animate([{ transform: from === "none" ? "none" : from }, { transform: to }], {
          duration: duration * 1000,
          easing: "cubic-bezier(0.2, 0.7, 0.4, 1)",
          fill: "forwards",
        });
        anim.onfinish = commit;
      } else {
        animate(y, targetY, { duration, ease: "easeOut" });
        animate(x, targetX, { duration, ease: [0.2, 0.7, 0.4, 1], onComplete: commit });
      }
    },
    [commitSwipe, entry.id, onLiked, x, y],
  );

  // Pinch on the card (two fingers) opens the zoom view instead of dragging.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length < 2 || leaving.current || useShirtStore.getState().isFlipped) return;
      e.preventDefault();
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
      animate(y, 0, { type: "spring", stiffness: 500, damping: 32 });
      setZoom(true);
    };
    el.addEventListener("touchstart", onTouch, { passive: false });
    return () => el.removeEventListener("touchstart", onTouch);
  }, [x, y]);

  // Queued button / keyboard swipes — the head of the queue runs on this card.
  useEffect(() => {
    if (queueHead) flyOut(queueHead.action, undefined, true);
  }, [queueHead, flyOut]);

  // Undo: fly back in from the side the card left.
  useEffect(() => {
    if (!undoFx) return;
    const width = typeof window !== "undefined" ? window.innerWidth : 500;
    x.set((undoFx.action === "like" ? 1 : -1) * (width + 100));
    animate(x, 0, {
      type: "spring",
      stiffness: 400,
      damping: 30,
      onComplete: () => useShirtStore.setState({ undoFx: null }),
    });
  }, [undoFx, x]);

  // First-run hint: one gentle wiggle so LIKE / NOPE reveal themselves.
  const hinted = useRef(false);
  useEffect(() => {
    if (onboardingSeen || !firstEver || reduceMotion || hinted.current) return;
    hinted.current = true;
    const t = setTimeout(() => {
      if (dragged.current || leaving.current) return;
      animate(x, [0, 36, -36, 0], { duration: 0.9, ease: "easeInOut" });
    }, 1000);
    return () => clearTimeout(t);
  }, [onboardingSeen, firstEver, reduceMotion, x]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return flyOut("like", velocity);
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return flyOut("dislike", velocity);
    if ((offset.y < -FLIP_DISTANCE || velocity.y < -500) && Math.abs(offset.x) < SWIPE_DISTANCE) toggleFlip();
    // Snap back.
    animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    animate(y, 0, { type: "spring", stiffness: 500, damping: 32 });
  };

  return (
    <motion.div
      ref={cardRef}
      // will-change: the card is its own compositor layer, so dragging and
      // flying it moves a cached bitmap instead of repainting the tee.
      className={`absolute inset-0 will-change-transform ${isFlipped ? "" : "cursor-grab touch-none active:cursor-grabbing"} ${isLeaving ? "pointer-events-none" : ""}`}
      style={{ x, y, rotate }}
      initial={{ scale: 0.95, y: 16 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      // Drag is disabled while flipped so the details panel can scroll natively.
      // No direction lock: a thumb arc that starts slightly upward used to
      // lock the card to the vertical axis, so it ignored the sideways finger
      // (yet the swipe still counted on release). Vertical travel is damped
      // by dragElastic instead.
      drag={!isFlipped && !isLeaving && !zoom}
      // Sideways swipes are free; vertical travel is heavily damped so the
      // card never slides over the header.
      dragElastic={{ left: 0.9, right: 0.9, top: 0.12, bottom: 0.08 }}
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
        // On the details face taps do nothing — flip back via Back / ⓘ / Esc.
        if (isFlipped || leaving.current || dragged.current || fromControl(e)) return;
        toggleFlip();
      }}
    >
      <ShirtCard shirt={shirt} strategy={entry.strategy} score={score} isFlipped={isFlipped} isTop onZoom={openZoom} />
      <AnimatePresence>{zoom && <ZoomViewer shirt={shirt} color={shirt.baseColor} onClose={() => setZoom(false)} />}</AnimatePresence>

      {/* Swipe stamps */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-6 top-16 flex -rotate-12 items-center gap-1.5 rounded-xl border-[3px] border-emerald-400 bg-black/70 px-3 py-1.5 text-2xl font-black tracking-widest text-emerald-400 will-change-[opacity]"
      >
        <Heart className="h-6 w-6 fill-current" /> LIKE
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute right-6 top-16 flex rotate-12 items-center gap-1.5 rounded-xl border-[3px] border-rose-500 bg-black/70 px-3 py-1.5 text-2xl font-black tracking-widest text-rose-500 will-change-[opacity]"
      >
        <X className="h-6 w-6" strokeWidth={3} /> NOPE
      </motion.div>
      <motion.div
        style={{ opacity: infoOpacity }}
        className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-black"
      >
        {isFlipped ? "Back" : "Details"}
      </motion.div>

      {/* First-run gesture legend */}
      <AnimatePresence>
        {!onboardingSeen && !isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.4 }}
            className="pointer-events-none absolute inset-x-0 bottom-[84px] mx-auto w-fit whitespace-nowrap rounded-full bg-black/75 px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15"
          >
            ← Pass · Tap for details · Like →
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
