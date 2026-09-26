"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, Sparkles } from "lucide-react";
import { radioKeys } from "@/components/ui";
import { ProductCard } from "@/components/shop/ProductCard";
import { SortSheet } from "@/components/shop/SortSheet";
import { SharedList, Trending } from "@/components/shop/ShopExtras";
import { SHIRTS, dedupeByFamily, diversify } from "@/lib/catalog";
import { rankShirts, topTraits, type ShopSort } from "@/lib/recommendation";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { SHOP_PAGE_SIZE, makeHeaderScrollHandler, useUiStore, useHydrated, shopScroll } from "@/store/useUiStore";
import { CATEGORY_LABELS, FEATURE_LABELS, SHIRT_CATEGORIES, type BaseColor, type ShirtCategory } from "@/types/shirt";
import { track } from "@/lib/analytics";

export const SORT_LABELS: Record<ShopSort, string> = { match: "For you", popular: "Popular", new: "Newest" };

type TeeView = BaseColor | "original";
const TEE_VIEWS: { value: TeeView; label: string }[] = [
  { value: "original", label: "Original colours" },
  { value: "black", label: "Black tees" },
  { value: "white", label: "White tees" },
];

const swatchClass = (v: TeeView) =>
  v === "original" ? "bg-[linear-gradient(90deg,#000_50%,#fff_50%)] ring-white/40" : v === "black" ? "bg-black ring-white/40" : "bg-white ring-black/20";

/**
 * Preview every print on one tee colour (each comes in both). Phones get
 * one button that cycles original → black → white (the chips need the
 * room); wider screens show the three options.
 */
function TeeViewToggle({ value, onChange }: { value: TeeView; onChange: (v: TeeView) => void }) {
  const i = TEE_VIEWS.findIndex((v) => v.value === value);
  const next = TEE_VIEWS[(i + 1) % TEE_VIEWS.length];
  return (
    <>
      <button
        type="button"
        onClick={() => onChange(next.value)}
        aria-label={`Preview tees in: ${TEE_VIEWS[i].label}. Change to ${next.label.toLowerCase()}`}
        title={TEE_VIEWS[i].label}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-white/10 sm:hidden"
      >
        <span aria-hidden className={`h-5 w-5 rounded-full ring-1 ${swatchClass(value)}`} />
      </button>
      <TeeViewRadios value={value} onChange={onChange} />
    </>
  );
}

function TeeViewRadios({ value, onChange }: { value: TeeView; onChange: (v: TeeView) => void }) {
  const keys = radioKeys(TEE_VIEWS.map((v) => v.value), value, onChange);
  return (
    <div className="hidden shrink-0 rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/10 sm:flex" role="radiogroup" aria-label="Preview tees in">
      {TEE_VIEWS.map((v, i) => (
        <button
          key={v.value}
          type="button"
          role="radio"
          aria-checked={value === v.value}
          aria-label={v.label}
          title={v.label}
          onClick={() => onChange(v.value)}
          {...keys(i)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${value === v.value ? "bg-white/15 ring-1 ring-white" : ""}`}
        >
          <span
            aria-hidden
            className={`h-4 w-4 rounded-full ring-1 ${
              v.value === "original" ? "bg-[linear-gradient(90deg,#000_50%,#fff_50%)] ring-white/40" : v.value === "black" ? "bg-black ring-white/40" : "bg-white ring-black/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ShopView() {
  const hydrated = useHydrated();
  const vector = useTasteStore((s) => s.preferenceVector);
  const { done, total, complete } = useCalibrationProgress();
  // One primitive per selector: the grid re-renders only when these change.
  const category = useUiStore((s) => s.shop.category);
  const chosenSort = useUiStore((s) => s.shop.sort);
  const teeView = useUiStore((s) => s.shop.teeView);
  const limit = useUiStore((s) => s.shop.limit);
  // Before the taste test there's no taste to rank by: "Popular" (the
  // generator's fixed editorial order — not usage data) is the default.
  const sort: ShopSort = chosenSort ?? (complete ? "match" : "popular");
  const [sheetOpen, setSheetOpen] = useState(false);
  const setShop = useUiStore((s) => s.setShop);
  const setProductOrigin = useUiStore((s) => s.setProductOrigin);
  const openFromGrid = useCallback((id: string) => setProductOrigin({ from: "/shop/", id }), [setProductOrigin]);

  useEffect(() => {
    if (hydrated) track("shop_view", { category: useUiStore.getState().shop.category, sort: useUiStore.getState().shop.sort });
  }, [hydrated]);

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
    return diversify(filtered, { category: !category, color: teeView === "original", wildcardEvery: sort === "match" ? 8 : 0 });
  }, [ranked, category, sort, teeView]);
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
                  <Sparkles className="h-4 w-4" /> Ranked for you
                </span>
                <div className="flex min-w-0 gap-1.5 overflow-hidden">
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
                  {total} swipes → <span className="max-[339px]:hidden">ranked </span>for you{done > 0 && <span className="text-neutral-400"> · {done}/{total}</span>}
                </span>
                <Link href="/" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-xs font-bold text-black">
                  Start <ArrowRight className="h-3.5 w-3.5" />
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
          {/* Chips fade out at the edge instead of being cut mid-word. */}
          {/* Phones: one scrolling row that fades out at the edge. Desktop:
              the chips wrap, so none is ever cut. */}
          <div
            className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pl-4 pr-6 [mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)] lg:flex-wrap lg:overflow-visible lg:pr-0 lg:[mask-image:none]"
            role="group"
            aria-label="Category"
          >
            <Chip active={category === null} onClick={() => setFilter({ category: null })}>
              All
            </Chip>
            {SHIRT_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setFilter({ category: category === c ? null : c })}>
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
          <TeeViewToggle value={teeView} onChange={(v) => setFilter({ teeView: v })} />
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Sort: ${SORT_LABELS[sort]}`}
            className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ${
              chosenSort ? "bg-white text-black ring-white" : "bg-white/[0.04] text-neutral-200 ring-white/10 hover:bg-white/10"
            }`}
          >
            <ArrowUpDown className="h-4 w-4" /> <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
          </button>
        </div>
        <SortSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sort={sort} canMatch={complete} onSort={(v) => setFilter({ sort: v })} />
        <div className="h-2" />
        <SharedList />
        <Trending />

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
                    color={teeView === "original" ? undefined : teeView}
                    topPick={complete && sort === "match" && i === 0}
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
