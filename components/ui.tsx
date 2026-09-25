"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useShirtStore } from "@/store/useShirtStore";
import { COLOR_LABELS, FEATURE_LABELS, SIZES, type BaseColor, type FeatureKey, type ShirtSize } from "@/types/shirt";

/** Tee colour picker. Every design comes in both; the original is labelled. */
export function ColorSelector({
  value,
  original,
  onChange,
  stopPointer = false,
}: {
  value: BaseColor;
  original: BaseColor;
  onChange: (color: BaseColor) => void;
  stopPointer?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tee colour">
      {(["black", "white"] as const).map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${COLOR_LABELS[c]} tee${c === original ? " (original)" : ""}`}
            onPointerDown={stopPointer ? (e) => e.stopPropagation() : undefined}
            onClick={() => onChange(c)}
            className={`flex h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition ${
              active ? "bg-white/10 text-white ring-2 ring-white" : "bg-white/[0.03] text-neutral-400 ring-1 ring-white/15 hover:bg-white/[0.07]"
            }`}
          >
            <span
              className={`h-6 w-6 shrink-0 rounded-full ring-1 ${c === "black" ? "bg-black ring-white/40" : "bg-white ring-black/20"}`}
              aria-hidden
            />
            <span className="flex-1 text-left">{COLOR_LABELS[c]}</span>
            {c === original && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                Original
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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
