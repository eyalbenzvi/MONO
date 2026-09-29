/** Placeholder: this product isn't built yet (not in lib/custom/products' list). */
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  w?: string;
}
export const NAME = "automaton";
export const check = (_p: Record<string, unknown>, _ctx: CheckContext): Params | null => null;
export const detail = (_p: Params) => "";
export const PRODUCT: ProductMeta<Params> = { line: "", from: "", group: "you", base: "matrix", example: {} };
