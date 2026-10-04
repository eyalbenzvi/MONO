"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { QuickAdd } from "@/components/QuickAdd";
import { InBagTag } from "@/components/InBagTag";
import { TeeMockup } from "@/components/TeeMockup";
import { SIZES } from "@/lib/images";
import { productHref } from "@/lib/catalog";
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
  quickAdd = false,
  color,
  currentId,
  replace = false,
  onOpen,
  onNavigate,
  source,
}: {
  shirts: ShirtProduct[];
  layout?: "scroll" | "grid";
  /** Accessible name of the list. */
  label?: string;
  names?: boolean;
  quickAdd?: boolean;
  /** Show every tee in this colour (and keep it when opening one). */
  color?: BaseColor;
  /** The design on screen (variations): marked, not a way elsewhere. */
  currentId?: string;
  /** Replace the current page in history (moving between variations). */
  replace?: boolean;
  onOpen?: (shirt: ShirtProduct) => void;
  /** Opens the tee itself (e.g. through a sheet's history): the link only names the address. */
  onNavigate?: (href: string) => void;
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
              onClick={(e) => {
                onOpen?.(s);
                if (onNavigate && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
                  e.preventDefault();
                  onNavigate(productHref(s.id));
                }
              }}
              aria-current={current ? "page" : undefined}
              aria-label={`${s.title}${current ? " (showing)" : ""}`}
              className={`relative block transition ${current ? "ring-2 ring-white" : currentId ? "ring-1 ring-white/10 hover:ring-white/40" : ""}`}
            >
              {current && (
                <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                  <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <TeeMockup shirt={s} color={color} sizes={SIZES.thumb} className="w-full" />
              <InBagTag id={s.id} size="sm" className="absolute left-1 top-1 z-10" />
            </Link>
            {names && <p className="truncate px-0.5 text-xs text-neutral-300">{s.title}</p>}
            {/* The tile is narrow: the add button keeps to its width (the size shortened: "+ 3–4"). */}
            {quickAdd && <QuickAdd shirt={s} color={color} source={source} compact fill />}
          </li>
        );
      })}
    </ul>
  );
}
