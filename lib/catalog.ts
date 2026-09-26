import { loadIndex, type CatalogIndex } from "@/lib/catalogIndex";
import { FEATURE_KEYS, SKU_CODES, isPhoto, type BaseColor, type FeatureKey, type FeatureVector, type ShirtCategory, type ShirtProduct } from "@/types/shirt";

/** The index format this code reads (written by the generator's writeIndex). */
export const INDEX_VERSION = 3;
/** A stale or mismatched index would decode into nonsense: stop at once. */
export function checkIndexHead(head: { v: number; keys: readonly string[] }) {
  if (head.v !== INDEX_VERSION) throw new Error(`catalog index v${head.v}, expected v${INDEX_VERSION} — run npm run generate`);
  if (head.keys.join() !== FEATURE_KEYS.join()) throw new Error("catalog index feature keys don't match FEATURE_KEYS — run npm run generate");
}

const DAY = 86_400_000;

/**
 * The catalog: 3,400 shirts in 17 categories — 2,800 procedurally generated,
 * 600 screened photographs (see scripts/generateCatalog.ts — run
 * `npm run generate` to rebuild).
 *
 * The app reads the lean index (data/shirts.index.json): what the
 * recommender, cards and grid need. Descriptions and precomputed neighbours
 * live in public/data shards (lib/details); the full catalog
 * (data/shirts.json) is read at build time only (lib/catalogServer).
 *
 * In the browser the index is a hashed static JSON file fetched once
 * (lib/catalogIndex), so the collections below start empty and fill in
 * place when it arrives: `catalogReady()` resolves then, and AppShell's
 * <CatalogGate> holds hydration until it has. On the server (and in scripts
 * and tests) they're filled before anything else runs.
 */

const pad4 = (n: number) => String(n).padStart(4, "0");

/** Every design, in catalog order (filled in place when the index arrives). */
export const SHIRTS: ShirtProduct[] = [];
/** The taste test, precomputed by the generator (see calibrationIds there). */
export const CALIBRATION_IDS: string[] = [];
/** Its length (a live binding: 0 until the index arrives). */
export let CALIBRATION_TOTAL = 0;
/** Designs per detail shard (from the index head). */
export let SHARD_SIZE = 0;
/** Product pages that get a static page at /shop/<id>/ (see isPrerendered). */
export const PRERENDERED: ShirtProduct[] = [];
let shardHashes: string[] = [];

const BY_ID = new Map<string, ShirtProduct>();
const FAMILIES = new Map<string, ShirtProduct[]>();

function decodeAll(index: CatalogIndex): ShirtProduct[] {
  const digit = new Map([...index.digits].map((c, v) => [c, v]));
  const dropEpoch = Date.parse(`${index.dropEpoch}T00:00:00Z`);
  // Design n sits at position n − 1 of every column; `no` is a running count per category.
  const counts = new Map<number, number>();
  return index.title.map((title, i) => {
    const n = i + 1;
    const cat = index.categories[index.category[i]] as ShirtCategory;
    const white = index.white[i] === "1";
    const baseColor: BaseColor = white ? "white" : "black";
    const features = {} as FeatureVector;
    (index.keys as FeatureKey[]).forEach((k, j) => (features[k] = digit.get(index.features[j][i])! / 100));
    const no = (counts.get(index.category[i]) ?? 0) + 1;
    counts.set(index.category[i], no);
    return {
      id: `mono-${pad4(n)}`,
      n,
      no,
      sku: `MN-${SKU_CODES[cat]}-${white ? "W" : "B"}-${pad4(n)}`,
      title,
      price: index.price[i],
      baseColor,
      backPrintUrl: `/prints/print_${n}.svg`,
      category: cat,
      variant: index.variants[index.variant[i]],
      family: `fam-${pad4(index.family[i])}`,
      features,
      rank: index.rank[i],
      dropDate: dropEpoch + index.drop[i] * DAY,
      weak: index.weak[i] === "1",
    };
  });
}

function init(index: CatalogIndex) {
  checkIndexHead(index);
  SHIRTS.push(...decodeAll(index));
  CALIBRATION_IDS.push(...index.calibration);
  CALIBRATION_TOTAL = CALIBRATION_IDS.length;
  SHARD_SIZE = index.shardSize;
  shardHashes = index.shards;
  for (const s of SHIRTS) {
    BY_ID.set(s.id, s);
    const list = FAMILIES.get(s.family);
    if (list) list.push(s);
    else FAMILIES.set(s.family, [s]);
  }
  for (const s of SHIRTS) if (isPrerendered(s)) PRERENDERED.push(s);
}

let ready = false;
const loading = (() => {
  const src = loadIndex();
  if (src instanceof Promise)
    return src.then((index) => {
      init(index);
      ready = true;
    });
  init(src);
  ready = true;
  return Promise.resolve();
})();

/** Resolves once the catalog is filled in (at once on the server). */
export const catalogReady = () => loading;
export const isCatalogReady = () => ready;

export const getShirtById = (id: string) => BY_ID.get(id);

/** Each detail shard's file (named by its content hash, from the index head). */
export const shardFile = (k: number) => `/data/details-${k}.${shardHashes[k]}.json`;
export const shardOf = (shirt: Pick<ShirtProduct, "n">) => Math.floor((shirt.n - 1) / SHARD_SIZE);

/** Public asset URLs need the GitHub Pages base path (e.g. /MONO) in front. */
export const assetUrl = (url: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${url}`;

/**
 * The print file for a tee colour. Drawn prints have one file, flipped
 * with a CSS invert for the other colour (they're strictly two-tone, so
 * that's exact). A photograph inverted is a negative, so photo designs
 * carry a second, positive print: print_<n>_<colour>.svg.
 */
export const printUrl = (shirt: Pick<ShirtProduct, "n" | "baseColor" | "backPrintUrl" | "category">, color: BaseColor = shirt.baseColor) =>
  color !== shirt.baseColor && isPhoto(shirt) ? `/prints/print_${shirt.n}_${color}.svg` : shirt.backPrintUrl;

/** Whether showing `color` means inverting the print (drawn prints only). */
export const needsInvert = (shirt: Pick<ShirtProduct, "baseColor" | "category">, color: BaseColor) => color !== shirt.baseColor && !isPhoto(shirt);

/* ------------------------------------------------------------------ */
/* Product links                                                       */
/* ------------------------------------------------------------------ */

/**
 * How many product pages are pre-rendered (the top of the editorial rank).
 * Unset = all of them. The rest open through the client route /shop/p/?id=.
 */
function prerenderLimit() {
  return Number(process.env.NEXT_PUBLIC_PRERENDER_LIMIT) || Infinity;
}

export function isPrerendered(shirt: ShirtProduct) {
  return shirt.rank < prerenderLimit();
}

/** Link to a product page (relative to the base path, like next/link hrefs). */
export function productHref(id: string, hash = "") {
  const shirt = BY_ID.get(id);
  return !shirt || isPrerendered(shirt) ? `/shop/${id}/${hash}` : `/shop/p/?id=${id}${hash}`;
}

/* ------------------------------------------------------------------ */
/* Design families (near-identical variations of one print)            */
/* ------------------------------------------------------------------ */

export const familyOf = (id: string) => BY_ID.get(id)?.family;

export const familySize = (shirt: ShirtProduct) => FAMILIES.get(shirt.family)?.length ?? 1;

/** Every design in the shirt's family, itself included, in catalog order. */
export const familyMembers = (shirt: ShirtProduct) => FAMILIES.get(shirt.family) ?? [shirt];

/** Families touched by any of the given shirt ids. */
export function familiesOf(ids: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const f = familyOf(id);
    if (f) out.add(f);
  }
  return out;
}

/**
 * Keep the first item of each family (so pass the list already in the
 * desired order) and report how many variations it stands for.
 */
export function dedupeByFamily<T extends { shirt: ShirtProduct }>(list: T[]): (T & { variations: number })[] {
  const seen = new Set<string>();
  const out: (T & { variations: number })[] = [];
  for (const item of list) {
    if (seen.has(item.shirt.family)) continue;
    seen.add(item.shirt.family);
    out.push({ ...item, variations: familySize(item.shirt) - 1 });
  }
  return out;
}

/**
 * Display pacing: reorder (stable, greedy) so no item repeats the algorithm
 * (`variant`) of any of the previous `window` items, pulling the next
 * different one forward. Falls back to plain order when nothing else is left.
 * Never drops items; the relative ranking is otherwise preserved.
 *
 * Bucket queue: one FIFO per variant, and the variants ordered by the index
 * of their next item. The pick is the first of those whose variant isn't
 * recent, so each step looks at no more than window + 1 buckets.
 */
export function paceByVariant<T extends { shirt: ShirtProduct }>(list: T[], window = 3): T[] {
  const buckets = new Map<string, number[]>();
  list.forEach((x, i) => {
    const b = buckets.get(x.shirt.variant);
    if (b) b.push(i);
    else buckets.set(x.shirt.variant, [i]);
  });
  // Active buckets, sorted by the index of their head item.
  const order = [...buckets.entries()].map(([variant, idx]) => ({ variant, idx, head: 0 }));
  order.sort((a, b) => a.idx[0] - b.idx[0]);
  const out: T[] = [];
  const recent: string[] = [];
  while (order.length) {
    let pos = order.findIndex((b) => !recent.includes(b.variant));
    if (pos === -1) pos = 0;
    const b = order[pos];
    out.push(list[b.idx[b.head++]]);
    recent.push(b.variant);
    if (recent.length > window) recent.shift();
    order.splice(pos, 1);
    if (b.head < b.idx.length) {
      // Re-insert by its new head index (binary search).
      const key = b.idx[b.head];
      let lo = 0;
      let hi = order.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (order[mid].idx[order[mid].head] < key) lo = mid + 1;
        else hi = mid;
      }
      order.splice(lo, 0, b);
    }
  }
  return out;
}

/**
 * Shop "For you" order at the top of the grid: the ranking, reordered
 * greedily so that
 * - no three cards in a row share a category, or a tee colour,
 * - no card repeats the algorithm of the previous `variantWindow` cards,
 * - every `wildcardEvery`-th card is a wildcard: the best-ranked design
 *   from a category not among the previous slots (a taste probe).
 * Rules relax in that order when nothing fits. Only the first `top` items
 * are diversified (the rest keep the variant pacing), so it stays cheap.
 * `sameColor: false` skips the colour rule (all tees shown in one colour).
 */
export function diversify<T extends { shirt: ShirtProduct }>(
  list: T[],
  { top = 96, maxRun = 2, wildcardEvery = 8, variantWindow = 3, category = true, color = true } = {},
): (T & { wildcard?: boolean })[] {
  const pool = [...list];
  const out: (T & { wildcard?: boolean })[] = [];
  const run = (key: (s: ShirtProduct) => string, candidate: ShirtProduct) =>
    out.length >= maxRun && out.slice(-maxRun).every((x) => key(x.shirt) === key(candidate));
  // Weak prints (a lone small shape) never make the top: they wait below it.
  const weak = pool.filter((x) => x.shirt.weak);
  if (weak.length) pool.splice(0, pool.length, ...pool.filter((x) => !x.shirt.weak));
  while (pool.length && out.length < top) {
    const slot = out.length;
    const recentVariants = new Set(out.slice(-variantWindow).map((x) => x.shirt.variant));
    if (category && wildcardEvery > 0 && slot % wildcardEvery === wildcardEvery - 1) {
      const seen = new Set(out.slice(-(wildcardEvery - 1)).map((x) => x.shirt.category));
      const i = pool.findIndex((x) => !seen.has(x.shirt.category) && !(color && run((s) => s.baseColor, x.shirt)));
      if (i !== -1) {
        out.push({ ...pool.splice(i, 1)[0], wildcard: true });
        continue;
      }
    }
    const fits = [
      (s: ShirtProduct) => !(category && run((x) => x.category, s)) && !(color && run((x) => x.baseColor, s)) && !recentVariants.has(s.variant),
      (s: ShirtProduct) => !(category && run((x) => x.category, s)) && !(color && run((x) => x.baseColor, s)),
      (s: ShirtProduct) => !(category && run((x) => x.category, s)),
    ];
    let i = -1;
    for (const ok of fits) {
      i = pool.findIndex((x) => ok(x.shirt));
      if (i !== -1) break;
    }
    out.push(pool.splice(i === -1 ? 0 : i, 1)[0]);
  }
  // Weak ones go back in by rank, below the diversified top.
  let rest = pool;
  if (weak.length) {
    const at = new Map(list.map((x, i) => [x, i]));
    rest = [...pool, ...weak].sort((a, b) => at.get(a)! - at.get(b)!);
  }
  return [...out, ...paceByVariant(rest, variantWindow)];
}

