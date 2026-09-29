/**
 * What each later Make product's own spec module (lib/custom/specs/<id>.ts)
 * exports, beside its params type: its name, the strict check of its params,
 * the detail after its name in the bag, and its product entry (the index
 * card, the product page, the example it shows). lib/custom/spec and
 * lib/custom/products read them; the module is the product's one source.
 */
import type { PrintHints } from "../printCheck";
import type { MakeGroup } from "../products";
import type { City } from "../spec";
import type { CapRule } from "../specKit";

export interface CheckContext {
  /** The place list, when the caller has it: a city id must then be a known city. */
  cityById?: (id: number) => City | undefined;
}

export interface ProductMeta<P> {
  /** What it is, in one line (the product page). */
  line: string;
  /** What it takes, concretely ("A name and a year"): the Make index's line under the card. */
  from: string;
  group: MakeGroup;
  /** The catalogue design (by variant) it is drawn like. */
  base: string;
  /** The catalogue designs whose pages lead here ("Make your own"); `base` when unset. */
  bases?: string[];
  wordsHint?: string;
  /** The example the index and the page open with: a real print that passes the gate in both colourways. */
  example: P;
  hints?: PrintHints;
}

export interface SpecModule<P> {
  NAME: string;
  /** The caption's rule (which lines may be hidden, each line's longest); every line kept, CAP_MAX long, when absent. */
  CAP?: CapRule;
  /** Its words (`w`) were the caption's first line: the editor writes cap[0] instead, and a link's `w` opens as the visitor's title. */
  WORDS_TITLE?: boolean;
  check: (p: Record<string, unknown>, ctx: CheckContext) => P | null;
  detail: (p: P) => string;
  PRODUCT: ProductMeta<P>;
}
