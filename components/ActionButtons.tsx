"use client";

import { motion } from "framer-motion";
import { Heart, Info, RotateCcw, X } from "lucide-react";
import { canUndo, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

export function ActionButtons() {
  const requestSwipe = useTasteStore((s) => s.requestSwipe);
  const toggleFlip = useUiStore((s) => s.toggleFlip);
  const undoLast = useTasteStore((s) => s.undoLast);
  const isFlipped = useUiStore((s) => s.isFlipped);
  const empty = useTasteStore((s) => s.deck.length === 0);
  const undoable = useTasteStore(canUndo);

  return (
    <div className="relative z-20 shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
      <div className="mx-auto grid max-w-[420px] grid-cols-[44px_1fr_44px] items-center">
        <RoundButton
          label="Undo last swipe"
          disabled={!undoable}
          onClick={undoLast}
          className="h-11 w-11 bg-ink-800 text-neutral-300 ring-1 ring-white/10 hover:bg-ink-700"
        >
          <RotateCcw className="h-[18px] w-[18px]" />
        </RoundButton>
        <div className="flex items-center justify-center gap-6">
          <RoundButton
            label="Pass"
            disabled={empty}
            onClick={() => requestSwipe("dislike")}
            className="h-16 w-16 bg-ink-800 text-rose-500 ring-1 ring-white/10 hover:bg-ink-700"
          >
            <X className="h-7 w-7" strokeWidth={2.75} />
          </RoundButton>
          <RoundButton
            label={isFlipped ? "Back to the tee" : "Show details"}
            disabled={empty}
            onClick={() => toggleFlip()}
            className={`h-12 w-12 ring-1 ring-white/10 ${
              isFlipped ? "bg-white text-black" : "bg-ink-800 text-neutral-200 hover:bg-ink-700"
            }`}
          >
            <Info className="h-5 w-5" />
          </RoundButton>
          <RoundButton
            label="Like"
            disabled={empty}
            onClick={() => requestSwipe("like")}
            className="h-16 w-16 bg-white text-black hover:bg-neutral-200"
          >
            <Heart className="h-7 w-7 fill-current" />
          </RoundButton>
        </div>
        <span aria-hidden />
      </div>
      <p className="mt-2 hidden text-center text-[11px] text-neutral-500 sm:block">
        ← pass · → like · space details · Z undo
      </p>
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
      whileTap={{ scale: 0.86 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className={`flex items-center justify-center rounded-full shadow-lg shadow-black/50 transition-colors disabled:opacity-30 ${className}`}
    >
      {children}
    </motion.button>
  );
}
