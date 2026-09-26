import { getShirtById } from "@/lib/catalog";
import { centeredCosine } from "@/lib/recommendation";
import type { ShirtProduct } from "@/types/shirt";

/** How alike (centered cosine) a saved design must be to be named as the reason. */
export const BECAUSE_MIN = 0.55;

/**
 * "Because you liked …": the saved design this one is most like (another
 * family, alike enough), or null. The reason is real — the closest thing
 * the visitor actually liked — never a stock line.
 */
export function becauseOf(shirt: Pick<ShirtProduct, "id" | "family" | "features">, likedIds: readonly string[]): ShirtProduct | null {
  let best: ShirtProduct | null = null;
  let bestSim = BECAUSE_MIN;
  for (const id of likedIds) {
    const s = getShirtById(id);
    if (!s || s.id === shirt.id || s.family === shirt.family) continue;
    const sim = centeredCosine(s.features, shirt.features);
    if (sim > bestSim) (bestSim = sim), (best = s);
  }
  return best;
}
