import raw from "@/data/shirts.json";
import type { ShirtProduct } from "@/types/shirt";

/**
 * The catalog: 1,000 procedurally generated shirts (see
 * scripts/generate1000Shirts.ts — run `npm run generate` to rebuild).
 */
export const SHIRTS = raw as unknown as ShirtProduct[];

const BY_ID = new Map(SHIRTS.map((s) => [s.id, s]));

export const getShirtById = (id: string) => BY_ID.get(id);

/** Public asset URLs need the GitHub Pages base path (e.g. /MONO) in front. */
export const assetUrl = (url: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${url}`;
