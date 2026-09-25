"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, Sparkles } from "lucide-react";
import { useShowMatch } from "@/components/ui";
import { ProductCard } from "@/components/shop/ProductCard";
import { SHIRTS, dedupeByFamily, paceByVariant } from "@/lib/catalog";
import { rankShirts, topTraits, type ShopSort } from "@/lib/recommendation";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { SHOP_PAGE_SIZE, makeHeaderScrollHandler, useUiStore, useHydrated, shopScroll } from "@/store/useUiStore";
import { CATEGORY_LABELS, COLOR_LABELS, FEATURE_LABELS, SHIRT_CATEGORIES, type BaseColor, type ShirtCategory } from "@/types/shirt";
import { track } from "@/lib/analytics";

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "match", label: "For you" },
  { value: "price-asc", label: "Price: low–high" },
  { value: "price-desc", label: "Price: high–low" },
];

export function ShopView() {
  const hydrated = useHydrated();
  const vector = useTasteStore((s) => s.preferenceVector);
  const { done, total, complete } = useCalibrationProgress();
  // One primitive per selector: the grid re-renders only when these change.
  const category = useUiStore((s) => s.shop.category);
  const sort = useUiStore((s) => s.shop.sort);
  const teeView = useUiStore((s) => s.shop.teeView);
  const limit = useUiStore((s) => s.shop.limit);
  const showMatch = useShowMatch();
  const setShop = useUiStore((s) => s.setShop);
  const setProductOrigin = useUiStore((s) => s.setProductOrigin);
  const openFromGrid = useCallback(() => setProductOrigin("/shop/"), [setProductOrigin]);

  useEffect(() => {
    if (hydrated) track("shop_view", { category: useUiStore.getState().shop.category, sort: useUiStore.getState().shop.sort });
  }, [hydrated]);

  // Rank with a snapshot of the taste vector taken on entry (and when sort or
  // category change): a heart tap trains the vector, and re-ranking live
  // would reshuffle the grid under the user's finger.
  const [rankVector, setRankVector] = useState(vector);
  useEffect(() => {
    setRankVector(useTasteStore.getState().preferenceVector);
  }, [hydrated, sort, category]);
  const ranked = useMemo(() => rankShirts(rankVector, SHIRTS, sort), [rankVector, sort]);
  const bestId = ranked[0]?.shirt.id;
  // One design per family (the best-ranked one) — its siblings are offered as
  // variations on the product page. With "For you", neighbouring cards also
  // never share an algorithm (display-only pacing; scores are untouched).
  const visible = useMemo(() => {
    const filtered = dedupeByFamily(ranked.filter(({ shirt }) => !category || shirt.category === category));
    return sort === "match" ? paceByVariant(filtered, 3) : filtered;
  }, [ranked, category, sort]);
  const traits = topTraits(vector, 3);

  // Restore scroll position when coming back from a product page.
  const scroller = useRef<HTMLDivElement>(null);
  // The programmatic restore must not count as "scrolling down" (which would hide the header).
  const restoring = useRef(false);
  useLayoutEffect(() => {
    if (!hydrated || !scroller.current) return;
    restoring.current = true;
    scroller.current.scrollTop = shopScroll.top;
    requestAnimationFrame(() => (restoring.current = false));
  }, [hydrated]);
  const onHeaderScroll = useMemo(() => makeHeaderScrollHandler(), []);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!restoring.current) onHeaderScroll(e);
    shopScroll.top = e.currentTarget.scrollTop;
  };

  // Infinite scroll in batches — thousands of mockups, rendered lazily.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setShop({ limit: useUiStore.getState().shop.limit + SHOP_PAGE_SIZE }),
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hydrated, visible.length, setShop]);

  const setFilter = (patch: Partial<{ category: ShirtCategory | null; sort: ShopSort; teeView: BaseColor | "original" }>) => {
    shopScroll.top = 0;
    setShop({ ...patch, limit: SHOP_PAGE_SIZE });
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <div ref={scroller} onScroll={onScroll} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-16">
        {/* One-line taste summary / taste-test nudge */}
        {hydrated && (
          <div className="flex h-11 items-center gap-2">
            {complete ? (
              <>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-white">
                  <Sparkles className="h-4 w-4" /> Ranked for you
                </span>
                <div className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto">
                  {traits.map((k) => (
                    <span key={k} className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-neutral-200 ring-1 ring-white/10">
                      {FEATURE_LABELS[k]}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">
                  Take the {total}-tee taste test for real picks <span className="text-neutral-400">· {done}/{total}</span>
                </span>
                <Link href="/" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-xs font-bold text-black">
                  Start <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        )}

        {/* Sticky controls */}
        <div className="sticky top-0 z-10 -mx-4 bg-[#050505]/90 px-4 pb-3 pt-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400">Show on</span>
              <div className="flex rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/10" role="radiogroup" aria-label="Show tees in">
                {(["original", "black", "white"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={teeView === v}
                    aria-label={v === "original" ? "Original colours" : `${COLOR_LABELS[v]} tees`}
                    onClick={() => setFilter({ teeView: v })}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${teeView === v ? "bg-white/15 ring-1 ring-white" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`h-5 w-5 rounded-full ring-1 ${
                        v === "original"
                          ? "bg-[linear-gradient(90deg,#000_50%,#fff_50%)] ring-white/40"
                          : v === "black"
                            ? "bg-black ring-white/40"
                            : "bg-white ring-black/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <label className="relative ml-auto flex h-10 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-xs text-neutral-300 ring-1 ring-white/10">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                value={sort}
                onChange={(e) => setFilter({ sort: e.target.value as ShopSort })}
                className="cursor-pointer appearance-none bg-transparent font-semibold text-white"
                aria-label="Sort"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-ink-900">
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            <Chip active={category === null} onClick={() => setFilter({ category: null })}>
              All
            </Chip>
            {SHIRT_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setFilter({ category: category === c ? null : c })}>
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>

        <p className="mb-3 text-xs text-neutral-400">
          {visible.length} design{visible.length === 1 ? "" : "s"} · tap one to see its variations
        </p>

        {hydrated ? (
          visible.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {visible.slice(0, limit).map(({ shirt, score, variations }) => (
                  <ProductCard
                    key={shirt.id}
                    shirt={shirt}
                    score={score}
                    variations={variations}
                    color={teeView === "original" ? undefined : teeView}
                    topPick={complete && sort === "match" && shirt.id === bestId}
                    showMatch={showMatch}
                    onOpen={openFromGrid}
                  />
                ))}
              </div>
              {limit < visible.length && (
                <div ref={sentinel} className="flex justify-center pt-6">
                  <button
                    type="button"
                    onClick={() => setShop({ limit: limit + SHOP_PAGE_SIZE })}
                    className="h-11 rounded-full px-5 text-xs font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/5"
                  >
                    Show more · {visible.length - limit} left
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-sm text-neutral-400">
              No tees in this category.
              <button type="button" onClick={() => setFilter({ category: null })} className="ml-1 font-semibold text-white underline">
                Show all
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      }}
      aria-pressed={active}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
        active ? "bg-white text-black" : "bg-white/[0.04] text-neutral-300 ring-1 ring-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
