"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useShirtStore } from "@/store/useShirtStore";
import { FEATURE_LABELS, SIZES, type FeatureKey, type ShirtSize } from "@/types/shirt";

export function MatchBadge({ score, tone = "light", size = "md" }: { score: number; tone?: "light" | "dark"; size?: "sm" | "md" }) {
  return (
    <motion.span
      key={score}
      initial={{ scale: 0.9, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex shrink-0 items-center rounded-full font-mono font-bold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      } ${tone === "light" ? "bg-white text-black" : "bg-black text-white"}`}
    >
      {score}% Match
    </motion.span>
  );
}

export function SizeSelector({
  value,
  onChange,
  stopPointer = false,
}: {
  value?: ShirtSize;
  onChange: (size: ShirtSize) => void;
  /** Stop pointer events from reaching a draggable parent (swipe card). */
  stopPointer?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Size">
      {SIZES.map((size) => {
        const active = value === size;
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={active}
            onPointerDown={stopPointer ? (e) => e.stopPropagation() : undefined}
            onClick={() => onChange(size)}
            className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
              active ? "bg-white text-black" : "bg-white/5 text-neutral-200 ring-1 ring-white/15 hover:bg-white/10"
            }`}
          >
            {size}
          </button>
        );
      })}
    </div>
  );
}

export function SaveButton({ id, className = "" }: { id: string; className?: string }) {
  const saved = useShirtStore((s) => s.likedIds.includes(id));
  const toggleSaved = useShirtStore((s) => s.toggleSaved);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(id);
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`flex items-center justify-center rounded-full backdrop-blur-md transition-colors ${
        saved ? "bg-white text-black" : "bg-black/50 text-white ring-1 ring-white/15 hover:bg-black/70"
      } ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
    </motion.button>
  );
}

export function TraitChips({ keys, className = "" }: { keys: FeatureKey[]; className?: string }) {
  if (keys.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {keys.map((k) => (
        <span key={k} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-neutral-300 ring-1 ring-white/10">
          {FEATURE_LABELS[k]}
        </span>
      ))}
    </div>
  );
}

/** Studio backdrop behind garment mockups. */
export const STAGE_BG =
  "bg-[radial-gradient(ellipse_at_50%_38%,#5a5a57_0%,#3a3a38_45%,#1d1d1c_100%)]";
