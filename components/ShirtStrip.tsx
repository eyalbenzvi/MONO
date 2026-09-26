"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG } from "@/components/ui";
import { productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { BaseColor, ShirtProduct } from "@/types/shirt";
import type { AddSource } from "@/lib/analytics";

/**
 * The one row of tee thumbnails: a sideways-scrolling strip ("scroll": a
 * shared list, variations) or three across ("grid": picks in the bag, after
 * an order, on the taste-test screen). Each tile links to the product;
 * optional name, price and quick add underneath.
 */
export function ShirtStrip({
  shirts,
  layout = "scroll",
  label,
  names = true,
  prices = false,
  quickAdd = false,
  color,
  currentId,
  replace = false,
  onOpen,
  source,
}: {
  shirts: ShirtProduct[];
  layout?: "scroll" | "grid";
  /** Accessible name of the list. */
  label?: string;
  names?: boolean;
  prices?: boolean;
  quickAdd?: boolean;
  /** Show every tee in this colour (and keep it when opening one). */
  color?: BaseColor;
  /** The design on screen (variations): marked, not a way elsewhere. */
  currentId?: string;
  /** Replace the current page in history (moving between variations). */
  replace?: boolean;
  onOpen?: (shirt: ShirtProduct) => void;
  /** Where its quick adds happen (analytics). */
  source?: AddSource;
}) {
  const grid = layout === "grid";
  return (
    <ul aria-label={label} className={grid ? "grid max-w-lg grid-cols-3 gap-3" : "no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"}>
      {shirts.map((s) => {
        const current = s.id === currentId;
        return (
          <li key={s.id} className={`flex min-w-0 flex-col gap-1.5 ${grid ? "" : "w-24 shrink-0 sm:w-28"}`}>
            <Link
              href={productHref(s.id)}
              replace={replace}
              onClick={() => onOpen?.(s)}
              aria-current={current ? "page" : undefined}
              aria-label={`${s.title}, ${formatPrice(s.price)}${current ? " (showing)" : ""}`}
              className={`relative block rounded-xl p-1.5 transition ${STAGE_BG} ${current ? "ring-2 ring-white" : currentId ? "ring-1 ring-white/10 hover:ring-white/40" : ""}`}
            >
              {current && (
                <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <TeeMockup shirt={s} color={color} shadow={false} className="w-full" />
            </Link>
            {names && <p className="truncate px-0.5 text-xs text-neutral-300">{s.title}</p>}
            {prices && <p className="-mt-1 px-0.5 font-mono text-xs text-neutral-400">{formatPrice(s.price)}</p>}
            {quickAdd && <QuickAdd shirt={s} color={color} source={source} />}
          </li>
        );
      })}
    </ul>
  );
}
