/**
 * The designs Make's products are drawn like (lib/custom/products `base`) that
 * aren't in the shop's catalogue: a base the designers took out of the shop
 * stays here, for Make alone. They have no product page, no place in the
 * grid, Discover or search; a made-for-you tee takes its model photo and its
 * place in the taste from one. Written by scripts/generateCatalog (data/make/bases.json).
 */
import bases from "@/data/make/bases.json";
import type { ShirtProduct } from "@/types/shirt";

export const MAKE_BASES = bases as unknown as ShirtProduct[];

/** The design a Make product is drawn like: the catalogue's first of that variant, else the one kept for Make. */
export const makeBase = <T extends Pick<ShirtProduct, "variant">>(variant: string, shirts: readonly T[]): T | ShirtProduct | undefined =>
  shirts.find((s) => s.variant === variant) ?? MAKE_BASES.find((s) => s.variant === variant);
