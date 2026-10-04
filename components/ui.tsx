"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { motion } from "framer-motion";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { scrollIntoViewQuietly, useUiStore } from "@/store/useUiStore";
import { track } from "@/lib/analytics";
import { PAIR_PRICE } from "@/lib/prices";
import { formatPrice } from "@/lib/format";
import { arrivalLine } from "@/lib/delivery";
import { STORE_POLICY } from "@/lib/store-policy";
import { ADULT_SIZES, COLOR_LABELS, KID_SIZES, SIZE_LABELS, SIZE_SHORT, isKidSize, type BaseColor, type ShirtSize } from "@/types/shirt";

export { STAGE_BG } from "@/components/stage";

export { BUTTON_PRIMARY, BUTTON_SECONDARY, TEXT_ACTION } from "@/components/buttons";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/buttons";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return <button type="button" {...props} className={`${variant === "primary" ? BUTTON_PRIMARY : BUTTON_SECONDARY} ${className}`} />;
}

/** Section label: sentence case, readable (not tiny tracked caps). */
export const LABEL = "mb-2 text-xs font-medium text-neutral-400";

/**
 * Match % is meaningless before the taste test is done (the profile is
 * neutral), so every surface hides it until calibration completes.
 */
export function useShowMatch() {
  const hydrated = useUiStore((s) => s.hydrated);
  const { complete } = useCalibrationProgress();
  return hydrated && complete;
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
  highlight = false,
  aside,
  groupRef,
}: {
  value?: ShirtSize;
  onChange: (size: ShirtSize) => void;
  /** Draw attention (a buy button tapped before a size was chosen). */
  highlight?: boolean;
  /** On the row above the sizes, opposite "Kids’ sizes" (the product page's "Size guide"). */
  aside?: React.ReactNode;
  /** The sizes themselves (a buy button without a size moves focus to the first). */
  groupRef?: React.Ref<HTMLDivElement>;
}) {
  // Adults by default; the kids' row one tap away (and open if a kids' size is chosen).
  const [kids, setKids] = useState(isKidSize(value));
  const group = kids ? KID_SIZES : ADULT_SIZES;
  const keys = radioKeys(group, value, onChange);
  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setKids((k) => !k)} className="-ml-1 flex h-11 min-w-11 items-center px-1 text-sm text-muted underline-offset-4 hover:text-white hover:underline">
          {kids ? "Adult sizes" : "Kids’ sizes"}
        </button>
        {aside}
      </div>
      {/* 44px targets with 8px between; narrow screens wrap rather than shrink them. */}
      <motion.div
        ref={groupRef}
        className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2"
        role="radiogroup"
        aria-label={kids ? "Kids’ size" : "Size"}
        animate={highlight ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {group.map((size, i) => {
          const active = value === size;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={SIZE_LABELS[size]}
              onClick={() => onChange(size)}
              {...keys(i)}
              className={`h-11 min-w-11 rounded-control px-0 text-sm font-medium transition-colors duration-150 ${
                active ? "bg-white text-black" : `text-neutral-200 ring-1 ring-inset hover:bg-white/5 ${highlight ? "ring-white" : "ring-white/20"}`
              }`}
            >
              {SIZE_SHORT[size]}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}

/**
 * A buy button tapped before a size was chosen: the sizes shake and outline,
 * focus moves to the first one, and "Select your size." is announced. Render
 * `status` once near the sizes.
 */
export function useSizeRequired(source: string) {
  const [nudge, setNudge] = useState(0);
  const [said, setSaid] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);
  const require = () => {
    setNudge((n) => n + 1);
    setSaid("");
    track("size_required", { source });
    requestAnimationFrame(() => {
      setSaid("Select your size.");
      scrollIntoViewQuietly(groupRef.current);
      groupRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus({ preventScroll: true });
    });
  };
  const status = (
    <p role="status" className="sr-only">
      {said}
    </p>
  );
  return { nudge, groupRef, require, status };
}

type Choice = BaseColor | "both";
const CHOICES: readonly Choice[] = ["black", "white", "both"];

/**
 * The one tee picker: Black · White · Both (the pair, with its price — the
 * pair is itself a buying choice, so its price shows here); the original
 * is marked for screen readers. A design sold in one colour only shows that
 * colour, and no choice. 44px targets.
 */
export function TeeChoice({
  value,
  original,
  colors,
  onChange,
  noBoth = false,
  pairPrice = PAIR_PRICE,
}: {
  value: Choice;
  original: BaseColor;
  colors: BaseColor[];
  onChange: (c: Choice) => void;
  noBoth?: boolean;
  /** The pair's price on the Both option (a Make print's pair costs more). */
  pairPrice?: number;
}) {
  // A Make print that one tee can't carry: no pair to offer.
  const options = noBoth ? CHOICES.filter((c) => c !== "both") : CHOICES;
  const keys = radioKeys(options, value, onChange);
  if (colors.length < 2) return <p className="flex h-11 items-center text-sm text-neutral-200">{COLOR_LABELS[original]} tee only</p>;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tee colour">
      {options.map((c, i) => {
        const active = value === c;
        const label = c === "both" ? `Both · ${formatPrice(pairPrice)}` : COLOR_LABELS[c];
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c === "both" ? `Both tees, black and white, ${formatPrice(pairPrice)}` : `${COLOR_LABELS[c]} tee${c === original ? " (original)" : ""}`}
            onClick={() => onChange(c)}
            {...keys(i)}
            className={`h-11 min-w-11 whitespace-nowrap rounded-control px-4 text-sm font-medium transition-colors duration-150 ${active ? "bg-white text-black" : "text-neutral-200 ring-1 ring-inset ring-white/20 hover:bg-white/5"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** A tee-colour dot: the same one on the product page, the bag, Saved and the shop. */
export function Swatch({ color, className }: { color: BaseColor; className: string }) {
  return <span className={`${className} shrink-0 rounded-full ring-1 ${color === "black" ? "bg-black ring-white/50" : "bg-white ring-black/20"}`} aria-hidden />;
}

let savedToastShown = false;

/**
 * The one save (heart) control. Saving trains the taste vector; unsaving
 * always offers Undo (restores without training twice).
 * - "sm": over a grid card (callers position it; 44px)
 * - "lg": 48px next to the buy button
 */
/**
 * The heart. "sm": bare, on a picture; "lg": the product page's square control beside the buy button;
 * "overlay": a shop card's corner, on every card on every device: a 44 px target around a dark round
 * backdrop, so the outline (not saved) or the filled heart (saved) reads on a light photo and a dark one.
 */
export function SaveButton({ id, title, size = "sm", className = "" }: { id: string; title?: string; size?: "sm" | "lg" | "overlay"; className?: string }) {
  const hydrated = useUiStore((s) => s.hydrated);
  const saved = useTasteStore((s) => s.likedIds.includes(id)) && hydrated;
  const name = title ? ` ${title}` : "";
  return (
    // A plain button, not a motion one: it sits on every shop card, and framer-motion's per-element
    // measuring made each grid change (a search, a filter, the next page) cost a noticeable pause on a phone.
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // The little pop on saving (what the motion version animated), unless motion is reduced.
        if (!saved && !matchMedia("(prefers-reduced-motion: reduce)").matches)
          e.currentTarget.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], { duration: 150 });
        const { toggleSaved, restoreSaved } = useTasteStore.getState();
        const { showToast } = useUiStore.getState();
        toggleSaved(id);
        if (saved) showToast("Removed from Saved", { label: "Undo", run: () => restoreSaved(id) });
        else if (!savedToastShown) {
          savedToastShown = true;
          showToast("Saved");
        }
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove${name} from Saved` : `Save${name}`}
      className={`flex items-center justify-center transition-[color,background-color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100 ${size === "lg" ? "h-12 w-12 shrink-0 rounded-control ring-1 ring-inset ring-white/25" : "h-11 w-11"} ${
        size === "lg" ? (saved ? "bg-white text-black" : "text-white hover:bg-white/5") : size === "overlay" ? "text-white" : saved ? "text-white" : "text-white drop-shadow hover:text-neutral-200"
      } ${className}`}
    >
      {size === "overlay" ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 ring-1 ring-inset ring-white/15 backdrop-blur-[2px]">
          <Icon name="heart" className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} />
        </span>
      ) : (
        <Icon name="heart" className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
      )}
    </button>
  );
}

/** Tiny colour dot for "Black · Category" meta lines. */
export function TeeDot({ color }: { color: BaseColor }) {
  return (
    <span className={`inline-block h-2 w-2 translate-y-[-1px] rounded-full ring-1 ${color === "black" ? "bg-black ring-white/40" : "bg-white ring-white/40"}`} />
  );
}

/** A row in a spec list (<dl>). `mono`: a measurement or code (the one place the mono face is used). */
export function Spec({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right text-neutral-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

/**
 * The one line of promises, rendered from the policy (lib/store-policy,
 * lib/delivery): when it arrives, returns (or the made-for-you exception)
 * and the fabric. The same words on the product page, Make and the bag.
 */
export function TrustLine({ custom = false, review = false, className = "" }: { custom?: boolean; review?: boolean; className?: string }) {
  // The window is worked out on the viewer's clock, so only once the page runs.
  const hydrated = useUiStore((s) => s.hydrated);
  const parts = [hydrated ? arrivalLine(review) : null, custom ? STORE_POLICY.customReturns.replace(/\.$/, "") : STORE_POLICY.returns, STORE_POLICY.fabric].filter(Boolean);
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`} data-trust>
      {parts.join(" · ")}
    </p>
  );
}
