"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag, Trash2, X } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { MatchBadge, STAGE_BG } from "@/components/ui";
import { getShirtById } from "@/lib/catalog";
import { matchScore } from "@/lib/recommendation";
import { useCartCount, useShirtStore } from "@/store/useShirtStore";
import { SIZES, type ShirtProduct, type ShirtSize } from "@/types/shirt";

/** "Saved" — every tee liked in Discover or hearted in the shop. */
export function LikedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const likedIds = useShirtStore((s) => s.likedIds);
  const vector = useShirtStore((s) => s.preferenceVector);
  const sizes = useShirtStore((s) => s.selectedSizes);
  const setSize = useShirtStore((s) => s.setSize);
  const removeLiked = useShirtStore((s) => s.removeLiked);
  const addToCart = useShirtStore((s) => s.addToCart);
  const cartCount = useCartCount();

  const items = likedIds
    .map((id) => getShirtById(id))
    .filter((s): s is ShirtProduct => Boolean(s))
    .reverse();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Saved tees"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-ink-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 120 || info.velocity.x > 500) onClose();
            }}
          >
            <div className="flex items-center justify-between px-5 pb-4 pt-[max(env(safe-area-inset-top),20px)]">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Saved</h2>
                <p className="text-xs text-neutral-500">
                  {items.length} tee{items.length === 1 ? "" : "s"} · swipe right to close
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-5">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 pb-20 text-center text-neutral-500">
                  <Heart className="h-10 w-10" />
                  <p className="text-sm">Swipe right in Discover, or tap ♥ in the shop, to save a tee here.</p>
                </div>
              ) : (
                <ul className="space-y-3 pb-4">
                  <AnimatePresence initial={false}>
                    {items.map((shirt) => {
                      const size: ShirtSize = sizes[shirt.id] ?? "M";
                      return (
                        <motion.li
                          key={shirt.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
                          className="flex gap-3 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/10"
                        >
                          <Link href={`/shop/${shirt.id}/`} onClick={onClose} className={`w-20 shrink-0 rounded-xl p-1.5 ${STAGE_BG}`}>
                            <TeeMockup shirt={shirt} shadow={false} className="w-full" />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <Link href={`/shop/${shirt.id}/`} onClick={onClose} className="min-w-0">
                                <p className="truncate text-sm font-semibold">{shirt.title}</p>
                                <p className="truncate text-xs text-neutral-500">
                                  {shirt.baseColor === "black" ? "Black" : "White"} tee · ${shirt.price}
                                </p>
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeLiked(shirt.id)}
                                aria-label={`Remove ${shirt.title}`}
                                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/5 hover:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-1">
                              <MatchBadge score={matchScore(vector, shirt.features)} size="sm" />
                            </div>
                            <div className="mt-auto flex items-center gap-2 pt-2">
                              <select
                                value={size}
                                onChange={(e) => setSize(shirt.id, e.target.value as ShirtSize)}
                                aria-label={`Size for ${shirt.title}`}
                                className="h-9 rounded-lg bg-white/[0.06] px-2 text-xs font-semibold text-white outline-none ring-1 ring-white/10"
                              >
                                {SIZES.map((s) => (
                                  <option key={s} value={s} className="bg-ink-900">
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => addToCart(shirt.id, size)}
                                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-bold text-black active:scale-[0.97]"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" /> Add to bag
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
              <Link
                href="/cart/"
                onClick={onClose}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98]"
              >
                <ShoppingBag className="h-4 w-4" /> View bag{cartCount > 0 ? ` (${cartCount})` : ""}
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
