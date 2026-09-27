/**
 * Facets: the parameters a search can be narrowed by. Values are stable ids
 * from the index tables (or the catalog), never names hard-coded here.
 */
import type { ShirtProduct } from "@/types/shirt";
import type { SearchIndex, TableEntry } from "./format";

import { FACET_KINDS, type Facet, type FacetKind } from "./facetCodec";

export { FACET_KINDS, decodeFacets, encodeFacets, sameFacet, type Facet, type FacetKind } from "./facetCodec";

/** Kinds kept in the index tables (the rest come from the catalog or the viewer). */
export const TABLE_KINDS = ["category", "medium", "style", "variant", "source", "era", "artist", "look"] as const;
type TableKind = (typeof TABLE_KINDS)[number];
const isTableKind = (k: FacetKind): k is TableKind => (TABLE_KINDS as readonly string[]).includes(k);

/** A kind's small grey name next to a suggestion ("Hokusai · artist"). */
export const KIND_LABELS: Record<FacetKind, string> = {
  category: "category",
  medium: "made",
  style: "style",
  variant: "pattern",
  source: "source",
  era: "era",
  artist: "artist",
  look: "look",
  tee: "tee",
  new: "new",
  seen: "for me",
  match: "for me",
  like: "like",
};

/* Era values: "c19" a century (the 1800s), "d1880" a decade ------------- */

export const eraLabel = (value: string) => (value.startsWith("c") ? `${(Number(value.slice(1)) - 1) * 100}s` : `${value.slice(1)}s`);
/** Whether a design's decade (year / 10) falls in an era value. */
function inEra(decade: number, value: string) {
  if (decade < 0) return false;
  const v = Number(value.slice(1));
  return value.startsWith("c") ? Math.floor(decade / 10) === v - 1 : decade === v / 10;
}

/** The viewer-side facts some facets need (computed locally, never sent). */
export interface FacetContext {
  index: SearchIndex;
  catalog: readonly ShirtProduct[];
  now?: number;
  seen?: ReadonlySet<string>;
  /** Designs in the viewer's top matches (only when the taste is known). */
  matches?: ReadonlySet<string>;
}

const WEEK = 7 * 86_400_000;

/** The table entry for a facet, if the index has one. */
export function tableEntry(index: SearchIndex, f: Facet): TableEntry | undefined {
  if (!isTableKind(f.kind)) return undefined;
  return index.file.tables[f.kind].find((e) => e.id === f.value);
}

/** A test for one facet over catalog positions. "like" isn't a filter (it orders: lib/search/like). */
export function facetTest(ctx: FacetContext, f: Facet): (pos: number) => boolean {
  const { index, catalog } = ctx;
  const { cols, tables } = index.file;
  const at = (kind: TableKind) => tables[kind].findIndex((e) => e.id === f.value);
  switch (f.kind) {
    case "category":
      return (p) => catalog[p].category === f.value;
    case "medium":
      return (p) => catalog[p].medium === f.value;
    case "variant":
      return (p) => catalog[p].variant === f.value;
    case "tee":
      return (p) => catalog[p].colors.includes(f.value as ShirtProduct["baseColor"]);
    case "new": {
      const now = ctx.now ?? Date.now();
      return (p) => now >= catalog[p].dropDate && now < catalog[p].dropDate + WEEK;
    }
    case "seen":
      return (p) => !(ctx.seen?.has(catalog[p].id) ?? false);
    case "match":
      return (p) => ctx.matches?.has(catalog[p].id) ?? false;
    case "style":
    case "source":
    case "artist": {
      const v = at(f.kind);
      const col = cols[f.kind];
      return (p) => v !== -1 && col[p] === v;
    }
    case "look": {
      const bit = at("look");
      return (p) => bit !== -1 && (cols.look[p] & (1 << bit)) !== 0;
    }
    case "era":
      return (p) => inEra(cols.era[p], f.value);
    case "like":
      return () => true;
  }
}

/** AND across kinds, OR within a kind. */
export function facetFilter(ctx: FacetContext, facets: readonly Facet[]): (pos: number) => boolean {
  const byKind = new Map<FacetKind, ((p: number) => boolean)[]>();
  for (const f of facets) {
    if (f.kind === "like") continue;
    byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), facetTest(ctx, f)]);
  }
  const groups = [...byKind.values()];
  return (p) => groups.every((g) => g.some((t) => t(p)));
}
