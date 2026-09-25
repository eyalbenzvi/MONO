"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, Sparkles } from "lucide-react";
import { useHydrated } from "@/components/AppShell";
import { ProductCard } from "@/components/shop/ProductCard";
import { SHIRTS } from "@/lib/catalog";
import { rankShirts, topTraits, type RankedShirt, type ShopSort } from "@/lib/recommendation";
import { useCalibrationProgress, useShirtStore } from "@/store/useShirtStore";
import { SHOP_PAGE_SIZE, makeHeaderScrollHandler, useUiStore } from "@/store/useUiStore";
import { COLOR_LABELS, FEATURE_LABELS, type BaseColor, type FeatureKey } from "@/types/shirt";

const STYLE_FILTERS: FeatureKey[] = [
  "architectural",
  "abstract",
  "geometric",
  "typography",
  "line_art",
  "halftone_raster",
  "clean_minimal",
  "dark_industrial",
];
const STYLE_THRESHOLD = 0.6;

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "match", label: "For you" },
  { value: "price-asc", label: "Price: low–high" },
  { value: "price-desc", label: "Price: high–low" },
];

/**
 * Display-only variety: with the default ranking, never show more than two
 * prints of the same family in a row — pull the next-best of another family
 * forward instead. Scores and the ranking itself are untouched.
 */
function interleave(list: RankedShirt[]): RankedShirt[] {
  const pool = [...list];
  const out: RankedShirt[] = [];
  while (pool.length) {
    const a = out[out.length - 1]?.shirt.category;
    const b = out[out.length - 2]?.shirt.category;
    let i = 0;
    if (a && a === b) {
      const j = pool.findIndex((r) => r.shirt.category !== a);
      if (j !== -1) i = j;
    }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function ShopView() {
  const hydrated = useHydrated();
  const vector = useShirtStore((s) => s.preferenceVector);
  const { done, total, complete } = useCalibrationProgress();
  const { style, sort, teeView, limit } = useUiStore((s) => s.shop);
  const setShop = useUiStore((s) => s.setShop);
  const setCameFromShop = useUiStore((s) => s.setCameFromShop);

  const ranked = useMemo(() => rankShirts(vector, SHIRTS, sort), [vector, sort]);
  const bestId = ranked[0]?.shirt.id;
  const visible = useMemo(() => {
    const filtered = ranked.filter(({ shirt }) => !style || shirt.features[style] >= STYLE_THRESHOLD);
    return sort === "match" && !style ? interleave(filtered) : filtered;
  }, [ranked, style, sort]);
  const traits = topTraits(vector, 3);

  // Restore scroll position when coming back from a product page.
  const scroller = useRef<HTMLDivElement>(null);
  // The programmatic restore must not count as "scrolling down" (which would hide the header).
  const restoring = useRef(false);
  useLayoutEffect(() => {
    if (!hydrated || !scroller.current) return;
    restoring.current = true;
    scroller.current.scrollTop = useUiStore.getState().shop.scrollTop;
    requestAnimationFrame(() => (restoring.current = false));
  }, [hydrated]);
  const onHeaderScroll = useMemo(() => makeHeaderScrollHandler(), []);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!restoring.current) onHeaderScroll(e);
    useUiStore.getState().setShop({ scrollTop: e.currentTarget.scrollTop });
  };

  // Infinite scroll in batches — 1,000 mockups are rendered lazily.
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

  const setFilter = (patch: Partial<{ style: FeatureKey | null; sort: ShopSort; teeView: BaseColor | "original" }>) => {
    setShop({ ...patch, limit: SHOP_PAGE_SIZE, scrollTop: 0 });
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
                  Take the 10-tee taste test for real picks <span className="text-neutral-400">· {done}/{total}</span>
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
            <Chip active={style === null} onClick={() => setFilter({ style: null })}>
              All styles
            </Chip>
            {STYLE_FILTERS.map((k) => (
              <Chip key={k} active={style === k} onClick={() => setFilter({ style: style === k ? null : k })}>
                {FEATURE_LABELS[k]}
              </Chip>
            ))}
          </div>
        </div>

        <p className="mb-3 text-xs text-neutral-400">
          {visible.length} tee{visible.length === 1 ? "" : "s"}
        </p>

        {hydrated ? (
          visible.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {visible.slice(0, limit).map(({ shirt, score }) => (
                  <ProductCard
                    key={shirt.id}
                    shirt={shirt}
                    score={score}
                    color={teeView === "original" ? undefined : teeView}
                    topPick={complete && sort === "match" && shirt.id === bestId}
                    onOpen={() => setCameFromShop(true)}
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
              No tees match this style.
              <button type="button" onClick={() => setFilter({ style: null })} className="ml-1 font-semibold text-white underline">
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
