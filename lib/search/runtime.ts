/**
 * Everything search needs in the browser, in one chunk the shop loads on
 * demand (dynamic import): a visitor who never searches downloads none of it.
 */
import { SHIRTS } from "@/lib/catalog";
import { topFraction } from "@/lib/match";
import { makeScorer } from "@/lib/recommendation";
import type { ShirtProduct, UserProfileVector } from "@/types/shirt";
import { search } from "./engine";
import type { SearchIndex } from "./format";
import { labelCase } from "./labels";
import { LEXICON } from "./lexicon";

export { loadSearchIndex } from "./load";
export { search } from "./engine";
export { facetLabel } from "./parse";
export { KIND_LABELS } from "./facets";
export { readRecent, pushRecent, removeRecent } from "./recent";

/** A SUBJECT chip needs at least this many designs behind it. */
export const SUBJECT_MIN = 12;
const subjects = new WeakMap<SearchIndex, { label: string; query: string; count: number }[]>();

/** Lexicon subjects that find enough designs in this catalog, as chips (they search as text). */
export function subjectChips(index: SearchIndex, catalog: readonly ShirtProduct[] = SHIRTS) {
  let list = subjects.get(index);
  if (!list) {
    const seen = new Set<string>();
    list = [];
    for (const e of LEXICON) {
      if (!e.expand || e.facet) continue;
      const phrase = e.phrases[0];
      const r = search(index, catalog, { query: `${phrase} `, facets: [] });
      // A chip only for a subject the words really find: not a relaxed fallback, not most of the catalogue.
      const count = !r.relaxed && r.mode === "text" && r.total <= 0.4 * catalog.length ? r.total : 0;
      if (count >= SUBJECT_MIN && !seen.has(phrase)) {
        seen.add(phrase);
        list.push({ label: labelCase(phrase), query: phrase, count });
      }
    }
    subjects.set(index, list);
  }
  return list;
}

/** The viewer's top matches ("Top matches"): the best 8% of the catalog for their taste, computed here, never sent. */
export function topMatches(vector: UserProfileVector, catalog: readonly ShirtProduct[] = SHIRTS): Set<string> {
  const score = makeScorer(vector);
  return new Set(catalog.filter((s) => topFraction(vector, score(s.features).score) < 0.08).map((s) => s.id));
}
