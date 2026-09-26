"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Heart, Share2, ShoppingBag, Undo2, X } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { SizeSelector, STAGE_BG, useShowMatch } from "@/components/ui";
import { DropSignup } from "@/components/DropSignup";
import { QuickAdd } from "@/components/QuickAdd";
import { shareOrCopy } from "@/lib/clipboard";
import { siteRoot } from "@/lib/share";
import { track } from "@/lib/analytics";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { getShirtById, productHref } from "@/lib/catalog";
import { matchScore } from "@/lib/recommendation";
import { TIER_LABEL, tierOf } from "@/lib/match";
import { useCartCount, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { type BaseColor, type ShirtProduct, type ShirtSize } from "@/types/shirt";
import { formatPrice } from "@/lib/format";

/** "Saved" — every tee liked in Discover or hearted in the shop. */
export function LikedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const likedIds = useTasteStore((s) => s.likedIds);
  const cartCount = useCartCount();
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useFocusTrap(panel, open, onClose);
  // The last removal, undoable right here (a toast would sit outside the
  // drawer's focus trap).
  const [removed, setRemoved] = useState<{ shirt: ShirtProduct; at: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);
  useEffect(() => {
    if (!open) setRemoved(null);
  }, [open]);

  const remove = (shirt: ShirtProduct, row: number) => {
    const { likedIds, removeLiked } = useTasteStore.getState();
    const at = likedIds.indexOf(shirt.id);
    // Focus the row that moves into its place (or the one above, or the
    // heading) so keyboard users aren't dropped to the top of the page.
    const neighbour = items[row + 1] ?? items[row - 1];
    removeLiked(shirt.id);
    setRemoved({ shirt, at });
    requestAnimationFrame(() => {
      const next = neighbour ? list.current?.querySelector<HTMLElement>(`[data-saved-row="${neighbour.id}"] a`) : null;
      (next ?? heading.current)?.focus();
    });
  };
  const undo = () => {
    if (!removed) return;
    useTasteStore.getState().restoreSaved(removed.shirt.id, removed.at);
    setRemoved(null);
  };

  const items = likedIds
    .map((id) => getShirtById(id))
    .filter((s): s is ShirtProduct => Boolean(s))
    .reverse();

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
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Saved tees"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-ink-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)]">
              <div>
                <h2 ref={heading} tabIndex={-1} className="text-lg font-bold tracking-tight outline-none">
                  Saved
                </h2>
                <p className="text-xs text-neutral-400">{items.length} saved</p>
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

            <div className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-5">
              <AnimatePresence initial={false}>
                {removed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] py-2 pl-4 pr-2 text-sm ring-1 ring-white/10">
                      <span className="min-w-0 truncate text-neutral-300">Removed {removed.shirt.title}</span>
                      <button type="button" onClick={undo} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-black">
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="sr-only" aria-live="polite">
                {removed ? `Removed ${removed.shirt.title}. Undo is available.` : ""}
              </p>
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 pb-20 text-center text-neutral-400">
                  <Heart className="h-10 w-10" />
                  <p className="text-sm">Swipe right in Discover, or tap ♥ in the shop, to save a tee here.</p>
                </div>
              ) : (
                <>
                <ListActions items={items} />
                <ul ref={list} className="space-y-2 pb-4">
                  <AnimatePresence initial={false}>
                    {items.map((shirt, row) => (
                      <SavedRow key={shirt.id} shirt={shirt} onNavigate={onClose} onRemove={() => remove(shirt, row)} />
                    ))}
                  </AnimatePresence>
                  <li className="pt-1 text-center text-xs text-neutral-400">Swipe a tee left to remove it</li>
                </ul>
                <DropSignup source="saved" className="!mt-2 pb-6" />
                </>
              )}
            </div>

            <div className="border-t border-white/10 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
              {cartCount > 0 ? (
                <Link
                  href="/cart/"
                  onClick={onClose}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98]"
                >
                  <ShoppingBag className="h-4 w-4" /> View bag ({cartCount})
                </Link>
              ) : (
                <Link
                  href="/"
                  onClick={onClose}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  Keep discovering <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** "Add all · M" and "Share my list" above the Saved rows. */
function ListActions({ items }: { items: ShirtProduct[] }) {
  const preferred = useCartStore((s) => s.preferredSize);
  const [pick, setPick] = useState(false);
  const addAll = (size: ShirtSize) => {
    const { addToCart, selectedColors } = useCartStore.getState();
    let added = 0;
    for (const s of items) if (addToCart(s.id, size, selectedColors[s.id] ?? s.baseColor, 1, { quiet: true })) added++;
    setPick(false);
    useUiStore.getState().showToast(`Added ${added} · ${size}`);
  };
  const shareList = () => {
    // Compact ids (the number of each design), newest first.
    const list = items.map((s) => s.n).join(".");
    const url = `${siteRoot()}/shop/?list=${list}&utm_source=list&utm_medium=share&utm_campaign=saved_list`;
    void shareOrCopy({ title: "My MONO list", text: `${items.length} tee${items.length === 1 ? "" : "s"} I saved on MONO`, url });
    track("share", { channel: "list", count: items.length });
  };
  return (
    <div className="mb-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => (preferred ? addAll(preferred) : setPick((p) => !p))}
          aria-expanded={preferred ? undefined : pick}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-bold text-black"
        >
          <ShoppingBag className="h-4 w-4" /> Add all{preferred ? ` · ${preferred}` : ""}
        </button>
        <button type="button" onClick={shareList} className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/5">
          <Share2 className="h-4 w-4" /> Share my list
        </button>
      </div>
      {pick && !preferred && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs text-neutral-400">Size for all</p>
          <SizeSelector compact onChange={addAll} />
        </div>
      )}
    </div>
  );
}

/** A quiet row: picture, name, price and match, one "+" (remembered size). */
function SavedRow({ shirt, onNavigate, onRemove }: { shirt: ShirtProduct; onNavigate: () => void; onRemove: () => void }) {
  const vector = useTasteStore((s) => s.preferenceVector);
  const color: BaseColor = useCartStore((s) => s.selectedColors[shirt.id]) ?? shirt.baseColor;
  const showMatch = useShowMatch();
  const tier = showMatch ? tierOf(vector, matchScore(vector, shirt.features)) : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, transition: { duration: 0.2 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.7, right: 0 }}
      dragDirectionLock
      onDragEnd={(_, info) => {
        if (info.offset.x < -90 || info.velocity.x < -500) onRemove();
      }}
      data-saved-row={shirt.id}
      className="relative flex items-center gap-3 rounded-2xl bg-ink-850 p-2 ring-1 ring-white/10"
    >
      <Link href={productHref(shirt.id)} onClick={onNavigate} className={`w-14 shrink-0 rounded-xl p-1 ${STAGE_BG}`}>
        <TeeMockup shirt={shirt} color={color} shadow={false} className="w-full" />
      </Link>
      <Link href={productHref(shirt.id)} onClick={onNavigate} className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-sm font-semibold">{shirt.title}</p>
        <p className="truncate text-xs text-neutral-400">
          {formatPrice(shirt.price)}
          {tier ? ` · ${TIER_LABEL[tier]}` : ""}
        </p>
      </Link>
      <QuickAdd shirt={shirt} color={color} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${shirt.title}`}
        className="flex h-10 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.li>
  );
}
