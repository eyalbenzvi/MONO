"use client";

import { memo } from "react";
import Link from "next/link";
import { TeeMockup } from "@/components/TeeMockup";
import { SIZES } from "@/lib/images";
import { InBagTag, useInBag } from "@/components/InBagTag";
import { SaveButton } from "@/components/ui";
import { useCartStore } from "@/store/cartStore";
import { type BaseColor, type ShirtProduct } from "@/types/shirt";
import { productHref } from "@/lib/catalog";

/**
 * Grid card: the picture, full-bleed, and the name (up to two lines). The
 * whole card is one link (a "stretched link": the title's ::after covers the
 * card) and the heart is a sibling on top of it — never a button inside a
 * link. No price (prices are shown only where money changes hands). The
 * first card of your edit says "Top pick", quietly. Every card carries its
 * heart in the top right corner, on every device: an outline to save, filled
 * once saved, a tap either way. A design with a line in the bag (any colour,
 * any size) says so in the top left corner: a white "In bag" tag with a tick,
 * the bag confirmation's own look. Memoised: the grid re-renders on filter /
 * paging, not on scroll.
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
  const inBag = useInBag(shirt.id);
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
          aria-label={`${shirt.title}${topPick ? ", Top pick" : ""}${inBag ? ", in your bag" : ""}${more}`}
        >
          {shirt.title}
        </Link>
      </div>
      <InBagTag id={shirt.id} className="absolute left-2 top-2 z-10" />
      {/* A sibling of the link, stacked above its ::after: on every card, on every device. */}
      <SaveButton id={shirt.id} title={shirt.title} size="overlay" className="absolute right-0.5 top-0.5 z-10" />
    </div>
  );
});
