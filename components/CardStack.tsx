"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Heart, RefreshCw, X } from "lucide-react";
import { ShirtCard } from "@/components/ShirtCard";
import { getShirtById } from "@/lib/mockData";
import { matchScore } from "@/lib/recommendation";
import { useShirtStore, type DeckEntry } from "@/store/useShirtStore";
import type { SwipeAction } from "@/types/shirt";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 550;
const FLIP_DISTANCE = 90;
const LONG_PRESS_MS = 450;

export function CardStack() {
  const deck = useShirtStore((s) => s.deck);
  const vector = useShirtStore((s) => s.preferenceVector);
  const isFlipped = useShirtStore((s) => s.isFlipped);
  const reset = useShirtStore((s) => s.reset);
  const likedCount = useShirtStore((s) => s.likedIds.length);

  const visible = deck.slice(0, 3);

  if (visible.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          <RefreshCw className="h-7 w-7 text-neutral-400" />
        </div>
        <h2 className="text-lg font-semibold">You&apos;ve seen the whole drop</h2>
        <p className="max-w-xs text-sm text-neutral-400">
          {likedCount > 0
            ? `${likedCount} tee${likedCount === 1 ? "" : "s"} saved to your list. Start over to retrain from scratch.`
            : "Nothing caught your eye. Start over to retrain the engine from scratch."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 h-11 rounded-full bg-white px-6 text-sm font-semibold text-black active:scale-95"
        >
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
            <TopCard key={entry.id} entry={entry} score={score} isFlipped={isFlipped} />
          ) : (
            <motion.div
              key={entry.id}
              className="pointer-events-none absolute inset-0"
              initial={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: 0 }}
              animate={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: depth === 1 ? 1 : 0.6 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              aria-hidden
            >
              <ShirtCard shirt={shirt} strategy={entry.strategy} score={score} isFlipped={false} isTop={false} />
            </motion.div>
          );
        })}
    </div>
  );
}

function TopCard({ entry, score, isFlipped }: { entry: DeckEntry; score: number; isFlipped: boolean }) {
  const shirt = getShirtById(entry.id)!;
  const commitSwipe = useShirtStore((s) => s.commitSwipe);
  const toggleFlip = useShirtStore((s) => s.toggleFlip);
  const swipeRequest = useShirtStore((s) => s.swipeRequest);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-16, 0, 16]);
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const infoOpacity = useTransform(y, [-FLIP_DISTANCE, -20], [1, 0]);

  const leaving = useRef(false);
  const dragged = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const flyOut = useCallback(
    (action: SwipeAction, velocity = { x: 0, y: 0 }) => {
      if (leaving.current) return;
      leaving.current = true;
      const dir = action === "like" ? 1 : -1;
      const width = typeof window !== "undefined" ? window.innerWidth : 500;
      const targetX = dir * (width + 200);
      // Carry the throw speed: faster flicks leave faster.
      const speed = Math.max(Math.abs(velocity.x), 900);
      const duration = Math.min(0.45, Math.max(0.2, Math.abs(targetX - x.get()) / speed));
      animate(y, y.get() + velocity.y * duration * 0.4, { duration, ease: "easeOut" });
      animate(x, targetX, {
        duration,
        ease: [0.2, 0.7, 0.4, 1],
        onComplete: () => commitSwipe(entry.id, action),
      });
    },
    [commitSwipe, entry.id, x, y],
  );

  // Button / keyboard driven swipes.
  useEffect(() => {
    if (swipeRequest) flyOut(swipeRequest.action);
  }, [swipeRequest, flyOut]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return flyOut("like", velocity);
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return flyOut("dislike", velocity);
    if (offset.y < -FLIP_DISTANCE && Math.abs(offset.x) < SWIPE_DISTANCE) toggleFlip();
    // Snap back.
    animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    animate(y, 0, { type: "spring", stiffness: 500, damping: 32 });
  };

  return (
    <motion.div
      className={`absolute inset-0 ${isFlipped ? "" : "cursor-grab touch-none active:cursor-grabbing"}`}
      style={{ x, y, rotate }}
      initial={{ scale: 0.95, y: 16 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      // Drag is disabled while flipped so the details panel can scroll natively.
      drag={!isFlipped}
      dragElastic={0.9}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragMomentum={false}
      onDragStart={() => {
        dragged.current = true;
        clearPress();
      }}
      onDragEnd={onDragEnd}
      onPointerDown={() => {
        dragged.current = false;
        longPressed.current = false;
        clearPress();
        pressTimer.current = setTimeout(() => {
          if (!dragged.current) {
            longPressed.current = true;
            toggleFlip();
          }
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onTap={() => {
        if (leaving.current || dragged.current || longPressed.current) return;
        toggleFlip();
      }}
    >
      <ShirtCard shirt={shirt} strategy={entry.strategy} score={score} isFlipped={isFlipped} isTop />

      {/* Swipe stamps */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-6 top-16 flex -rotate-12 items-center gap-1.5 rounded-xl border-[3px] border-emerald-400 bg-black/40 px-3 py-1.5 text-2xl font-black tracking-widest text-emerald-400 backdrop-blur-sm"
      >
        <Heart className="h-6 w-6 fill-current" /> LIKE
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute right-6 top-16 flex rotate-12 items-center gap-1.5 rounded-xl border-[3px] border-rose-500 bg-black/40 px-3 py-1.5 text-2xl font-black tracking-widest text-rose-500 backdrop-blur-sm"
      >
        <X className="h-6 w-6" strokeWidth={3} /> NOPE
      </motion.div>
      <motion.div
        style={{ opacity: infoOpacity }}
        className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-black"
      >
        {isFlipped ? "Back print" : "Details"}
      </motion.div>
    </motion.div>
  );
}
