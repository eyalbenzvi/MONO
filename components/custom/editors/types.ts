import type { MadeProduct } from "@/lib/custom/products";
import type { RenderData } from "@/lib/custom/renderers";
import type { CustomSpec } from "@/lib/custom/spec";

/** What an editor tells the page: the spec its fields make (null while one is missing or wrong), and what drawing it needs. */
export interface EditorState {
  spec: CustomSpec | null;
  data?: RenderData;
  /** Nothing to make yet (Your Taste before the taste test): the page shows the example and no bag. */
  blocked?: boolean;
}

export interface EditorProps {
  made: MadeProduct;
  /** The print the address arrived with (this product's template, validated), or null. */
  arrival: CustomSpec | null;
  /** The shopper tried to buy with something missing: every field shows what it needs. */
  touched: boolean;
  onChange: (state: EditorState) => void;
}

export const INPUT =
  "h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-white [color-scheme:dark]";
