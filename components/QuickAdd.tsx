"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useHydrated } from "@/store/useUiStore";
import { SIZES, type BaseColor, type ShirtProduct } from "@/types/shirt";

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
  className = "",
}: {
  shirt: ShirtProduct;
  color?: BaseColor;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const hydrated = useHydrated();
  const preferred = useCartStore((s) => s.preferredSize);
  const addToCart = useCartStore((s) => s.addToCart);
  const [open, setOpen] = useState(false);
  if (!hydrated) return null;

  const overlay = variant === "overlay";
  const chip = overlay
    ? "h-8 rounded-full bg-black/60 px-3 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/80"
    : "h-9 rounded-full bg-white/10 px-3.5 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/15";

  if (preferred && !open) {
    return (
      <button
        type="button"
        onClick={() => addToCart(shirt.id, preferred, color)}
        aria-label={`Add ${shirt.title} to bag, size ${preferred}`}
        className={`flex items-center gap-1 ${chip} ${className}`}
      >
        <Plus className="h-3.5 w-3.5" /> Add · {preferred}
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
            className={`flex items-center gap-1 ${overlay ? "w-full rounded-full bg-black/70 p-1 ring-1 ring-white/20 backdrop-blur-sm" : ""}`}
          >
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  addToCart(shirt.id, size, color);
                  setOpen(false);
                }}
                aria-label={`Size ${size}`}
                className={`h-8 min-w-8 flex-1 rounded-full px-2 text-xs font-bold ${overlay ? "text-white hover:bg-white hover:text-black" : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white hover:text-black"}`}
              >
                {size}
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close sizes" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="plus"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label={`Quick add ${shirt.title}`}
            aria-expanded={false}
            className={`flex items-center gap-1 ${chip} ${overlay ? "ml-auto" : ""}`}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
