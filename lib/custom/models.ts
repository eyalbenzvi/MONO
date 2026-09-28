/**
 * The model photos a personalised print is drawn on: exactly the ones
 * modelFor returns for the designs that can be personalised, in both tee
 * colours. The export drops every other photo (they only feed the baked
 * pictures); postbuild keeps these.
 */
import { modelFor } from "@/lib/models";
import type { ShirtProduct } from "@/types/shirt";
import { templateFor } from "./spec";

export const customModelIds = (shirts: readonly Pick<ShirtProduct, "n" | "variant">[]) =>
  [...new Set(shirts.filter((s) => templateFor(s)).flatMap((s) => (["black", "white"] as const).map((c) => modelFor(s, c)?.id)).filter((id): id is string => !!id))].sort();
