import raw from "@/data/shirts.json";
import type { ShirtProduct } from "@/types/shirt";

/**
 * The catalog: 2,800 procedurally generated shirts in 14 categories (see
 * scripts/generateCatalog.ts — run `npm run generate` to rebuild).
 */
export const SHIRTS = raw as unknown as ShirtProduct[];

const BY_ID = new Map(SHIRTS.map((s) => [s.id, s]));

export const getShirtById = (id: string) => BY_ID.get(id);

/** Public asset URLs need the GitHub Pages base path (e.g. /MONO) in front. */
export const assetUrl = (url: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${url}`;

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
 */
export function paceByVariant<T extends { shirt: ShirtProduct }>(list: T[], window = 3): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (pool.length) {
    const recent = new Set(out.slice(-window).map((x) => x.shirt.variant));
    const i = pool.findIndex((x) => !recent.has(x.shirt.variant));
    out.push(pool.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return out;
}
