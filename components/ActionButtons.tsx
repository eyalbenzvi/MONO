"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BuySheet } from "@/components/BuySheet";
import { Icon } from "@/components/Icon";
import { getShirtById } from "@/lib/catalog";
import type { ShirtProduct } from "@/types/shirt";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useHydrated } from "@/store/useUiStore";

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

  return (
    <div className="relative z-20 shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2 sideways:flex sideways:items-center sideways:py-2 sideways:pl-0 sideways:pr-[max(env(safe-area-inset-right),16px)]">
      {/* Pass and Save, and between them (once the taste is known) a small Buy: colour, size and
          "Buy now" in a sheet, without leaving the deck. Sideways phones: one column beside the card. */}
      <div className="mx-auto flex max-w-[420px] items-center justify-center sideways:flex-col sideways:gap-3">
        <div className="flex items-center justify-center gap-6 max-[339px]:gap-2 sideways:flex-col sideways:gap-3">
          <RoundButton
            label="Pass"
            disabled={empty}
            onClick={() => requestSwipe("dislike")}
            className="h-16 w-16 bg-ink-800 text-neutral-200 ring-1 ring-white/10 hover:bg-ink-700 max-[339px]:h-[52px] max-[339px]:w-[52px]"
          >
            <Icon name="x" className="h-7 w-7" strokeWidth={2.75} />
          </RoundButton>
          {top ? (
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
          ) : null}
          <RoundButton
            label="Save"
            disabled={empty}
            onClick={() => requestSwipe("like")}
            className="h-16 w-16 bg-white text-black hover:bg-neutral-200 max-[339px]:h-[52px] max-[339px]:w-[52px]"
          >
            <Icon name="heart" className="h-7 w-7 fill-current" />
          </RoundButton>
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
