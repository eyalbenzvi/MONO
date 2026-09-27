import { dedupeByFamily, diversify, filterShop } from "@/lib/catalog";
import { SHOP_WINDOW, type RankedShirt, type ShopSort } from "@/lib/recommendation";
import type { SearchResult } from "@/lib/search/engine";
import type { BaseColor, ShirtCategory } from "@/types/shirt";

/**
 * The shop grid, in order. Without a search, exactly the shop as it always
 * was: one design per family, the shop window first in "Our pick", then
 * the diversified top. With words, the engine's order (relevance, one per
 * family, paced); with facets alone, the same shop order narrowed.
 */
export function shopList({ wave = null, ...args }: { ranked: RankedShirt[]; tee: BaseColor | null; cats: ShirtCategory[]; sort: ShopSort; result: SearchResult | null; wave?: number | null }) {
  const list = shopOrder(args);
  // ?wave=<n> (not linked anywhere): only the designs a content wave added, in the same order.
  return wave === null ? list : list.filter((h) => h.shirt.wave === wave);
}

function shopOrder({ ranked, tee, cats, sort, result }: { ranked: RankedShirt[]; tee: BaseColor | null; cats: ShirtCategory[]; sort: ShopSort; result: SearchResult | null }) {
  if (result?.mode === "text") return result.results;
  const filtered = dedupeByFamily(result ? result.results : filterShop(ranked, { tee, cats }));
  // "Our pick" opens on the shop window as the generator built it (its own rules: every category, one per subject) —
  // with a colour chosen, the window's designs on that colour.
  const kept = sort === "popular" && !cats.length && !result ? filtered.filter(({ shirt }) => shirt.rank < SHOP_WINDOW) : [];
  return [...kept, ...diversify(filtered.slice(kept.length), { category: cats.length !== 1, color: !tee, wildcardEvery: sort === "match" ? 8 : 0 })];
}
