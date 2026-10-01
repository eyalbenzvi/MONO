"use client";

import { useState } from "react";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import { BuySheet } from "@/components/BuySheet";
import { Icon } from "@/components/Icon";
import { getShirtById } from "@/lib/catalog";
import type { ShirtProduct } from "@/types/shirt";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useHydrated } from "@/store/useUiStore";
import { SWIPE_LOCK, SWIPE_START, swipeDrag } from "@/lib/swipeDrag";

export function ActionButtons() {
  const requestSwipe = useTasteStore((s) => s.requestSwipe);
  const empty = useTasteStore((s) => s.deck.length === 0);
  const topId = useTasteStore((s) => s.deck[0]?.id);
  // The deck is known only after the stored taste loads: no link in the static HTML.
  const hydrated = useHydrated();
  // No Buy during the taste test: it returns once the taste is known.
  const { complete } = useCalibrationProgress();
  const top = hydrated && complete && topId ? getShirtById(topId) : undefined;
  // The tee being bought (the card stays where it is underneath).
  const [buying, setBuying] = useState<ShirtProduct | null>(null);
  // The buttons follow the card: the one it's heading for grows (and rings once letting go would count), the other fades.
  const reduce = useReducedMotion();
  const saveScale = useTransform(swipeDrag, [SWIPE_START, SWIPE_LOCK], [1, 1.08]);
  const passScale = useTransform(swipeDrag, [-SWIPE_LOCK, -SWIPE_START], [1.08, 1]);
  const saveDim = useTransform(swipeDrag, [-SWIPE_LOCK, -SWIPE_START], [0.45, 1]);
  const passDim = useTransform(swipeDrag, [SWIPE_START, SWIPE_LOCK], [1, 0.45]);
  const buyDim = useTransform(swipeDrag, [-SWIPE_LOCK, -SWIPE_START, SWIPE_START, SWIPE_LOCK], [0.45, 1, 1, 0.45]);
  const saveRing = useTransform(swipeDrag, (v) => (v >= SWIPE_LOCK ? 1 : 0));
  const passRing = useTransform(swipeDrag, (v) => (v <= -SWIPE_LOCK ? 1 : 0));

  return (
    <div className="relative z-20 shrink-0 px-4 pb-[max(calc(env(safe-area-inset-bottom)-var(--tabbar,0px)),14px)] pt-2 sideways:flex sideways:items-center sideways:py-2 sideways:pl-0 sideways:pr-[max(env(safe-area-inset-right),16px)]">
      {/* Pass and Save, and between them (once the taste is known) a small Buy: colour, size and
          "Buy now" in a sheet, without leaving the deck. Sideways phones: one column beside the card. */}
      <div className="mx-auto flex max-w-[420px] items-center justify-center sideways:flex-col sideways:gap-3">
        <div className="flex items-center justify-center gap-6 max-[339px]:gap-2 sideways:flex-col sideways:gap-3">
          <motion.div className="relative" style={{ opacity: passDim, scale: reduce ? 1 : passScale }}>
            <RoundButton
              label="Pass"
              disabled={empty}
              onClick={() => requestSwipe("dislike")}
              className="h-16 w-16 bg-ink-800 text-neutral-200 ring-1 ring-white/10 hover:bg-ink-700 max-[339px]:h-[52px] max-[339px]:w-[52px]"
            >
              <Icon name="x" className="h-7 w-7" strokeWidth={2.75} />
            </RoundButton>
            <motion.span aria-hidden style={{ opacity: passRing }} className="pointer-events-none absolute -inset-[5px] rounded-full ring-2 ring-white" />
          </motion.div>
          {top ? (
            <motion.div style={{ opacity: buyDim }}>
            <motion.button
              type="button"
              onClick={() => setBuying(top)}
              aria-label={`Buy ${top.title}`}
              aria-haspopup="dialog"
              title="Buy"
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex h-12 w-12 items-center justify-center rounded-full text-neutral-300 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon name="shopping-bag" className="h-5 w-5" strokeWidth={2} />
            </motion.button>
            </motion.div>
          ) : null}
          <motion.div className="relative" style={{ opacity: saveDim, scale: reduce ? 1 : saveScale }}>
            <RoundButton
              label="Save"
              disabled={empty}
              onClick={() => requestSwipe("like")}
              className="h-16 w-16 bg-white text-black hover:bg-neutral-200 max-[339px]:h-[52px] max-[339px]:w-[52px]"
            >
              <Icon name="heart" className="h-7 w-7 fill-current" />
            </RoundButton>
            <motion.span aria-hidden style={{ opacity: saveRing }} className="pointer-events-none absolute -inset-[5px] rounded-full ring-2 ring-white" />
          </motion.div>
        </div>
      </div>
      <BuySheet shirt={buying} onClose={() => setBuying(null)} />
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        onClick();
        // A mouse click leaves focus on the button, which would swallow the
        // arrow-key shortcuts (they skip focused controls). Keyboard presses
        // (detail === 0) keep focus where the user put it.
        if (e.detail > 0) e.currentTarget.blur();
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={`flex items-center justify-center rounded-full shadow-lg shadow-black/50 transition-colors disabled:opacity-50 ${className}`}
    >
      {children}
    </motion.button>
  );
}
