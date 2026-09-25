import index from "@/data/shirts.index.json";
import { SKU_CODES, type BaseColor, type FeatureKey, type FeatureVector, type ShirtCategory, type ShirtProduct } from "@/types/shirt";

/**
 * The catalog: 2,800 procedurally generated shirts in 14 categories (see
 * scripts/generateCatalog.ts — run `npm run generate` to rebuild).
 *
 * The app bundles only the lean index (data/shirts.index.json): what the
 * recommender, cards and grid need. Descriptions and precomputed neighbours
 * live in public/data shards (lib/details); the full catalog
 * (data/shirts.json) is read at build time only (lib/catalogServer).
 */

const pad4 = (n: number) => String(n).padStart(4, "0");

/** Feature values are stored one symbol per design (see writeIndex). */
const DIGIT = new Map([...index.digits].map((c, v) => [c, v]));

/** Running count within each category: the design's "No.". */
const categoryCount = new Map<number, number>();

/**
 * Design n sits at position n − 1 of every column (see writeIndex in the
 * generator). Must be called in order: `no` is a running count.
 */
const countIn = (category: number) => {
  const no = (categoryCount.get(category) ?? 0) + 1;
  categoryCount.set(category, no);
  return no;
};

function decode(i: number): ShirtProduct {
  const n = i + 1;
  const cat = index.categories[index.category[i]] as ShirtCategory;
  const white = index.white[i] === "1";
  const baseColor: BaseColor = white ? "white" : "black";
  const features = {} as FeatureVector;
  (index.keys as FeatureKey[]).forEach((k, j) => (features[k] = DIGIT.get(index.features[j][i])! / 100));
  return {
    id: `mono-${pad4(n)}`,
    n,
    no: countIn(index.category[i]),
    sku: `MN-${SKU_CODES[cat]}-${white ? "W" : "B"}-${pad4(n)}`,
    title: index.title[i],
    price: index.price[i],
    baseColor,
    backPrintUrl: `/prints/print_${n}.svg`,
    category: cat,
    variant: index.variants[index.variant[i]],
    family: `fam-${pad4(index.family[i])}`,
    features,
    rank: index.rank[i],
    dropWeek: Math.floor(i / index.dropSize),
  };
}

export const SHIRTS: ShirtProduct[] = index.title.map((_, i) => decode(i));

/** The taste test, precomputed by the generator (see calibrationIds there). */
export const CALIBRATION_IDS: readonly string[] = index.calibration;

const BY_ID = new Map(SHIRTS.map((s) => [s.id, s]));

export const getShirtById = (id: string) => BY_ID.get(id);

/** Public asset URLs need the GitHub Pages base path (e.g. /MONO) in front. */
export const assetUrl = (url: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${url}`;

/* ------------------------------------------------------------------ */
/* Product links                                                       */
/* ------------------------------------------------------------------ */

/**
 * How many product pages are pre-rendered (the top of the editorial rank).
 * Unset = all of them. The rest open through the client route /shop/p/?id=.
 */
const PRERENDER_LIMIT = Number(process.env.NEXT_PUBLIC_PRERENDER_LIMIT) || Infinity;

export const isPrerendered = (shirt: ShirtProduct) => shirt.rank < PRERENDER_LIMIT;

/** Product pages that get a static page at /shop/<id>/. */
export const PRERENDERED = SHIRTS.filter(isPrerendered);

/** Link to a product page (relative to the base path, like next/link hrefs). */
export function productHref(id: string, hash = "") {
  const shirt = BY_ID.get(id);
  return !shirt || isPrerendered(shirt) ? `/shop/${id}/${hash}` : `/shop/p/?id=${id}${hash}`;
}

/* ------------------------------------------------------------------ */
/* Design families (near-identical variations of one print)            */
/* ------------------------------------------------------------------ */

const FAMILIES = new Map<string, ShirtProduct[]>();
for (const s of SHIRTS) {
  const list = FAMILIES.get(s.family);
  if (list) list.push(s);
  else FAMILIES.set(s.family, [s]);
}

/** One representative per family (its first design), in catalog order. */
export const FAMILY_LEADERS = [...FAMILIES.values()].map((members) => members[0]);

export const familyOf = (id: string) => BY_ID.get(id)?.family;

export const familySize = (shirt: ShirtProduct) => FAMILIES.get(shirt.family)?.length ?? 1;

/** Every design in the shirt's family, itself included, in catalog order. */
export const familyMembers = (shirt: ShirtProduct) => FAMILIES.get(shirt.family) ?? [shirt];

/** The other designs in the shirt's family. */
export const variationsOf = (shirt: ShirtProduct) => familyMembers(shirt).filter((s) => s.id !== shirt.id);

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
