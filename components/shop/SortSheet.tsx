"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { radioKeys } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { ShopSort } from "@/lib/recommendation";

const SORTS: { value: ShopSort; label: string; hint: string }[] = [
  { value: "match", label: "For you", hint: "Ranked by your taste" },
  { value: "popular", label: "Popular", hint: "Our editors' order" },
  { value: "new", label: "Newest", hint: "Latest drop first" },
];

/**
 * The shop's order, in a bottom sheet (opened from the sort button in the
 * sticky row). A pick applies at once; the sheet stays open until closed.
 */
export function SortSheet({
  open,
  onClose,
  sort,
  canMatch,
  onSort,
}: {
  open: boolean;
  onClose: () => void;
  sort: ShopSort;
  /** "For you" needs the taste test. */
  canMatch: boolean;
  onSort: (s: ShopSort) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, open, onClose);
  const sorts = SORTS.filter((s) => s.value !== "match" || canMatch);
  const sortKeys = radioKeys(sorts.map((s) => s.value), sort, onSort);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Sort"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            // Phones: a bottom sheet. Large screens: a panel near the trigger (top right).
            className="no-scrollbar fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-ink-900 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 ring-1 ring-white/10 lg:inset-x-auto lg:bottom-auto lg:right-[max(2rem,calc(50%-32rem))] lg:top-[calc(var(--header-h)+112px)] lg:w-80 lg:rounded-3xl lg:pb-5 lg:shadow-2xl lg:shadow-black"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Sort</h2>
              <button type="button" onClick={onClose} data-autofocus aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-neutral-300 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-2 mt-2 text-xs font-medium text-neutral-400">Order</p>
            <div role="radiogroup" aria-label="Order" className="grid gap-1">
              {sorts.map((s, i) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={sort === s.value}
                  onClick={() => onSort(s.value)}
                  {...sortKeys(i)}
                  className={`flex h-12 items-center justify-between rounded-xl px-3 text-left ${sort === s.value ? "bg-white/10 ring-1 ring-white" : "hover:bg-white/5"}`}
                >
                  <span>
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className="block text-xs text-neutral-400">{s.hint}</span>
                  </span>
                  {sort === s.value && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
            {!canMatch && <p className="mt-1 px-3 text-xs text-neutral-400">&ldquo;For you&rdquo; unlocks after the 10-swipe taste test.</p>}

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
