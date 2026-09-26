"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { MatchBadge, SaveButton, ShareButton, STAGE_BG, TeeDot } from "@/components/ui";
import { useCartStore } from "@/store/cartStore";
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct, type UserProfileVector } from "@/types/shirt";
import { TIER_LABEL, tierOf } from "@/lib/match";
import { explainMatch } from "@/lib/recommendation";
import { isNewThisWeek } from "@/lib/taste";
import { formatPrice } from "@/lib/format";
import { productHref } from "@/lib/catalog";
import { QuickAdd } from "@/components/QuickAdd";

/**
 * Grid card. The whole card is one link (a "stretched link": the title's
 * ::after covers the card) and the heart is a sibling on top of it — never a
 * button inside a link. Memoised: the grid re-renders on filter / paging,
 * not on scroll, and unchanged cards skip the work.
 */
export const ProductCard = memo(function ProductCard({
  shirt,
  score,
  vector,
  showMatch,
  topPick = false,
  color,
  onOpen,
  variations = 0,
  wildcard = false,
}: {
  shirt: ShirtProduct;
  score: number;
  /** The profile the grid is ranked with (a stable snapshot, so memo holds). */
  vector: UserProfileVector;
  /** Computed once by the parent (match only after the taste test). */
  showMatch: boolean;
  topPick?: boolean;
  /** Other designs in this card's family (shown as "+N variations"). */
  variations?: number;
  /** A deliberate taste probe from outside your usual (shop diversity). */
  wildcard?: boolean;
  /** Render in this tee colour (and open the product in it); default = original. */
  color?: BaseColor;
  onOpen?: (id: string) => void;
}) {
  const tee = color ?? shirt.baseColor;
  // Only the upper tiers get a badge; below that it's noise, not information.
  const tier = showMatch ? (topPick ? "top" : tierOf(vector, score)) : null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="group relative">
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ring-1 ring-white/10 ${STAGE_BG}`}>
        <TeeMockup shirt={shirt} color={tee} className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {(wildcard || isNewThisWeek(shirt.dropWeek)) && (
          <span className="absolute bottom-2 left-2 rounded-full border border-dashed border-white/50 bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            {isNewThisWeek(shirt.dropWeek) ? "New this week" : "Wildcard"}
          </span>
        )}
        {/* Above the stretched link's ::after (z-10 in the same stacking context). */}
        <QuickAdd shirt={shirt} color={tee} variant="overlay" className="absolute bottom-2 right-2 z-10" />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <Link
            href={productHref(shirt.id)}
            onClick={() => {
              if (color) useCartStore.getState().setColor(shirt.id, color);
              onOpen?.(shirt.id);
            }}
            className="block truncate rounded-2xl text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-black"
            aria-label={`${shirt.title}, ${formatPrice(shirt.price)}${tier ? `, ${TIER_LABEL[tier]}` : ""}${variations ? `, ${variations} variations` : ""}`}
          >
            {shirt.title}
          </Link>
          <p className="truncate text-xs text-neutral-400">
            <TeeDot color={tee} /> {COLOR_LABELS[tee]} · {CATEGORY_LABELS[shirt.category]}
          </p>
          {variations > 0 && (
            <p className="truncate text-xs text-neutral-400">
              +{variations} variation{variations === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <span className="shrink-0 font-mono text-sm">{formatPrice(shirt.price)}</span>
      </div>
      {/* Siblings of the link, stacked above its ::after (and outside the
          image's overflow clip, so the badge's "why" can open over the grid). */}
      {tier && (
        <div className="absolute left-2 top-2 z-20">
          <MatchBadge tier={tier} size="sm" quiet={!topPick} why={() => explainMatch(vector, shirt.features)} />
        </div>
      )}
      <ShareButton id={shirt.id} title={shirt.title} color={tee} className="absolute right-12 top-2 z-10 h-8 w-8" />
      <SaveButton id={shirt.id} className="absolute right-2 top-2 z-10 h-8 w-8" />
    </motion.div>
  );
});
