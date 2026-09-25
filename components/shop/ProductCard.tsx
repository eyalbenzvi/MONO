"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { MatchBadge, SaveButton, STAGE_BG, TeeDot } from "@/components/ui";
import { useCartStore } from "@/store/cartStore";
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct } from "@/types/shirt";
import { formatPrice } from "@/lib/format";

/** Below this the % adds noise, not information. */
const SHOW_BADGE_FROM = 80;

/**
 * Grid card. The whole card is one link (a "stretched link": the title's
 * ::after covers the card) and the heart is a sibling on top of it — never a
 * button inside a link. Memoised: the grid re-renders on filter / paging,
 * not on scroll, and unchanged cards skip the work.
 */
export const ProductCard = memo(function ProductCard({
  shirt,
  score,
  showMatch,
  topPick = false,
  color,
  onOpen,
  variations = 0,
}: {
  shirt: ShirtProduct;
  score: number;
  /** Computed once by the parent (match % only after the taste test). */
  showMatch: boolean;
  topPick?: boolean;
  /** Other designs in this card's family (shown as "+N variations"). */
  variations?: number;
  /** Render in this tee colour (and open the product in it); default = original. */
  color?: BaseColor;
  onOpen?: (id: string) => void;
}) {
  const tee = color ?? shirt.baseColor;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="group relative">
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ring-1 ring-white/10 ${STAGE_BG}`}>
        {showMatch && (topPick || score >= SHOW_BADGE_FROM) && (
          <div className="absolute left-2 top-2">
            <MatchBadge score={score} size="sm" variant={topPick ? "top" : "quiet"} />
          </div>
        )}
        {variations > 0 && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/15">
            +{variations} variation{variations === 1 ? "" : "s"}
          </span>
        )}
        <TeeMockup shirt={shirt} color={tee} className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <Link
            href={`/shop/${shirt.id}/`}
            onClick={() => {
              if (color) useCartStore.getState().setColor(shirt.id, color);
              onOpen?.(shirt.id);
            }}
            className="block truncate rounded-2xl text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-black"
            aria-label={`${shirt.title}, ${formatPrice(shirt.price)}${showMatch ? `, ${score}% match` : ""}${variations ? `, ${variations} variations` : ""}`}
          >
            {shirt.title}
          </Link>
          <p className="truncate text-xs text-neutral-400">
            <TeeDot color={tee} /> {COLOR_LABELS[tee]} · {CATEGORY_LABELS[shirt.category]}
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm">{formatPrice(shirt.price)}</span>
      </div>
      {/* Sibling of the link, stacked above its ::after */}
      <SaveButton id={shirt.id} className="absolute right-2 top-2 z-10 h-8 w-8" />
    </motion.div>
  );
});
