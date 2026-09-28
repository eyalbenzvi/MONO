/**
 * The model photos a made-for-you print is drawn on: exactly the ones
 * modelFor returns for each made product (it wears its base design's number:
 * lib/catalog madeProduct takes the first design of that variant), in both
 * tee colours. The export drops every other photo (they only feed the baked
 * pictures); postbuild keeps these.
 */
import { modelFor } from "@/lib/models";
import type { ShirtProduct } from "@/types/shirt";
import { MADE } from "./products";

export const customModelIds = (shirts: readonly Pick<ShirtProduct, "n" | "variant">[]) =>
  [
    ...new Set(
      MADE.flatMap((m) => {
        const base = shirts.find((s) => s.variant === m.base);
        return base ? (["black", "white"] as const).map((c) => modelFor(base, c)?.id) : [];
      }).filter((id): id is string => !!id),
    ),
  ].sort();
