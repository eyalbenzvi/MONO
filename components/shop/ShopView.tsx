"use client";

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { CategoryFilter, TeeSwatches } from "@/components/shop/ShopFilters";
import { ProductCard } from "@/components/shop/ProductCard";
import { SharedList } from "@/components/shop/ShopExtras";
import { SHIRTS, dedupeByFamily, filterShop, filtersFromQuery, getShirtById, type ShopFilters } from "@/lib/catalog";
import { decodeFacets, encodeFacets, type Facet } from "@/lib/search/facetCodec";
import { useShopSearch } from "@/components/shop/useShopSearch";
import { shopList } from "@/components/shop/shopList";
import { rankShirts, type ShopSort, daySeed } from "@/lib/recommendation";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { SHOP_PAGE_SIZE, makeHeaderScrollHandler, useUiStore, useHydrated, shopScroll } from "@/store/useUiStore";
import { COLORS, SHIRT_CATEGORIES, type BaseColor, type ShirtCategory, type ShirtProduct } from "@/types/shirt";
import { itemOf, track, trackEcommerce } from "@/lib/analytics";
import { preloadMockups, saveData, whenIdle } from "@/lib/preload";

type Filters = ShopFilters;

// The open search box (field, suggestions, prepared parameters) loads only when opened.
const SearchPanel = dynamic(() => import("@/components/shop/SearchPanel"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-10 flex-1 rounded-full bg-white/[0.06] ring-1 ring-white/10" />,
});

/** The search in the address: /shop/?q=words&f=kind:value,…&like=<id>. */
function searchFromUrl(): { query: string; facets: Facet[] } {
  const q = new URLSearchParams(window.location.search);
  const facets = decodeFacets(q.get("f"));
  const like = q.get("like");
  if (like && getShirtById(like)) facets.push({ kind: "like", value: like });
  return { query: q.get("q") ?? "", facets };
}
/** The address follows the search: replaced while typing, pushed when a facet changes or Enter is pressed (Back undoes it). */
function searchToUrl(query: string, facets: readonly Facet[], push: boolean) {
  const q = new URLSearchParams(window.location.search);
  const f = encodeFacets(facets);
  const like = facets.find((x) => x.kind === "like")?.value;
  for (const [k, v] of [["q", query], ["f", f], ["like", like]] as const) (v ? q.set(k, v) : q.delete(k));
  const next = window.location.pathname + (q.toString() ? `?${q}` : "");
  if (next === window.location.pathname + window.location.search) return;
  if (push) window.history.pushState(window.history.state, "", next);
  else window.history.replaceState(window.history.state, "", next);
}


export function ShopView() {
  const hydrated = useHydrated();
  const vector = useTasteStore((s) => s.preferenceVector);
  const { done, total, complete } = useCalibrationProgress();
  // One primitive per selector: the grid re-renders only when these change.
  const tee = useUiStore((s) => s.shop.tee);
  const cats = useUiStore((s) => s.shop.cats);
  const limit = useUiStore((s) => s.shop.limit);
  const query = useUiStore((s) => s.shop.query);
  const facets = useUiStore((s) => s.shop.facets);
  // The grid follows the typing without holding up the field.
  const deferredQuery = useDeferredValue(query);
  const searching = query.trim() !== "" || facets.length > 0;
  const { runtime, warm: warmSearch } = useShopSearch(searching);
  const [open, setOpen] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [literal, setLiteral] = useState(false);
  // The order is not a choice: "For you" once the taste is known (it can be
  // lost again by unsaving), before that "Our pick" (the generator's fixed
  // editorial order — not usage data).
  const sort: ShopSort = complete ? "match" : "popular";
  const setShop = useUiStore((s) => s.setShop);
  const setProductOrigin = useUiStore((s) => s.setProductOrigin);
  const openFromGrid = useCallback(
    (id: string) => {
      setProductOrigin({ from: "/shop/", id });
      const index = visibleRef.current.findIndex((x) => x.shirt.id === id);
      const shirt = visibleRef.current[index]?.shirt;
      if (shirt) trackEcommerce("select_item", { item_list_id: listIdRef.current, items: [itemOf(shirt, { index, color: useUiStore.getState().shop.tee ?? undefined })] });
    },
    [setProductOrigin],
  );
  const visibleRef = useRef<{ shirt: ShirtProduct }[]>([]);
  const listIdRef = useRef("");


  // Rank with a snapshot of the taste vector taken on entry (and when the
  // order or a filter changes): a heart tap trains the vector, and re-ranking live
  // would reshuffle the grid under the user's finger.
  // The snapshot is taken during render, so the grid ranks once when the
  // stored taste arrives (not once with the neutral profile, then again).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rankVector = useMemo(() => useTasteStore.getState().preferenceVector, [hydrated, sort, tee, cats]);
  // Refreshed daily (rotation), with what Discover already showed stepping back.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => new Set(useTasteStore.getState().seen), [hydrated, sort, tee, cats]);
  // (Only once hydrated: the pre-rendered page has no browser to seed from, and must match.)
  const ranked = useMemo(() => rankShirts(rankVector, SHIRTS, sort, hydrated ? { rotate: daySeed(), demote: shown } : {}), [rankVector, sort, shown, hydrated]);
  // One design per family (the best-ranked one) — its siblings are offered as
  // variations on the product page. The top of the grid is diversified
  // (display only; scores are untouched): no three in a row of one
  // category or tee colour (not colour once one is chosen: every card is on
  // it), no algorithm repeats, and a wildcard every 8th card when ranking for you.
  // Search (lib/search): the colour and categories chosen narrow it too. "Top matches" is worked out here, never sent.
  const result = useMemo(() => {
    if (!searching || !runtime) return null;
    const narrow: Facet[] = [...cats.map((value) => ({ kind: "category", value }) as Facet), ...(tee ? [{ kind: "tee", value: tee } as Facet] : [])];
    return runtime.mod.search(runtime.index, SHIRTS, {
      query: deferredQuery,
      facets: [...facets, ...narrow],
      vector: rankVector,
      tasteKnown: complete,
      seen: shown,
      matches: facets.some((f) => f.kind === "match") ? runtime.mod.topMatches(rankVector) : undefined,
      order: ranked,
      literal,
    });
  }, [searching, runtime, deferredQuery, facets, cats, tee, rankVector, complete, shown, ranked, literal]);
  // A content wave's designs only (/shop/?wave=<n>, docs/content/waves.md): read after hydration, never linked.
  const [wave, setWave] = useState<number | null>(null);
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("wave");
    if (w && /^\d+$/.test(w)) setWave(Number(w));
  }, []);
  const visible = useMemo(() => shopList({ ranked, tee, cats, sort, result, wave }), [result, ranked, tee, cats, sort, wave]);
  // First open: the current grid stays, dimmed, until the index is in (never an empty flash).
  const pending = searching && runtime === undefined;
  // How many designs each category holds on the chosen colour — within the search while one is on (the filter's rows; an empty one is disabled).
  const counts = useMemo(() => {
    const within =
      result && runtime
        ? runtime.mod.search(runtime.index, SHIRTS, { query: deferredQuery, facets: [...facets, ...(tee ? [{ kind: "tee", value: tee } as Facet] : [])], vector: rankVector, tasteKnown: complete, seen: shown, order: ranked, literal })
        : null;
    const on = within ? (within.mode === "text" ? within.results : dedupeByFamily(within.results)) : dedupeByFamily(filterShop(ranked, { tee, cats: [] }));
    const by = Object.fromEntries(SHIRT_CATEGORIES.map((c) => [c, 0])) as Record<ShirtCategory, number>;
    for (const { shirt } of on) by[shirt.category]++;
    return { by, total: on.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, tee, result]);
  visibleRef.current = visible;

  // The first cards a filter would show (the current one with each change):
  // warmed while idle, and at once when a finger lands on it, so a switch
  // shows whole tees.
  const firstFor = useCallback(
    (f: Filters) => {
      const n = typeof window !== "undefined" && window.innerWidth >= 1024 ? 10 : 6;
      return dedupeByFamily(filterShop(ranked, f)).slice(0, n).map((x) => x.shirt);
    },
    [ranked],
  );
  const warm = (f: Filters) => hydrated && preloadMockups(firstFor(f), "high", f.tee);
  useEffect(() => {
    if (!hydrated || saveData()) return;
    return whenIdle(() => {
      for (const c of COLORS) preloadMockups(firstFor({ tee: c, cats }), "low", c);
    });
  }, [firstFor, hydrated, tee, cats]);
  // Opening the filter: each category's first cards, while idle.
  const warmCategories = () => !saveData() && whenIdle(() => SHIRT_CATEGORIES.forEach((c) => preloadMockups(firstFor({ tee, cats: [c] }), "low", tee)));
  const listId = `shop_${sort}${tee ? `_${tee}` : ""}${cats.length ? `_${cats.join("+")}` : ""}`;
  listIdRef.current = listId;

  // shop_view once per visit, with the order actually shown; the list
  // itself (first page) each time the order or a filter changes.
  const viewed = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!viewed.current) track("shop_view", { tee, cats: cats.join("."), sort });
    viewed.current = true;
    trackEcommerce("view_item_list", {
      item_list_id: listId,
      items: visible.slice(0, SHOP_PAGE_SIZE).map(({ shirt }, index) => itemOf(shirt, { index, color: tee ?? undefined })),
    });
    // The list is keyed by what the shopper chose, not by every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sort, tee, cats]);

  // Opened at /shop/?c=…&cat=… (a shared or restored link): those filters, once.
  useEffect(() => {
    if (!hydrated) return;
    const q = new URLSearchParams(window.location.search);
    if (q.has("c") || q.has("cat") || q.has("m")) setShop(filtersFromQuery(q));
  }, [hydrated, setShop]);
  // …and the address follows the filters (replaced, not pushed: back leaves the shop).
  useEffect(() => {
    if (!hydrated) return;
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of [["c", tee], ["cat", cats.join(".")]] as const) (v ? q.set(k, v) : q.delete(k));
    q.delete("m");
    const next = window.location.pathname + (q.toString() ? `?${q}` : "");
    if (next !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", next);
  }, [hydrated, tee, cats]);

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

  // Search state: every change starts the grid from the top.
  const toTop = () => {
    shopScroll.top = 0;
    scroller.current?.scrollTo({ top: 0 });
  };
  const setQuery = (q: string) => {
    setLiteral(false);
    setShop({ query: q, limit: SHOP_PAGE_SIZE });
    toTop();
  };
  const setFacets = (next: Facet[]) => {
    setShop({ facets: next, limit: SHOP_PAGE_SIZE });
    searchToUrl(useUiStore.getState().shop.query, next, true);
    toTop();
  };
  const closeSearch = () => {
    setOpen(false);
    if (query) setQuery("");
  };

  // "search" once per settled search (Enter, a chip, or 1.5 s without typing), never twice for the same one.
  const committed = useRef("");
  const commitRef = useRef(() => {});
  commitRef.current = () => {
    if (!result || !searching) return;
    const key = `${query.trim()}|${encodeFacets(facets)}|${facets.find((f) => f.kind === "like")?.value ?? ""}`;
    if (key === committed.current) return;
    committed.current = key;
    track("search", {
      q: query.trim().slice(0, 64),
      terms: query.trim().split(/\s+/).filter(Boolean).length,
      results: visible.length,
      zero: !!result.relaxed,
      corrected: result.corrected.length > 0 && !literal,
      facets: facets.map((f) => f.kind),
    });
    trackEcommerce("view_item_list", { item_list_id: "shop_search", items: visible.slice(0, SHOP_PAGE_SIZE).map(({ shirt }, index) => itemOf(shirt, { index, color: tee ?? undefined })) });
  };
  useEffect(() => {
    if (!searching || !result) return;
    const t = setTimeout(() => commitRef.current(), 1500);
    return () => clearTimeout(t);
  }, [deferredQuery, facets, searching, result]);
  useEffect(() => {
    if (facets.length) commitRef.current();
  }, [facets]);

  // Opened at /shop/?q=…&f=…&like=… (a shared link, a reload, "More like this"): that search.
  useEffect(() => {
    if (!hydrated) return;
    const s = searchFromUrl();
    if (s.query || s.facets.length) {
      setShop({ query: s.query, facets: s.facets });
      setOpen(true);
    }
    // Back and forward bring the search they left back.
    const onPop = () => {
      const s = searchFromUrl();
      setShop({ query: s.query, facets: s.facets, limit: SHOP_PAGE_SIZE });
      setOpen(!!(s.query || s.facets.length));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hydrated, setShop]);
  useEffect(() => {
    if (hydrated) searchToUrl(query, useUiStore.getState().shop.facets, false);
  }, [hydrated, query]);

  // "/" opens the search (desktop), unless a dialog is open or you're typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || useUiStore.getState().dialogs > 0) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      warmSearch();
      setOpen(true);
      setFocusNonce((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [warmSearch]);

  const setFilter = (patch: Partial<Filters>) => {
    if ("tee" in patch) track("shop_filter", { filter: "tee", value: patch.tee ?? null });
    if (patch.cats) track("shop_filter", { filter: "category", value: patch.cats.join(".") || "all" });
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
        {/* No text above the grid: the filter row comes first. */}
        <div className="h-3" />

        {/* One sticky row: the tee colour (the product page's dots), and the
            categories behind a filter icon. No sort — the order is "For you"
            once the taste is known, else "Our pick". */}
        {/* Solid, above every card control (cards isolate their own z-index),
            right under the header while it shows and at the very top once it
            has slid away — moving with it (same 200 ms). */}
        <div
          className={`app-backdrop sticky z-20 -mx-4 flex items-center justify-between gap-2 border-b py-2 pl-4 pr-4 transition-[top,border-color] duration-200 ease-out ${
            stuck ? "border-white/10" : "border-transparent"
          }`}
          style={{ top: headerHidden ? 0 : "var(--header-h)" }}
        >
          {(() => {
            const filter = (
              <CategoryFilter
                cats={cats}
                counts={counts.by}
                total={counts.total}
                results={visible.length}
                onChange={(next) => setFilter({ cats: next })}
                onWarm={(next) => warm({ tee, cats: next })}
                onOpen={warmCategories}
              />
            );
            const dots = <TeeSwatches tee={tee} onChange={(t) => setFilter({ tee: t })} onWarm={(c) => warm({ tee: c, cats })} />;
            // Open (or a search in effect): the field takes the middle of the row; the dots and the filter icon stay.
            if ((open || searching) && runtime !== null)
              return (
                <SearchPanel
                  runtime={runtime}
                  query={query}
                  facets={facets}
                  result={result}
                  count={visible.length}
                  literal={literal}
                  tasteKnown={complete}
                  focusNonce={focusNonce}
                  leading={dots}
                  trailing={filter}
                  onQuery={setQuery}
                  onFacets={setFacets}
                  onLiteral={() => setLiteral(true)}
                  onCommit={() => {
                    searchToUrl(query, facets, true);
                    commitRef.current();
                  }}
                  onClose={closeSearch}
                  onClear={() => {
                    // The search only: the colour and categories chosen stay.
                    setShop({ query: "", facets: [], limit: SHOP_PAGE_SIZE });
                    searchToUrl("", [], true);
                    toTop();
                  }}
                />
              );
            const openSearch = () => {
              setOpen(true);
              setFocusNonce((n) => n + 1);
            };
            return (
              <>
                {dots}
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  {runtime !== null && (
                    <>
                      {/* Desktop: a quiet field-shaped trigger that names "/"; phones: a ringed icon (not a twin of the filter icon). */}
                      <button
                        type="button"
                        onPointerDown={warmSearch}
                        onFocus={warmSearch}
                        onClick={openSearch}
                        aria-label="Search"
                        className="hidden h-10 w-full max-w-xs items-center gap-2 rounded-full pl-3 pr-4 text-sm text-neutral-500 ring-1 ring-white/10 transition-colors duration-200 hover:text-neutral-300 hover:ring-white/20 sm:flex"
                      >
                        <Icon name="search" className="h-4 w-4" />
                        <span className="flex-1 text-left">Search</span>
                        <kbd className="font-sans text-[11px] uppercase tracking-[0.2em] text-neutral-600">/</kbd>
                      </button>
                      <button
                        type="button"
                        onPointerDown={warmSearch}
                        onFocus={warmSearch}
                        onClick={openSearch}
                        aria-label="Search"
                        className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
                      >
                        <Icon name="search" className="h-[18px] w-[18px]" />
                      </button>
                    </>
                  )}
                  {filter}
                </div>
              </>
            );
          })()}
        </div>
        <div className="h-2" />
        <SharedList />

        {/* Rendered on the server too, in the default order ("Our pick" — no
            personal data needed), so the page arrives with products. A
            personal order after hydration swaps in with a short fade (same
            card sizes, nothing moves). */}
        {visible.length > 0 ? (
            <>
              <div key={sort} aria-busy={pending || undefined} className={`grid animate-[fade-in_0.25s_ease-out] transition-opacity duration-200 ${pending ? "opacity-40" : ""} grid-cols-1 gap-x-3 gap-y-6 min-[340px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6`}>
                {visible.slice(0, limit).map(({ shirt, variations }, i) => (
                  <ProductCard
                    key={shirt.id}
                    shirt={shirt}
                    variations={variations}
                    color={tee ?? undefined}
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
              Nothing here.
              <button type="button" onClick={() => setFilter({ tee: null, cats: [] })} className="ml-1 font-semibold text-white underline">
                Clear
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
