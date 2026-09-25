"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
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
  const hydrated = useUiStore((s) => s.hydrated);
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

/**
 * Keyboard support for a radiogroup of buttons (WAI-ARIA pattern): only the
 * checked option (or the first) is in the Tab order; arrow keys, Home and End
 * move the selection and focus.
 */
export function radioKeys<T>(options: readonly T[], value: T | undefined, onChange: (v: T) => void) {
  const current = Math.max(0, value === undefined ? 0 : options.indexOf(value));
  return (i: number) => ({
    tabIndex: i === current ? 0 : -1,
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      const to = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : step ? (i + step + options.length) % options.length : -1;
      if (to < 0) return;
      e.preventDefault();
      e.stopPropagation();
      onChange(options[to]);
      const group = e.currentTarget.closest('[role="radiogroup"]');
      group?.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
    },
  });
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
  const keys = radioKeys(SIZES, value, onChange);
  return (
    <motion.div
      className="grid grid-cols-4 gap-2"
      role="radiogroup"
      aria-label="Size"
      animate={highlight ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {SIZES.map((size, i) => {
        const active = value === size;
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(size)}
            {...keys(i)}
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

const COLORS: readonly BaseColor[] = ["black", "white"];
const swatch = (c: BaseColor, size: string) => (
  <span className={`${size} shrink-0 rounded-full ring-1 ${c === "black" ? "bg-black ring-white/50" : "bg-white ring-black/20"}`} aria-hidden />
);

/**
 * The one tee-colour picker (every design comes in both; the original is
 * marked). Variants:
 * - "cards": two labelled options (product page)
 * - "pills": compact labelled pills (bag lines)
 * - "dots": swatches only (Saved list)
 * - "overlay": swatches on a translucent pill, over a product image
 */
export function ColorSelector({
  value,
  original,
  onChange,
  variant = "cards",
}: {
  value: BaseColor;
  original: BaseColor;
  onChange: (color: BaseColor) => void;
  variant?: "cards" | "pills" | "dots" | "overlay";
}) {
  const keys = radioKeys(COLORS, value, onChange);
  const label = (c: BaseColor) => `${COLOR_LABELS[c]} tee${c === original ? " (original)" : ""}`;
  const wrap = {
    cards: "grid grid-cols-2 gap-2",
    pills: "flex items-center gap-1.5",
    dots: "flex items-center gap-2",
    overlay: "flex gap-1 rounded-full bg-black/55 p-1 ring-1 ring-white/15",
  }[variant];
  return (
    <div className={wrap} role="radiogroup" aria-label="Tee colour">
      {COLORS.map((c, i) => {
        const active = value === c;
        const common = { type: "button" as const, role: "radio", "aria-checked": active, "aria-label": label(c), title: label(c), onClick: () => onChange(c), ...keys(i) };
        if (variant === "cards")
          return (
            <button
              key={c}
              {...common}
              className={`flex h-12 min-w-0 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition ${
                active ? "bg-white/10 text-white ring-2 ring-white" : "bg-white/[0.03] text-neutral-400 ring-1 ring-white/15 hover:bg-white/[0.07]"
              }`}
            >
              {swatch(c, "h-6 w-6")}
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span className="block truncate">{COLOR_LABELS[c]}</span>
                {c === original && <span className="block text-xs font-medium text-neutral-400">Original</span>}
              </span>
            </button>
          );
        if (variant === "pills")
          return (
            <button
              key={c}
              {...common}
              className={`flex h-8 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-xs font-medium transition ${
                active ? "bg-white/10 text-white ring-1 ring-white" : "text-neutral-400 ring-1 ring-white/10 hover:text-neutral-200"
              }`}
            >
              {swatch(c, "h-6 w-6")}
              {COLOR_LABELS[c]}
            </button>
          );
        return (
          <button
            key={c}
            {...common}
            className={`relative flex items-center justify-center rounded-full transition-shadow before:absolute before:-inset-1.5 before:content-[''] ${variant === "overlay" ? "h-8 w-8" : "h-7 w-7"} ${
              active ? "ring-2 ring-white ring-offset-2 ring-offset-black" : variant === "dots" ? "ring-1 ring-white/20" : ""
            }`}
          >
            {swatch(c, variant === "overlay" ? "h-6 w-6" : "h-5 w-5")}
          </button>
        );
      })}
    </div>
  );
}

let savedToastShown = false;

/**
 * The one save (heart) control. Saving trains the taste vector; unsaving
 * always offers Undo (restores without training twice).
 * - "sm": 32px on grid cards (callers position it; 44px hit area)
 * - "lg": 48px next to the buy button
 */
export function SaveButton({ id, size = "sm", className = "" }: { id: string; size?: "sm" | "lg"; className?: string }) {
  const hydrated = useUiStore((s) => s.hydrated);
  const saved = useTasteStore((s) => s.likedIds.includes(id)) && hydrated;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      animate={saved ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.25 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const { toggleSaved, restoreSaved } = useTasteStore.getState();
        const { showToast } = useUiStore.getState();
        toggleSaved(id);
        if (saved) showToast("Removed from saved", { label: "Undo", run: () => restoreSaved(id) });
        else if (!savedToastShown) {
          savedToastShown = true;
          showToast("Saved — your shop just got smarter");
        }
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`flex items-center justify-center rounded-full transition-colors ${
        size === "sm" ? "before:absolute before:-inset-1.5 before:content-['']" : "h-12 w-12 shrink-0 ring-1 ring-white/15"
      } ${saved ? "bg-white text-black" : size === "sm" ? "bg-black/55 text-white ring-1 ring-white/15 hover:bg-black/75" : "bg-white/5 text-white hover:bg-white/10"} ${className}`}
    >
      <Heart className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"} ${saved ? "fill-current" : ""}`} />
    </motion.button>
  );
}

/** Tiny colour dot for "Black · Category" meta lines. */
export function TeeDot({ color }: { color: BaseColor }) {
  return (
    <span className={`inline-block h-2 w-2 translate-y-[-1px] rounded-full ring-1 ${color === "black" ? "bg-black ring-white/40" : "bg-white ring-white/40"}`} />
  );
}

/** A row in a spec list (<dl>). */
export function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 py-2 text-sm">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="text-right font-medium text-neutral-200">{value}</dd>
    </div>
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
