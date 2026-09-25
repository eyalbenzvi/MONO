"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, ShoppingBag, Trash2, X } from "lucide-react";
import { PrintImage } from "@/components/PrintImage";
import { getShirtById } from "@/lib/mockData";
import { matchScore } from "@/lib/recommendation";
import { useShirtStore } from "@/store/useShirtStore";
import type { ShirtProduct } from "@/types/shirt";

export function LikedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const likedIds = useShirtStore((s) => s.likedIds);
  const vector = useShirtStore((s) => s.preferenceVector);
  const sizes = useShirtStore((s) => s.selectedSizes);
  const removeLiked = useShirtStore((s) => s.removeLiked);
  const [checkedOut, setCheckedOut] = useState(false);

  const items = likedIds
    .map((id) => getShirtById(id))
    .filter((s): s is ShirtProduct => Boolean(s))
    .reverse();
  const total = items.reduce((sum, s) => sum + s.price, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setCheckedOut(false);
  }, [open]);

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
            aria-label="Liked tees"
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
                <h2 className="text-lg font-bold tracking-tight">Liked</h2>
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
                  <p className="text-sm">Swipe right on a tee to save it here.</p>
                </div>
              ) : (
                <ul className="space-y-3 pb-4">
                  <AnimatePresence initial={false}>
                    {items.map((shirt) => (
                      <motion.li
                        key={shirt.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
                        className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/10"
                      >
                        <div
                          className={`flex h-20 w-16 shrink-0 items-center justify-center rounded-xl ${
                            shirt.baseColor === "black" ? "fabric-black ring-1 ring-white/10" : "fabric-white"
                          }`}
                        >
                          <div className="aspect-[3/4] w-10 overflow-hidden rounded-[2px]">
                            <PrintImage shirt={shirt} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{shirt.title}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {shirt.baseColor === "black" ? "Black" : "White"} tee · Size {sizes[shirt.id] ?? "M"}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                              {matchScore(vector, shirt.features)}% Match
                            </span>
                            <span className="font-mono text-sm">${shirt.price}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLiked(shirt.id)}
                          aria-label={`Remove ${shirt.title}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/5 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="font-mono text-base font-semibold">${total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setCheckedOut(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-30"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {checkedOut ? (
                    <motion.span key="done" className="flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      <Check className="h-4 w-4" /> Demo only — no order placed
                    </motion.span>
                  ) : (
                    <motion.span key="cta" className="flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      <ShoppingBag className="h-4 w-4" /> Proceed to Checkout
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
