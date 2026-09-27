"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { Swatch } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { track } from "@/lib/analytics";
import { toggleCategory } from "@/lib/catalog";
import { CATEGORY_LABELS, COLORS, COLOR_LABELS, SHIRT_CATEGORIES, type BaseColor, type ShirtCategory } from "@/types/shirt";

/** The shop's tee colour: the product page's two dots. A toggle — tap again for both colours. */
export function TeeSwatches({ tee, onChange, onWarm }: { tee: BaseColor | null; onChange: (tee: BaseColor | null) => void; onWarm: (tee: BaseColor) => void }) {
  return (
    <div role="group" aria-label="Tee colour" className="flex shrink-0 items-center gap-3">
      {COLORS.map((c) => {
        const active = tee === c;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={active}
            aria-label={COLOR_LABELS[c]}
            title={`${COLOR_LABELS[c]} tees`}
            onPointerDown={() => onWarm(c)}
            onPointerEnter={() => onWarm(c)}
            onFocus={() => onWarm(c)}
            onClick={() => onChange(active ? null : c)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-shadow before:absolute before:-inset-1.5 before:content-[''] ${
              active ? "ring-2 ring-white ring-offset-2 ring-offset-ink-950" : ""
            }`}
          >
            <Swatch color={c} className="h-6 w-6" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * The filter icon: a sheet (a popover on larger screens) to choose the
 * categories shown. Changes apply at once; the grid behind follows.
 */
export function CategoryFilter({
  cats,
  counts,
  total,
  results,
  onChange,
  onWarm,
  onOpen,
}: {
  cats: ShirtCategory[];
  counts: Record<ShirtCategory, number>;
  total: number;
  results: number;
  onChange: (cats: ShirtCategory[]) => void;
  onWarm: (cats: ShirtCategory[]) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = (via: "button" | "backdrop" | "escape") => {
    track("shop_filter_close", { via, cats: cats.join("."), results });
    setOpen(false);
  };
  useFocusTrap(panel, open, () => close("escape"));
  const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
  const n = cats.length;
  const row = (on: boolean, label: string, count: number, onClick: () => void, onFocus?: () => void, autofocus = false) => (
    <button
      key={label}
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={count === 0}
      onClick={onClick}
      onPointerDown={onFocus}
      onFocus={onFocus}
      {...(autofocus ? { "data-autofocus": true } : {})}
      className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-white/5 disabled:opacity-35"
    >
      <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${on ? "bg-white text-black" : "ring-1 ring-white/25"}`}>
        {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-white">{label}</span>
      <span className="text-xs tabular-nums text-neutral-500">{count}</span>
    </button>
  );
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          track("shop_filter_open", { cats_active: n });
          onOpen?.();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={n ? `Categories, ${n} selected` : "Categories"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 ${n ? "text-white" : "text-neutral-300"}`}
      >
        <Icon name="sliders-horizontal" className="h-5 w-5" />
        {n > 0 && (
          <span aria-hidden className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-none tabular-nums text-black">
            {n}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/50 md:bg-transparent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close("backdrop")} />
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cat-title"
              initial={desktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
              animate={desktop ? { opacity: 1, scale: 1 } : { y: 0 }}
              exit={desktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
              transition={desktop ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 38 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg origin-top-right overflow-y-auto rounded-t-3xl bg-ink-900 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 ring-1 ring-white/10 md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-80 md:rounded-2xl md:pb-2 md:shadow-2xl md:shadow-black"
            >
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden />
              <div className="flex h-12 items-center px-3">
                <h2 id="cat-title" className="text-sm font-semibold text-white">
                  Categories
                </h2>
              </div>
              <div role="group" aria-labelledby="cat-title" className="grid">
                {row(n === 0, "All", total, () => onChange([]), () => onWarm([]), true)}
                {SHIRT_CATEGORIES.map((c) => {
                  const next = toggleCategory(cats, c);
                  return row(cats.includes(c), CATEGORY_LABELS[c], counts[c], () => onChange(next), () => onWarm(next));
                })}
              </div>
              <div className="sticky bottom-0 bg-ink-900 pt-2 md:hidden">
                <button type="button" onClick={() => close("button")} className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black">
                  Show {results} tees
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
