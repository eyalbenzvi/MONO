/**
 * The search index in the browser: fetched on first need (the shop warms it
 * while idle), once, and only used when it matches the catalog it was built
 * from — a stale file turns search off instead of pointing at wrong designs.
 */
import manifest from "@/data/search.manifest.json";
import { SHIRTS, assetUrl, catalogReady } from "@/lib/catalog";
import { decodeIndex, type SearchIndex, type SearchIndexFile } from "./format";

export const SEARCH_URL = `/data/${manifest.file}`;

let loading: Promise<SearchIndex | null> | null = null;

export function loadSearchIndex(): Promise<SearchIndex | null> {
  loading ??= Promise.all([fetch(assetUrl(SEARCH_URL)).then((r) => (r.ok ? (r.json() as Promise<SearchIndexFile>) : null)), catalogReady()])
    .then(([file]) => (file ? decodeIndex(file, SHIRTS.map((s) => s.id)) : null))
    .catch(() => null);
  return loading;
}
