"use client";

import { Icon } from "@/components/Icon";
import { useCartStore } from "@/store/cartStore";
import { useHydrated } from "@/store/useUiStore";

/** A catalogue design with a line in the bag, in any colour and size (a personalised or uploaded print isn't the design). */
export function useInBag(id: string) {
  const hydrated = useHydrated();
  return useCartStore((s) => s.cart.some((i) => i.id === id && !i.custom && !i.upload)) && hydrated;
}

/**
 * "✓ In bag": the white tag (the bag confirmation's look) on a picture of a design that's in the bag,
 * wherever the site shows it: the shop grid, a Discover card, the product page, the strips. `size`
 * "sm" for a narrow tile. Positioned by the caller (`className`); decorative to screen readers, whose
 * link or heading says "in your bag" itself.
 */
export function InBagTag({ id, size = "md", className = "" }: { id: string; size?: "sm" | "md"; className?: string }) {
  if (!useInBag(id)) return null;
  return (
    <span
      data-in-bag
      aria-hidden
      className={`pointer-events-none flex items-center gap-1 rounded-full bg-white font-medium text-black shadow-md shadow-black/30 ${size === "sm" ? "h-5 pl-1 pr-1.5 text-[10px]" : "h-6 pl-1.5 pr-2 text-[11px]"} ${className}`}
    >
      <Icon name="check" className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />
      In bag
    </span>
  );
}
