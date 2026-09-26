"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { SaveButton, STAGE_BG, TeeDot } from "@/components/ui";
import { useCartStore } from "@/store/cartStore";
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct } from "@/types/shirt";
import { isNew } from "@/lib/taste";
import { useHydrated } from "@/store/useUiStore";
import { productHref } from "@/lib/catalog";

/**
 * Grid card. The whole card is one link (a "stretched link": the title's
 * ::after covers the card) and the heart is a sibling on top of it — never a
 * button inside a link. Quiet by design: at most one tag ("Top pick" on the
 * first card of your ranking, else "New this week"); how well a tee matches
 * is on its product page; adding to the bag (it needs a size) happens there.
 * The heart shows on hover with a mouse. Memoised: the grid re-renders on filter /
 * paging, not on scroll, and unchanged cards skip the work.
 */
export const ProductCard = memo(function ProductCard({
  shirt,
  topPick = false,
  color,
  onOpen,
  variations = 0,
}: {
  shirt: ShirtProduct;
  /** The first card of the "For you" ranking (after the taste test). */
  topPick?: boolean;
  /** Other designs in this card's family (shown as "+N variations"). */
  variations?: number;
  /** Render in this tee colour (and open the product in it); default = original. */
  color?: BaseColor;
  onOpen?: (id: string) => void;
}) {
  const tee = color ?? shirt.baseColor;
  // "New" is judged on the viewer's clock, so only once running in the browser.
  const hydrated = useHydrated();
  const tag = topPick ? "Top pick" : hydrated && isNew(shirt.dropDate) ? "New this week" : null;
  // `isolate`: the card's own controls (z-10) stack inside the card and
  // never above the shop's sticky filter bar or a page's sticky buy bar.
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="group relative isolate">
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ring-1 ring-white/10 ${STAGE_BG}`}>
        <TeeMockup shirt={shirt} color={tee} className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {tag && (
          <span
            className={`absolute left-2 top-2 z-10 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
              topPick ? "bg-white text-black" : "border border-dashed border-white/50 bg-black/40 font-semibold text-white"
            }`}
          >
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
        <Link
          href={productHref(shirt.id)}
          onClick={() => {
            if (color) useCartStore.getState().setColor(shirt.id, color);
            onOpen?.(shirt.id);
          }}
          className="block min-w-0 truncate rounded-2xl text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-black"
          aria-label={`${shirt.title}${tag ? `, ${tag}` : ""}${variations ? `, ${variations} variations` : ""}`}
        >
          {shirt.title}
        </Link>
      </div>
      <p className="truncate px-0.5 text-xs text-neutral-400">
        <TeeDot color={tee} /> {COLOR_LABELS[tee]} · {CATEGORY_LABELS[shirt.category]}
        {variations > 0 && ` · +${variations} variation${variations === 1 ? "" : "s"}`}
      </p>
      {/* A sibling of the link, stacked above its ::after. */}
      {/* With a mouse it shows on hover (a saved heart always shows). */}
      <SaveButton
        id={shirt.id}
        className="absolute right-2 top-2 z-10 h-8 w-8 transition-opacity focus-visible:opacity-100 aria-pressed:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
      />
    </motion.div>
  );
});
