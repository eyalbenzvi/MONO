/**
 * The search index in the browser: fetched on first need (the shop warms it
 * while idle), once, and only used when it matches the catalog it was built
 * from — a stale file turns search off instead of pointing at wrong designs.
 *
 * Its name changes with every catalogue: the browser reads it from the page's
 * <meta name="mono-search"> (app/layout), never from a script, so a catalogue
 * change renames no script (lib/catalogIndex says why).
 */
import { SHIRTS, assetUrl, catalogReady } from "@/lib/catalog";
import { decodeIndex, type SearchIndex, type SearchIndexFile } from "./format";

/** The published search index, as /data/search.<hash>.json (no base path). */
export function searchUrl(): string | null {
  if (typeof window === "undefined") return `/data/${(require("@/data/search.manifest.json") as { file: string }).file}`;
  return document.querySelector<HTMLMetaElement>('meta[name="mono-search"]')?.content || null;
}

let loading: Promise<SearchIndex | null> | null = null;

export function loadSearchIndex(): Promise<SearchIndex | null> {
  const url = searchUrl();
  loading ??= Promise.all([url ? fetch(assetUrl(url)).then((r) => (r.ok ? (r.json() as Promise<SearchIndexFile>) : null)) : null, catalogReady()])
    .then(([file]) => (file ? decodeIndex(file, SHIRTS.map((s) => s.id)) : null))
    .catch(() => null);
  return loading;
}
