/**
 * The priors an upload's features start from (lib/upload/features.ts),
 * written to data/upload/priors.json: each shop category's mean feature
 * vector over the catalogue, and the catalogue's spread of ink coverage
 * (5th and 95th percentiles of the prints' measured coverage, from the
 * search index's visual cache) that an upload's density is scaled to.
 * Run after the catalogue changes (a test says when it's stale):
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/tools/uploadPriors.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FEATURE_KEYS, SHIRT_CATEGORIES, type FeatureVector, type ShirtCategory } from "../../types/shirt";

const ROOT = path.resolve(__dirname, "..", "..");
export const PRIORS_FILE = path.join(ROOT, "data", "upload", "priors.json");

export interface Priors {
  categories: Record<ShirtCategory, FeatureVector>;
  coverage: { p5: number; p95: number };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function buildPriors(catalog: { category: ShirtCategory; features: FeatureVector }[], coverages: number[]): Priors {
  const categories = {} as Record<ShirtCategory, FeatureVector>;
  for (const c of SHIRT_CATEGORIES) {
    const list = catalog.filter((s) => s.category === c);
    categories[c] = Object.fromEntries(FEATURE_KEYS.map((k) => [k, r3(list.reduce((a, s) => a + (s.features[k] ?? 0), 0) / Math.max(1, list.length))])) as FeatureVector;
  }
  const sorted = [...coverages].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
  return { categories, coverage: { p5: r3(at(0.05)), p95: r3(at(0.95)) } };
}

/** The priors from the committed catalogue and visual cache. */
export function currentPriors(): Priors {
  const catalog = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.json"), "utf8"));
  const visual: { entries: Record<string, { coverage: number }> } = JSON.parse(readFileSync(path.join(ROOT, "data", "search", "visual.json"), "utf8"));
  return buildPriors(catalog, Object.values(visual.entries).map((e) => e.coverage));
}

if (require.main === module) {
  mkdirSync(path.dirname(PRIORS_FILE), { recursive: true });
  writeFileSync(PRIORS_FILE, JSON.stringify(currentPriors(), null, 1) + "\n");
  console.log(`wrote ${path.relative(ROOT, PRIORS_FILE)}`);
}
