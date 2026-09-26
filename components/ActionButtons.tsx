"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
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
    <div className="relative z-20 shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2 sideways:flex sideways:items-center sideways:py-2 sideways:pl-0 sideways:pr-[max(env(safe-area-inset-right),16px)]">
      {/* Sideways phones: one column beside the card (undo, pass, details, like). */}
      {/* Narrowest phones (< 340 px): smaller gaps and main buttons so the row fits. */}
      <div className="mx-auto grid max-w-[420px] grid-cols-[44px_1fr_44px] items-center max-[339px]:grid-cols-[36px_1fr_36px] max-[339px]:gap-x-1.5 sideways:flex sideways:flex-col sideways:gap-3">
        <RoundButton
          label="Undo last swipe"
          disabled={!undoable}
          onClick={undoLast}
          className="h-11 w-11 bg-ink-800 text-neutral-300 ring-1 ring-white/10 hover:bg-ink-700 max-[339px]:h-9 max-[339px]:w-9"
        >
          <Icon name="rotate-ccw" className="h-[18px] w-[18px]" />
        </RoundButton>
        <div className="flex items-center justify-center gap-6 max-[339px]:gap-2 sideways:flex-col sideways:gap-3">
          <RoundButton
            label="Pass"
            disabled={empty}
            onClick={() => requestSwipe("dislike")}
            className="h-16 w-16 bg-ink-800 text-neutral-200 ring-1 ring-white/10 hover:bg-ink-700 max-[339px]:h-[52px] max-[339px]:w-[52px]"
          >
            <Icon name="x" className="h-7 w-7" strokeWidth={2.75} />
          </RoundButton>
          <RoundButton
            label={isFlipped ? "Back to the tee" : "Show details"}
            disabled={empty}
            onClick={() => toggleFlip()}
            className={`h-12 w-12 ring-1 ring-white/10 max-[339px]:h-11 max-[339px]:w-11 ${
              isFlipped ? "bg-white text-black" : "bg-ink-800 text-neutral-200 hover:bg-ink-700"
            }`}
          >
            <Icon name="info" className="h-5 w-5" />
          </RoundButton>
          <RoundButton
            label="Like"
            disabled={empty}
            onClick={() => requestSwipe("like")}
            className="h-16 w-16 bg-white text-black hover:bg-neutral-200 max-[339px]:h-[52px] max-[339px]:w-[52px]"
          >
            <Icon name="heart" className="h-7 w-7 fill-current" />
          </RoundButton>
        </div>
        <span aria-hidden className="sideways:hidden" />
      </div>
      {/* Keyboard shortcuts only where there's a keyboard-and-mouse setup. */}
      <p className="mt-2 hidden text-center text-xs text-neutral-400 sideways:!hidden [@media(hover:hover)_and_(pointer:fine)]:sm:block">
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
      className={`flex items-center justify-center rounded-full shadow-lg shadow-black/50 transition-colors disabled:opacity-50 ${className}`}
    >
      {children}
    </motion.button>
  );
}
