"use client";

import { memo } from "react";
import Link from "next/link";
import { TeeMockup } from "@/components/TeeMockup";
import { SIZES } from "@/lib/images";
import { SaveButton } from "@/components/ui";
import { useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { type BaseColor, type ShirtProduct } from "@/types/shirt";
import { useHydrated } from "@/store/useUiStore";
import { productHref } from "@/lib/catalog";

/**
 * Grid card: the picture, full-bleed, and the name (up to two lines). The
 * whole card is one link (a "stretched link": the title's ::after covers the
 * card) and the heart is a sibling on top of it — never a button inside a
 * link. No price (prices are shown only where money changes hands). The
 * first card of your edit says "Top pick", quietly. The heart shows on hover
 * with a mouse, and once a tee is saved; on touch, until then, it isn't
 * there at all (saving is on the product page and in Discover). Memoised: the
 * grid re-renders on filter / paging, not on scroll.
 */
export const ProductCard = memo(function ProductCard({
  shirt,
  topPick = false,
  color,
  onOpen,
  variations = 0,
}: {
  shirt: ShirtProduct;
  /** The first card of your edit (after the taste test). */
  topPick?: boolean;
  /** Other designs in this card's family. */
  variations?: number;
  /** Render in this tee colour (and open the product in it); default = original. */
  color?: BaseColor;
  onOpen?: (id: string) => void;
}) {
  const tee = color ?? shirt.baseColor;
  const hydrated = useHydrated();
  const saved = useTasteStore((s) => s.likedIds.includes(shirt.id)) && hydrated;
  const more = variations ? `, ${variations} ${variations === 1 ? "variation" : "variations"}` : "";
  // `isolate`: the card's own controls stack inside the card and never above
  // the shop's control row or a page's sticky buy bar.
  return (
    <div className="group relative isolate" data-product-card>
      <div className="relative overflow-hidden">
        <TeeMockup shirt={shirt} color={tee} sizes={SIZES.grid} className="w-full" />
      </div>
      <div className="mt-2 px-1">
        {topPick && <p className="text-xs text-muted">Top pick</p>}
        <Link
          href={productHref(shirt.id)}
          onClick={() => {
            if (color) useCartStore.getState().setColor(shirt.id, color);
            onOpen?.(shirt.id);
          }}
          className="line-clamp-2 text-[13px] leading-snug text-neutral-100 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-white"
          aria-label={`${shirt.title}${topPick ? ", Top pick" : ""}${more}`}
        >
          {shirt.title}
        </Link>
      </div>
      {/* A sibling of the link, stacked above its ::after. On touch it isn't rendered until saved. */}
      <SaveButton
        id={shirt.id}
        title={shirt.title}
        className={`absolute right-2 top-2 z-10 h-11 w-11 ${saved ? "" : "hidden [@media(hover:hover)_and_(pointer:fine)]:flex [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-visible:opacity-100"}`}
      />
    </div>
  );
});
