"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useCalibrationProgress, useShirtStore } from "@/store/useShirtStore";
import { COLOR_LABELS, FEATURE_LABELS, SIZES, type BaseColor, type FeatureKey, type ShirtSize } from "@/types/shirt";

/** Studio backdrop behind garment mockups. */
export const STAGE_BG =
  "bg-[radial-gradient(ellipse_at_50%_38%,#5a5a57_0%,#3a3a38_45%,#1d1d1c_100%)]";

/** Section label: sentence case, readable (not tiny tracked caps). */
export const LABEL = "mb-2 text-xs font-medium text-neutral-400";

export const STRONG_MATCH = 90;

/**
 * Match % is meaningless before the taste test is done (the profile is
 * neutral), so every surface hides it until calibration completes.
 */
export function useShowMatch() {
  const hydrated = useShirtStore((s) => s.hydrated);
  const { complete } = useCalibrationProgress();
  return hydrated && complete;
}

type BadgeVariant = "solid" | "quiet" | "top";

export function MatchBadge({
  score,
  variant = "solid",
  size = "md",
  strong = false,
}: {
  score: number;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** ≥ 90 on a "for you" card: one-time shimmer + "Strong match". */
  strong?: boolean;
}) {
  const text =
    variant === "quiet" ? `${score}%` : variant === "top" ? `Top pick · ${score}%` : strong ? `${score}% · Strong match` : `${score}% Match`;
  const tone =
    variant === "quiet" ? "bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm" : "bg-white text-black";
  return (
    <motion.span
      key={score}
      initial={{ scale: 0.9, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`relative inline-flex shrink-0 items-center overflow-hidden rounded-full font-mono font-bold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      } ${tone}`}
    >
      {text}
      {strong && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-black/15 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeInOut" }}
        />
      )}
    </motion.span>
  );
}

export function SizeSelector({
  value,
  onChange,
  compact = false,
  highlight = false,
}: {
  value?: ShirtSize;
  onChange: (size: ShirtSize) => void;
  compact?: boolean;
  /** Draw attention (e.g. after "Choose size" was tapped). */
  highlight?: boolean;
}) {
  return (
    <motion.div
      className="grid grid-cols-4 gap-2"
      role="radiogroup"
      aria-label="Size"
      animate={highlight ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {SIZES.map((size) => {
        const active = value === size;
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(size)}
            className={`${compact ? "h-9 text-xs" : "h-11 text-sm"} rounded-xl font-semibold transition-colors ${
              active
                ? "bg-white text-black"
                : `bg-white/5 text-neutral-200 ring-1 hover:bg-white/10 ${highlight ? "ring-white/60" : "ring-white/15"}`
            }`}
          >
            {size}
          </button>
        );
      })}
    </motion.div>
  );
}

/** Tee colour picker. Every design comes in both; the original is marked. */
export function ColorSelector({
  value,
  original,
  onChange,
}: {
  value: BaseColor;
  original: BaseColor;
  onChange: (color: BaseColor) => void;
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
            onClick={() => onChange(c)}
            className={`flex h-12 min-w-0 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition ${
              active ? "bg-white/10 text-white ring-2 ring-white" : "bg-white/[0.03] text-neutral-400 ring-1 ring-white/15 hover:bg-white/[0.07]"
            }`}
          >
            <span
              className={`h-6 w-6 shrink-0 rounded-full ring-1 ${c === "black" ? "bg-black ring-white/40" : "bg-white ring-black/20"}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate">{COLOR_LABELS[c]}</span>
              {c === original && <span className="block text-[10px] font-medium text-neutral-400">Original</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

let savedToastShown = false;

/**
 * Heart on grid cards. Saving trains the taste vector; unsaving offers Undo
 * (restores without training twice).
 */
export function SaveButton({ id, className = "" }: { id: string; className?: string }) {
  const saved = useShirtStore((s) => s.likedIds.includes(id));
  const toggleSaved = useShirtStore((s) => s.toggleSaved);
  const restoreSaved = useShirtStore((s) => s.restoreSaved);
  const showToast = useShirtStore((s) => s.showToast);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      animate={saved ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.25 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(id);
        if (saved) {
          showToast("Removed", { label: "Undo", run: () => restoreSaved(id) });
        } else if (!savedToastShown) {
          savedToastShown = true;
          showToast("Saved — your shop just got smarter");
        }
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      // 32px visual, 44px hit area via the pseudo-element. Callers position it
      // (absolute), which also anchors the pseudo-element.
      className={`flex items-center justify-center rounded-full backdrop-blur-md transition-colors before:absolute before:-inset-1.5 before:content-[''] ${
        saved ? "bg-white text-black" : "bg-black/50 text-white ring-1 ring-white/15 hover:bg-black/70"
      } ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
    </motion.button>
  );
}

export function TraitChips({ keys, className = "", stagger = false }: { keys: FeatureKey[]; className?: string; stagger?: boolean }) {
  if (keys.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {keys.map((k, i) => (
        <motion.span
          key={k}
          initial={stagger ? { opacity: 0, scale: 0.8 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: stagger ? 0.35 + i * 0.06 : 0, type: "spring", stiffness: 400, damping: 22 }}
          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-neutral-200 ring-1 ring-white/10"
        >
          {FEATURE_LABELS[k]}
        </motion.span>
      ))}
    </div>
  );
}
