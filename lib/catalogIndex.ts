import type serverIndex from "@/data/shirts.index.json";
import type { ShirtProduct } from "@/types/shirt";

/** The index as published: the generator's file, plus the designs kept for Make alone (scripts/tools/publishIndex). */
export type CatalogIndex = typeof serverIndex & { makeBases?: ShirtProduct[] };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * The catalog index (I03). In the browser it isn't part of the JavaScript:
 * it's a static JSON file named by its content hash (preloaded from the
 * page's <head>, cached forever), fetched once; lib/catalog fills in when it
 * arrives and hydration waits for it (AppShell's <CatalogGate>). The server
 * side of the build reads it from data/ synchronously (Next removes that
 * branch from the browser bundle). Node scripts and tests use
 * lib/catalogIndex.node.ts (tsconfig.scripts.json, vitest.config).
 *
 * Nothing that changes with the catalogue is compiled into the scripts: the
 * browser reads the index's name from the page's own <link data-catalog-index>
 * (app/layout), and the designs kept for Make come inside the index. A
 * catalogue change then renames no script, and a visitor's device keeps every
 * one it has (public/sw.js); scripts/tools/postbuild checks it.
 */
export function indexUrl(): string {
  if (typeof window === "undefined") return `${BASE}/data/${(require("@/data/shirts.index.manifest.json") as { file: string }).file}`;
  const link = document.querySelector<HTMLLinkElement>("link[data-catalog-index]");
  if (!link) throw new Error("catalog index: no <link data-catalog-index> in the page");
  return link.href;
}

export function loadIndex(): CatalogIndex | Promise<CatalogIndex> {
  if (typeof window === "undefined") return { ...(require("@/data/shirts.index.json") as CatalogIndex), makeBases: require("@/data/make/bases.json") as ShirtProduct[] };
  return Promise.resolve()
    .then(() => fetch(indexUrl()))
    .then((r) => {
      if (!r.ok) throw new Error(`catalog index: ${r.status}`);
      return r.json() as Promise<CatalogIndex>;
    });
}
