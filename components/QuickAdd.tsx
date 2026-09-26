"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useHydrated } from "@/store/useUiStore";
import { SIZES, type BaseColor, type ShirtProduct } from "@/types/shirt";
import type { AddSource } from "@/lib/analytics";

/**
 * Add to bag without opening the product. With a remembered size it's one
 * tap ("Add · M"); otherwise "+" opens a row of sizes and the pick adds it
 * (and becomes the remembered size).
 *
 * - "overlay": a small control over a card image (bottom right; the sizes
 *   open across the bottom of the image).
 * - "inline": a plain row, for lists and panels.
 */
export function QuickAdd({
  shirt,
  color,
  variant = "inline",
  compact = false,
  long = false,
  iconOnly = false,
  source,
  className = "",
}: {
  shirt: ShirtProduct;
  color?: BaseColor;
  variant?: "overlay" | "inline";
  /** Tight spaces: "+ M" instead of "+ Add · M". */
  compact?: boolean;
  /** Spelled out: "Add to bag · M". */
  long?: boolean;
  /** Just a round "+" (lists with little room); the label says the size. */
  iconOnly?: boolean;
  /** Where the add happens (analytics). */
  source?: AddSource;
  className?: string;
}) {
  const hydrated = useHydrated();
  const preferred = useCartStore((s) => s.preferredSize);
  const addToCart = useCartStore((s) => s.addToCart);
  const [open, setOpen] = useState(false);
  // After a size is picked (or the sizes closed), focus moves to the button
  // that takes their place instead of falling back to the page.
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current || open) return;
    refocus.current = false;
    button.current?.focus({ preventScroll: true });
  });
  const close = () => {
    refocus.current = true;
    setOpen(false);
  };
  if (!hydrated) return null;

  const overlay = variant === "overlay";
  // Over a card: a small round "+" on touch screens; with a mouse it says
  // what it does (the card shows it on hover — see ProductCard).
  const chip = overlay
    ? "[@media(hover:hover)_and_(pointer:fine)]:px-3 h-8 min-w-8 justify-center rounded-full bg-black/60 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/80"
    : "h-9 rounded-full bg-white/10 px-3.5 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/15";
  const words = (text: string) => (iconOnly ? null : overlay ? <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">{text}</span> : text);
  const shape = iconOnly ? "!w-9 !px-0 justify-center" : "";

  if (preferred && !open) {
    return (
      <button
        ref={button}
        type="button"
        onClick={() => addToCart(shirt.id, preferred, color, 1, { source })}
        aria-label={`Add ${shirt.title} to bag, size ${preferred}`}
        className={`flex shrink-0 items-center gap-1 whitespace-nowrap ${chip} ${shape} ${className}`}
      >
        <Plus className="h-3.5 w-3.5" /> {words(compact ? preferred : `${long ? "Add to bag" : "Add"} · ${preferred}`)}
      </button>
    );
  }

  return (
    <div className={overlay ? `${open ? "left-2" : ""} ${className}` : `flex items-center gap-2 ${className}`}>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="sizes"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            role="group"
            aria-label={`Add ${shirt.title}: pick a size`}
            className={`flex items-center gap-0.5 ${overlay ? "w-full min-w-0 rounded-full bg-black/70 p-1 ring-1 ring-white/20 backdrop-blur-sm" : iconOnly ? "w-44" : ""}`}
          >
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  addToCart(shirt.id, size, color, 1, { source });
                  close();
                }}
                aria-label={`Size ${size}`}
                className={`h-8 min-w-0 flex-1 rounded-full px-0 text-xs font-bold ${overlay ? "text-white hover:bg-white hover:text-black" : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white hover:text-black"}`}
              >
                {size}
              </button>
            ))}
            <button type="button" onClick={close} aria-label="Close sizes" className="flex h-8 w-7 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            ref={button}
            key="plus"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label={`Quick add ${shirt.title}`}
            aria-expanded={false}
            className={`flex shrink-0 items-center gap-1 ${chip} ${shape} ${overlay ? "ml-auto" : ""}`}
          >
            <Plus className="h-3.5 w-3.5" /> {words(long ? "Add to bag" : "Add")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
