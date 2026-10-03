"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { Icon } from "@/components/Icon";
import { TeeMockup } from "@/components/TeeMockup";
import { TEXT_ACTION, useShowMatch } from "@/components/ui";
import { SIZES } from "@/lib/images";
import { shareOrCopy } from "@/lib/clipboard";
import { siteRoot } from "@/lib/share";
import { track } from "@/lib/analytics";
import { productHref } from "@/lib/catalog";
import { matchScore } from "@/lib/recommendation";
import { tierOf } from "@/lib/match";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { CATEGORY_LABELS, SIZE_LABELS, type BaseColor, type ShirtProduct, type UserProfileVector } from "@/types/shirt";

/**
 * Saved, in full, on You: quiet rows (picture, name, and "Top pick" or the
 * category), one "+" each to add it to the bag (the remembered size; without
 * one, "+" opens the tee to select it) and × to remove, with Undo in the
 * toast. Rows swipe too, as in a mail app: right adds, left removes.
 * "Share list" sends a link to the shop with these tees on top.
 */
export function SavedList({ items }: { items: ShirtProduct[] }) {
  const showMatch = useShowMatch();
  const vector = useTasteStore((s) => s.preferenceVector);
  const list = useRef<HTMLUListElement>(null);

  const remove = (shirt: ShirtProduct, row: number) => {
    const { likedIds, removeLiked, restoreSaved } = useTasteStore.getState();
    const at = likedIds.indexOf(shirt.id);
    // Focus the row that moves into its place (or the one above) so keyboard users aren't dropped to the top.
    const neighbour = items[row + 1] ?? items[row - 1];
    removeLiked(shirt.id);
    useUiStore.getState().showToast("Removed from Saved", { label: "Undo", run: () => restoreSaved(shirt.id, at) });
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-saved-row="${neighbour?.id}"] a`)?.focus());
  };

  if (!items.length) return <p className="text-sm text-muted">Tap ♥ to save a tee.</p>;
  return (
    <>
      <ul ref={list} aria-label="Saved" className="border-t border-white/10">
        <AnimatePresence initial={false}>
          {items.map((shirt, row) => (
            <SavedRow key={shirt.id} shirt={shirt} hint={row === 0} vector={showMatch ? vector : null} onRemove={() => remove(shirt, row)} />
          ))}
        </AnimatePresence>
      </ul>
      <button type="button" onClick={() => shareList(items)} className={`${TEXT_ACTION} mt-2 -ml-0 justify-start text-white underline`}>
        Share list
      </button>
    </>
  );
}

/** "Share list": a link to the shop with these tees on top (newest first). The recipient reads "my". */
function shareList(items: ShirtProduct[]) {
  const list = items.map((s) => s.n).join(".");
  const url = `${siteRoot()}/shop/?list=${list}&utm_source=list&utm_medium=share&utm_campaign=saved_list`;
  void shareOrCopy({ title: "My MONO list", text: `${items.length} tee${items.length === 1 ? "" : "s"} I saved on MONO`, url }).then((outcome) => {
    if (outcome === "shared" || outcome === "copied") track("share", { channel: "list", method: outcome, count: items.length });
  });
}

/** How far the row itself travels before its action's backdrop turns white and letting go acts (px). */
const SWIPE_AT = 90;
/** The first time Saved shows (on this device), the first row slides aside once to show what a swipe does (skipped with reduced motion). */
const HINT_KEY = "mono-saved-hint";

function SavedRow({ shirt, hint = false, vector, onRemove }: { shirt: ShirtProduct; hint?: boolean; vector: UserProfileVector | null; onRemove: () => void }) {
  const color: BaseColor = useCartStore((s) => s.selectedColors[shirt.id]) ?? shirt.baseColor;
  const size = useCartStore((s) => sizeFor(s, shirt.id));
  const top = vector ? tierOf(vector, matchScore(vector, shirt.features)) === "top" : false;
  const x = useMotionValue(0);
  // A drag that ends over a link isn't a tap on it.
  const dragged = useRef(false);
  // The axis the drag locked to: a vertical scroll of the list is never a swipe.
  const axis = useRef<"x" | "y" | null>(null);
  const [pull, setPull] = useState<{ dir: "add" | "remove" | null; armed: boolean }>({ dir: null, armed: false });
  useMotionValueEvent(x, "change", (v) => {
    const dir = v > 4 ? "add" : v < -4 ? "remove" : null;
    const armed = Math.abs(v) >= SWIPE_AT;
    if (dir !== pull.dir || armed !== pull.armed) setPull({ dir, armed });
  });
  useEffect(() => {
    if (!hint || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      return;
    }
    const run = animate(x, [0, 64, 0], { duration: 1.1, delay: 0.5, times: [0, 0.45, 1], ease: "easeInOut" });
    return () => run.stop();
  }, [hint, x]);
  const addLabel = size ? `Add to bag · ${SIZE_LABELS[size]}` : "Select size";
  const router = useRouter();
  const add = () => {
    // No size yet: the tee's page, to select one. Navigate directly: a click on the
    // link right after a swipe is swallowed by the drag guard below.
    if (!size) return router.push(productHref(shirt.id));
    useCartStore.getState().addToCart(shirt.id, size, color, 1, { source: "saved" });
  };

  return (
    <motion.li layout exit={{ opacity: 0, transition: { duration: 0.15 } }} data-saved-row={shirt.id} className="relative overflow-hidden border-b border-white/10">
      {/* What letting go will do, under the row. */}
      <div aria-hidden className={`absolute inset-0 flex items-center px-4 text-sm ${pull.dir === "remove" ? "justify-end" : "justify-start"} ${pull.armed ? "bg-white text-black" : "bg-white/[0.06] text-neutral-300"}`} data-swipe-action={pull.dir ?? undefined} data-swipe-armed={pull.armed || undefined}>
        {pull.dir === "add" && addLabel}
        {pull.dir === "remove" && "Remove"}
      </div>
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        // No momentum: let go and the row springs straight back. With it, a fast flick kept sliding out after
        // the finger lifted, brought the white backdrop up with nothing done, and now and then added the tee.
        dragMomentum={false}
        dragDirectionLock
        onDragStart={() => {
          dragged.current = true;
          axis.current = null;
        }}
        onDirectionLock={(a) => (axis.current = a)}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          dragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragEnd={() => {
          setTimeout(() => (dragged.current = false), 300);
          if (axis.current === "y") return;
          // Only what the row shows when it is let go: the action acts only once its white backdrop is up (the
          // row's own position, not the finger's: with the drag's elasticity the row trails the finger).
          const at = x.get();
          if (at <= -SWIPE_AT) onRemove();
          else if (at >= SWIPE_AT) add();
        }}
        className="relative flex items-center gap-3 bg-[#0a0a0a] py-2"
      >
        <Link tabIndex={-1} aria-hidden href={productHref(shirt.id)} draggable={false} className="w-14 shrink-0">
          <TeeMockup shirt={shirt} color={color} sizes={SIZES.thumb} className="pointer-events-none w-full" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={productHref(shirt.id)} draggable={false} className="block py-0.5">
            <p className="line-clamp-2 text-sm">{shirt.title}</p>
            <p className="truncate text-xs text-muted">{top ? "Top pick" : CATEGORY_LABELS[shirt.category]}</p>
          </Link>
        </div>
        <button
          type="button"
          onClick={add}
          aria-label={size ? `Add ${shirt.title} to bag, size ${SIZE_LABELS[size]}` : `Select size for ${shirt.title}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-white hover:bg-white/5"
        >
          <Icon name="plus" className="h-5 w-5" />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${shirt.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-white">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </motion.div>
    </motion.li>
  );
}
