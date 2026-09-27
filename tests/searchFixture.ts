import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { SHIRTS } from "@/lib/catalog";
import { buildSearchIndex, type SearchEntry, type VisualMetrics } from "@/lib/search/build";
import { decodeIndex, type SearchIndex, type SearchIndexFile } from "@/lib/search/format";

/** The real catalog, as the index builder reads it. */
export const CATALOG = JSON.parse(readFileSync("data/shirts.json", "utf8")) as (SearchEntry & { baseColor: string; backPrintUrl: string })[];

/** The visual measures from the committed cache (keyed as scripts/tools/searchIndex.ts keys them). */
function visual(): Record<string, VisualMetrics> {
  const cache = JSON.parse(readFileSync("data/search/visual.json", "utf8")) as { entries: Record<string, VisualMetrics> };
  const out: Record<string, VisualMetrics> = {};
  for (const e of CATALOG) {
    const file = path.join("public", e.backPrintUrl);
    if (!existsSync(file)) continue;
    const key = `${createHash("sha1").update(readFileSync(file)).digest("hex")}:${e.medium}:${e.baseColor}`;
    if (cache.entries[key]) out[e.id] = cache.entries[key];
  }
  return out;
}

let built: { file: SearchIndexFile; index: SearchIndex; warnings: string[] } | null = null;
/** The index built in memory from the real catalog (once per test file). */
export function realIndex() {
  if (!built) {
    const { file, warnings } = buildSearchIndex(CATALOG, visual());
    built = { file, index: decodeIndex(file, SHIRTS.map((s) => s.id))!, warnings };
  }
  return built;
}
