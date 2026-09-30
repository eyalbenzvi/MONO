"use client";

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CategoryFilter, ROW_CONTROL, TeeSwatches } from "@/components/shop/ShopFilters";
import { Sheet } from "@/components/Sheet";
import { useDock } from "@/hooks/useDock";
import { ProductCard } from "@/components/shop/ProductCard";
import { SharedList } from "@/components/shop/ShopExtras";
import { acceptedDesigns } from "@/lib/upload/designs";
import { SHIRTS, dedupeByFamily, filterShop, filtersFromQuery, getShirtById, type ShopFilters } from "@/lib/catalog";
import { decodeFacets, encodeFacets, type Facet } from "@/lib/search/facetCodec";
import { useShopSearch } from "@/components/shop/useShopSearch";
import { shopList } from "@/components/shop/shopList";
import { rankShirts, type ShopSort, daySeed } from "@/lib/recommendation";
import { topPicks } from "@/lib/match";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { SHOP_PAGE_SIZE, makeHeaderScrollHandler, useUiStore, useHydrated, shopScroll } from "@/store/useUiStore";
import { COLORS, SHIRT_CATEGORIES, type ShirtCategory, type ShirtProduct } from "@/types/shirt";
import { itemOf, track, trackEcommerce } from "@/lib/analytics";
import { preloadMockups, saveData, whenIdle } from "@/lib/preload";
import { BUTTON_SECONDARY } from "@/components/ui";

type Filters = ShopFilters;

// The open search box (field, suggestions, prepared parameters) loads only when opened.
/** The first cards of a filter warmed ahead: about the first screen (a desktop row holds more). */
const WARM_CARDS = { desktop: 10, phone: 6 };
/** A restored `?page=` is held to this many pages (a hand-typed 10000 can't render the whole shop at once). */
const MAX_RESTORED_PAGES = 200;
/** The next page loads when the end of the grid is this close (px). */
const LOAD_AHEAD_PX = 1600;

const SearchPanel = dynamic(() => import("@/components/shop/SearchPanel"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-12 rounded-control ring-1 ring-inset ring-white/25" />,
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
  const { complete } = useCalibrationProgress();
  // One primitive per selector: the grid re-renders only when these change.
  const tee = useUiStore((s) => s.shop.tee);
  const cats = useUiStore((s) => s.shop.cats);
  const limit = useUiStore((s) => s.shop.limit);
  const query = useUiStore((s) => s.shop.query);
  const facets = useUiStore((s) => s.shop.facets);
  // The grid follows the typing without holding up the field.
  const deferredQuery = useDeferredValue(query);
  // Only letters or figures search (a query of emoji or punctuation alone is no search, not "1,370 tees").
  const searching = /[\p{L}\p{N}]/u.test(query) || facets.length > 0;
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
  // Designs the Open Call accepted on this device join the grid, ranked by taste like any other (no boost; never in Discover).
  const pool = useMemo(() => (hydrated ? [...SHIRTS, ...acceptedDesigns().flatMap((d) => getShirtById(d.id) ?? [])] : SHIRTS), [hydrated]);
  const ranked = useMemo(() => rankShirts(rankVector, pool, sort, hydrated ? { rotate: daySeed(), demote: shown } : {}), [rankVector, pool, sort, shown, hydrated]);
  // One design per family (the best-ranked one) — its siblings are offered as
  // variations on the product page. The top of the grid is diversified
  // (display only; scores are untouched): no three in a row of one
  // category or tee colour (not colour once one is chosen: every card is on
  // it), no algorithm repeats, and a wildcard every 8th card when ranking for you.
  // Search (lib/search): the colour and categories chosen narrow it too. "Top matches" is worked out here, never sent.
  // The search on the chosen colour, before the categories narrow it: the filter's counts come from it, and
  // with no category chosen it is the result itself (one search per query, not two).
  const searchWith = useCallback(
    (narrowCats: readonly ShirtCategory[]) => {
      if (!runtime) return null;
      const narrow: Facet[] = [...narrowCats.map((value) => ({ kind: "category", value }) as Facet), ...(tee ? [{ kind: "tee", value: tee } as Facet] : [])];
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
    },
    [runtime, deferredQuery, facets, tee, rankVector, complete, shown, ranked, literal],
  );
  const withinColour = useMemo(() => (searching ? searchWith([]) : null), [searching, searchWith]);
  const result = useMemo(() => (!searching ? null : cats.length ? searchWith(cats) : withinColour), [searching, cats, searchWith, withinColour]);
  // A content wave's designs only (/shop/?wave=<n>, docs/content/waves.md): read after hydration, never linked.
  const [wave, setWave] = useState<number | null>(null);
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("wave");
    if (w && /^\d+$/.test(w)) setWave(Number(w));
  }, []);
  const visible = useMemo(() => {
    const list = shopList({ ranked, tee, cats, sort, result, wave });
    // Your edit opens on the reveal's first pick (the same tee, where the taste test left off).
    if (sort !== "match" || result || cats.length || wave !== null) return list;
    const first = topPicks(rankVector, 1)[0];
    const at = first ? list.findIndex((x) => x.shirt.family === first.family) : -1;
    return at < 0 ? list : [{ ...list[at], shirt: first }, ...list.slice(0, at), ...list.slice(at + 1)];
  }, [result, ranked, tee, cats, sort, wave, rankVector]);
  // First open: the current grid stays, dimmed, until the index is in (never an empty flash).
  const pending = searching && runtime === undefined;
  // How many designs each category holds on the chosen colour — within the search while one is on (the filter's rows; an empty one is disabled).
  // A card's variations count too, so "All" is the catalogue's own number (the About page's, the meta's).
  const counts = useMemo(() => {
    const within = withinColour;
    const on = within ? (within.mode === "text" ? within.results : dedupeByFamily(within.results)) : dedupeByFamily(filterShop(ranked, { tee, cats: [] }));
    const by = Object.fromEntries(SHIRT_CATEGORIES.map((c) => [c, 0])) as Record<ShirtCategory, number>;
    let total = 0;
    for (const item of on) {
      const n = 1 + ("variations" in item ? (item.variations as number) : 0);
      by[item.shirt.category] += n;
      total += n;
    }
    return { by, total };
  }, [ranked, tee, withinColour]);
  visibleRef.current = visible;
  // The grid's own count, in the counts' unit (a card's variations are tees too): "Show 1,377 tees" matches "All 1,377".
  const shownCount = useMemo(() => visible.reduce((n, x) => n + 1 + ("variations" in x ? (x.variations as number) : 0), 0), [visible]);

  // The first cards a filter would show (the current one with each change):
  // warmed while idle, and at once when a finger lands on it, so a switch
  // shows whole tees.
  const firstFor = useCallback(
    (f: Filters) => {
      const n = typeof window !== "undefined" && window.innerWidth >= 1024 ? WARM_CARDS.desktop : WARM_CARDS.phone;
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
    if (Number.isInteger(page) && page > 1) setShop({ limit: Math.min(page, MAX_RESTORED_PAGES) * SHOP_PAGE_SIZE });
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
      // Rooted at the grid's own scroller: rooted at the viewport, the scroller clips it and the margin never looks ahead.
      { root: scroller.current, rootMargin: `${LOAD_AHEAD_PX}px 0px` },
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
    // While the sheet is open its #search step becomes the search's address (never a step on top of it).
    searchToUrl(useUiStore.getState().shop.query, next, !open);
    toTop();
  };
  const openSearch = () => {
    warmSearch();
    setOpen(true);
    setFocusNonce((n) => n + 1);
  };
  const clearSearch = () => {
    // The search only: the colour and categories chosen stay.
    setShop({ query: "", facets: [], limit: SHOP_PAGE_SIZE });
    searchToUrl("", [], true);
    toTop();
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
      // What was typed, only when it found something (a miss is more often a name or an address typed by mistake).
      ...(result.relaxed ? {} : { q: query.trim().slice(0, 64) }),
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
    if (s.query || s.facets.length) setShop({ query: s.query, facets: s.facets });
    // Back and forward bring the search they left back (the sheet itself follows its own #search step).
    const onPop = () => {
      const s = searchFromUrl();
      setShop({ query: s.query, facets: s.facets, limit: SHOP_PAGE_SIZE });
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
  const controls = useRef<HTMLDivElement>(null);
  useDock(controls);

  const setFilter = (patch: Partial<Filters>) => {
    if ("tee" in patch) track("shop_filter", { filter: "tee", value: patch.tee ?? null });
    if (patch.cats) track("shop_filter", { filter: "category", value: patch.cats.join(".") || "all" });
    shopScroll.top = 0;
    setShop({ ...patch, limit: SHOP_PAGE_SIZE });
    scroller.current?.scrollTo({ top: 0 });
  };

  const heading = hydrated && complete ? "Your edit" : "Our pick";
  const statusLine =
    searching && result && !open ? (
      result.relaxed ? (
        <>No exact match for &ldquo;{query.trim() || facets.map((f) => (runtime ? runtime.mod.facetLabel(runtime.index, f) : f.value)).join(", ")}&rdquo;. Closest:</>
      ) : result.corrected.length && !literal ? (
        <>
          Showing <span className="text-white">{result.corrected.map((c) => c.to).join(" ")}</span> ·{" "}
          <button type="button" onClick={() => setLiteral(true)} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-white">
            Search for &ldquo;{result.corrected.map((c) => c.from).join(" ")}&rdquo;
          </button>
        </>
      ) : null
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Reaches up under the floating header (a spacer keeps the content below it), so when the header slides away the grid fills the space. */}
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto">
        <div aria-hidden className="h-[var(--header-h)]" />
        <div className="mx-auto max-w-5xl px-2 pb-6 2xl:max-w-[1400px] min-[1800px]:max-w-[1600px]">
          {/* What the grid is, quietly: "Your edit" once the taste is known, else "Our pick". Nothing else above the grid. */}
          <h1 className="px-1 pb-3 pt-2 text-[13px] text-muted">{heading}</h1>
          {statusLine && <p className="px-1 pb-3 text-xs text-muted">{statusLine}</p>}
          <SharedList />

          {/* Rendered on the server too, in the default order ("Our pick" — no
              personal data needed), so the page arrives with products. */}
          {visible.length > 0 ? (
            <>
              <div key={sort} aria-busy={pending || undefined} className={`grid grid-cols-2 gap-x-2 gap-y-6 transition-opacity duration-150 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 ${pending ? "opacity-40" : ""}`}>
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
                    className={BUTTON_SECONDARY}
                  >
                    Show more
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p className="py-16 text-center text-sm text-muted">
              No tees match.{" "}
              <button type="button" onClick={() => setFilter({ tee: null, cats: [] })} className="inline-flex min-h-11 items-center text-white underline underline-offset-4">
                Clear filters
              </button>
            </p>
          )}
        </div>
      </div>

      {/* One row of controls at the bottom, within the thumb (above the tab bar): colour, search, filter. */}
      <div ref={controls} className="shrink-0 border-t border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-2 px-2 2xl:max-w-[1400px]">
          <TeeSwatches tee={tee} onChange={(t) => setFilter({ tee: t })} onWarm={(c) => warm({ tee: c, cats })} />
          <div className="flex min-w-0 items-center">
            {runtime !== null && (
              <button
                type="button"
                onPointerDown={warmSearch}
                onFocus={warmSearch}
                onClick={openSearch}
                aria-haspopup="dialog"
                aria-label={searching ? `Search: ${query.trim() || "filters"}` : "Search"}
                className={`${ROW_CONTROL} min-w-0 ${searching ? "text-white" : "text-muted hover:text-white"}`}
              >
                <span className="truncate">{searching && query.trim() ? `“${query.trim()}”` : "Search"}</span>
              </button>
            )}
            {searching && (
              <button type="button" onClick={clearSearch} aria-label="Clear search" className={`${ROW_CONTROL} text-muted hover:text-white`}>
                ×
              </button>
            )}
            <CategoryFilter
              cats={cats}
              counts={counts.by}
              total={counts.total}
              results={shownCount}
              onChange={(next) => setFilter({ cats: next })}
              onWarm={(next) => warm({ tee, cats: next })}
              onOpen={warmCategories}
            />
          </div>
        </div>
      </div>

      {/* Search: a sheet, the field at its foot next to the keyboard (Back closes it, #search). */}
      <Sheet open={open && runtime !== null} onClose={() => setOpen(false)} historyKey="search" title="Search">
        <SearchPanel
          runtime={runtime}
          query={query}
          facets={facets}
          result={result}
          count={shownCount}
          literal={literal}
          tasteKnown={complete}
          focusNonce={focusNonce}
          onQuery={setQuery}
          onFacets={(next) => {
            setFacets(next);
            // A facet chosen shows its tees.
            if (next.length > facets.length) setOpen(false);
          }}
          onLiteral={() => setLiteral(true)}
          onCommit={() => {
            searchToUrl(query, facets, false);
            commitRef.current();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          onClear={clearSearch}
        />
      </Sheet>
    </div>
  );
}
