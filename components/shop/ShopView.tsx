"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { radioKeys } from "@/components/ui";
import { ProductCard } from "@/components/shop/ProductCard";
import { SortSheet } from "@/components/shop/SortSheet";
import { SharedList } from "@/components/shop/ShopExtras";
import { SHIRTS, dedupeByFamily, diversify } from "@/lib/catalog";
import { rankShirts, type ShopSort } from "@/lib/recommendation";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { SHOP_PAGE_SIZE, makeHeaderScrollHandler, useUiStore, useHydrated, shopScroll } from "@/store/useUiStore";
import { CATEGORY_LABELS, SHIRT_CATEGORIES, type BaseColor, type ShirtCategory, type ShirtProduct } from "@/types/shirt";
import { itemOf, track, trackEcommerce } from "@/lib/analytics";
import { PAIR_PRICE } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export const SORT_LABELS: Record<ShopSort, string> = { match: "For you", popular: "Popular", new: "Newest" };


export function ShopView() {
  const hydrated = useHydrated();
  const vector = useTasteStore((s) => s.preferenceVector);
  const { done, total, complete } = useCalibrationProgress();
  // One primitive per selector: the grid re-renders only when these change.
  const category = useUiStore((s) => s.shop.category);
  const chosenSort = useUiStore((s) => s.shop.sort);
  const limit = useUiStore((s) => s.shop.limit);
  // Before the taste test there's no taste to rank by: "Popular" (the
  // generator's fixed editorial order — not usage data) is the default.
  const sort: ShopSort = chosenSort ?? (complete ? "match" : "popular");
  const [sheetOpen, setSheetOpen] = useState(false);
  const setShop = useUiStore((s) => s.setShop);
  const setProductOrigin = useUiStore((s) => s.setProductOrigin);
  const openFromGrid = useCallback(
    (id: string) => {
      setProductOrigin({ from: "/shop/", id });
      const index = visibleRef.current.findIndex((x) => x.shirt.id === id);
      const shirt = visibleRef.current[index]?.shirt;
      if (shirt) trackEcommerce("select_item", { item_list_id: listIdRef.current, items: [itemOf(shirt, { index })] });
    },
    [setProductOrigin],
  );
  const visibleRef = useRef<{ shirt: ShirtProduct }[]>([]);
  const listIdRef = useRef("");


  // Rank with a snapshot of the taste vector taken on entry (and when sort or
  // category change): a heart tap trains the vector, and re-ranking live
  // would reshuffle the grid under the user's finger.
  // The snapshot is taken during render, so the grid ranks once when the
  // stored taste arrives (not once with the neutral profile, then again).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rankVector = useMemo(() => useTasteStore.getState().preferenceVector, [hydrated, sort, category]);
  const ranked = useMemo(() => rankShirts(rankVector, SHIRTS, sort), [rankVector, sort]);
  // One design per family (the best-ranked one) — its siblings are offered as
  // variations on the product page. The top of the grid is diversified
  // (display only; scores are untouched): no three in a row of one
  // category or tee colour, no algorithm repeats, and a wildcard every 8th
  // card when ranking for you.
  const visible = useMemo(() => {
    const filtered = dedupeByFamily(ranked.filter(({ shirt }) => !category || shirt.category === category));
    return diversify(filtered, { category: !category, color: true, wildcardEvery: sort === "match" ? 8 : 0 });
  }, [ranked, category, sort]);
  visibleRef.current = visible;
  listIdRef.current = `shop_${sort}${category ? `_${category}` : ""}`;

  // shop_view once per visit, with the order actually shown; the list
  // itself (first page) each time the order or category changes.
  const viewed = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!viewed.current) track("shop_view", { category, sort, default_sort: chosenSort === null });
    viewed.current = true;
    trackEcommerce("view_item_list", {
      item_list_id: `shop_${sort}${category ? `_${category}` : ""}`,
      items: visible.slice(0, SHOP_PAGE_SIZE).map(({ shirt }, index) => itemOf(shirt, { index })),
    });
    // The list is keyed by what the shopper chose, not by every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sort, category]);

  // Opened at /shop/?page=N (the "Show more" link): that many pages, once.
  useEffect(() => {
    if (!hydrated) return;
    const q = new URLSearchParams(window.location.search);
    const page = Number(q.get("page"));
    if (Number.isInteger(page) && page > 1) setShop({ limit: Math.min(page, 200) * SHOP_PAGE_SIZE });
    if (q.has("page")) {
      q.delete("page");
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
  }, [hydrated, setShop]);

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
  // The filter bar gets a hairline once it's stuck (content passes under it).
  const [stuck, setStuck] = useState(false);
  const headerHidden = useUiStore((s) => s.headerHidden);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!restoring.current) onHeaderScroll(e);
    shopScroll.top = e.currentTarget.scrollTop;
    const isStuck = e.currentTarget.scrollTop > 44;
    if (isStuck !== stuck) setStuck(isStuck);
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

  const setFilter = (patch: Partial<{ category: ShirtCategory | null; sort: ShopSort | null; teeView: BaseColor | "original" }>) => {
    shopScroll.top = 0;
    setShop({ ...patch, limit: SHOP_PAGE_SIZE });
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    // Reaches up under the floating header (a spacer keeps the content below
    // it), so when the header slides away the grid fills the space.
    <div ref={scroller} onScroll={onScroll} className="no-scrollbar -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto">
      {/* A spacer, not padding: sticky offsets are measured inside the
          scroller's padding, which would push the filter bar down. */}
      <div aria-hidden className="h-[var(--header-h)]" />
      <div className="mx-auto max-w-5xl px-4 pb-16 2xl:max-w-[1400px] min-[1800px]:max-w-[1600px]">
        {/* One-line taste summary / taste-test nudge (height kept before hydration). */}
        {!hydrated ? (
          <div className="h-11" />
        ) : (
          <div className="flex h-11 items-center gap-2">
            {complete ? (
              <>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-white">
                  <Icon name="sparkles" className="h-4 w-4" /> Ranked for you
                </span>
                <PriceLine />
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">
                  {total} swipes → <span className="max-[339px]:hidden">ranked </span>for you{done > 0 && <span className="text-neutral-400"> · {done}/{total}</span>}
                </span>
                <PriceLine className="max-sm:hidden" />
                <Link href="/" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-xs font-bold text-black">
                  Start <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        )}

        {/* One sticky row: categories scroll sideways; the tee-colour preview
            stays in view (black / white switch without scrolling); the order
            lives behind the sort button. */}
        {/* Solid, above every card control (cards isolate their own z-index),
            right under the header while it shows and at the very top once it
            has slid away — moving with it (same 200 ms). */}
        <div
          className={`app-backdrop sticky z-20 -mx-4 flex items-center gap-2 border-b py-2 pl-4 pr-4 transition-[top,border-color] duration-200 ease-out ${
            stuck ? "border-white/10" : "border-transparent"
          }`}
          style={{ top: headerHidden ? 0 : "var(--header-h)" }}
        >
          {/* One scrolling row of categories at every width, fading out at the edge. */}
          <div
            className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pl-4 pr-6 [mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)]"
            role="group"
            aria-label="Category"
          >
            <Chip active={category === null} onClick={() => setFilter({ category: null })}>
              All
            </Chip>
            {/* Categories that have designs (the content review can empty one); the catalog is loaded by the time this renders. */}
            {SHIRT_CATEGORIES.filter((c) => SHIRTS.some((s) => s.category === c)).map((c) => (
              <Chip key={c} active={category === c} onClick={() => setFilter({ category: category === c ? null : c })}>
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Sort: ${SORT_LABELS[sort]}`}
            className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ${
              chosenSort ? "bg-white text-black ring-white" : "bg-white/[0.04] text-neutral-200 ring-white/10 hover:bg-white/10"
            }`}
          >
            <Icon name="arrow-up-down" className="h-4 w-4" /> <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
          </button>
        </div>
        <SortSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sort={sort} canMatch={complete} onSort={(v) => setFilter({ sort: v })} />
        <div className="h-2" />
        <SharedList />

        {/* Rendered on the server too, in the default order ("Popular" — no
            personal data needed), so the page arrives with products. A
            personal order after hydration swaps in with a short fade (same
            card sizes, nothing moves). */}
        {visible.length > 0 ? (
            <>
              <div key={sort} className="grid animate-[fade-in_0.25s_ease-out] grid-cols-1 gap-x-3 gap-y-6 min-[340px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
                {visible.slice(0, limit).map(({ shirt, variations }, i) => (
                  <ProductCard
                    key={shirt.id}
                    shirt={shirt}
                    variations={variations}
                    topPick={complete && sort === "match" && i === 0}
                    onOpen={openFromGrid}
                  />
                ))}
              </div>
              {limit < visible.length && (
                <div ref={sentinel} className="flex justify-center pt-6">
                  {/* A real link (?page=N) for crawlers and new tabs; here it just shows more. */}
                  <Link
                    href={`/shop/?page=${Math.ceil(limit / SHOP_PAGE_SIZE) + 1}`}
                    scroll={false}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      setShop({ limit: limit + SHOP_PAGE_SIZE });
                    }}
                    className="flex h-11 items-center rounded-full px-5 text-xs font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/5"
                  >
                    Show more · {visible.length - limit} left
                  </Link>
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

/** One price for everything: said once, as store policy, instead of on every card. */
export function PriceLine({ className = "" }: { className?: string }) {
  return (
    <span className={`ml-auto shrink-0 text-xs text-neutral-400 ${className}`}>
      Every tee {formatPrice(SHIRTS[0]?.price ?? 0)} · pair {formatPrice(PAIR_PRICE)}
    </span>
  );
}
