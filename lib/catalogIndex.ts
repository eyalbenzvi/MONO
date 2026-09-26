import manifest from "@/data/shirts.index.manifest.json";
import type serverIndex from "@/data/shirts.index.json";

export type CatalogIndex = typeof serverIndex;

/**
 * The catalog index (I03). In the browser it isn't part of the JavaScript:
 * it's a static JSON file named by its content hash (preloaded from the
 * page's <head>, cached forever), fetched once; lib/catalog fills in when it
 * arrives and hydration waits for it (AppShell's <CatalogGate>). The server
 * side of the build reads it from data/ synchronously (Next removes that
 * branch from the browser bundle). Node scripts and tests use
 * lib/catalogIndex.node.ts (tsconfig.scripts.json, vitest.config).
 */
export const INDEX_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/${manifest.file}`;

export function loadIndex(): CatalogIndex | Promise<CatalogIndex> {
  if (typeof window === "undefined") return require("@/data/shirts.index.json") as CatalogIndex;
  return fetch(INDEX_URL).then((r) => {
    if (!r.ok) throw new Error(`catalog index: ${r.status}`);
    return r.json() as Promise<CatalogIndex>;
  });
}
