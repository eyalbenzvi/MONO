"use client";

import { motion } from "framer-motion";
import { Heart, Info, X } from "lucide-react";
import { useShirtStore } from "@/store/useShirtStore";

export function ActionButtons() {
  const requestSwipe = useShirtStore((s) => s.requestSwipe);
  const toggleFlip = useShirtStore((s) => s.toggleFlip);
  const isFlipped = useShirtStore((s) => s.isFlipped);
  const empty = useShirtStore((s) => s.deck.length === 0);

  return (
    <div className="relative z-20 shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
      <div className="mx-auto flex max-w-[420px] items-center justify-center gap-6">
        <RoundButton
          label="Dislike"
          disabled={empty}
          onClick={() => requestSwipe("dislike")}
          className="h-16 w-16 bg-ink-800 text-rose-500 ring-1 ring-white/10 hover:bg-ink-700"
        >
          <X className="h-7 w-7" strokeWidth={2.75} />
        </RoundButton>
        <RoundButton
          label={isFlipped ? "Show back print" : "Show details"}
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
      onClick={onClick}
      whileTap={{ scale: 0.86 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className={`flex items-center justify-center rounded-full shadow-lg shadow-black/50 transition-colors disabled:opacity-30 ${className}`}
    >
      {children}
    </motion.button>
  );
}
