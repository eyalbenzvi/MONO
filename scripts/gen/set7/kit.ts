/**
 * Shared pieces of the seventh set (content overhaul, Part 3): designs made
 * from real data — star positions, orbital elements, scales and tables,
 * standard circuits, instrument faces. White ink on the 300 × 400 canvas
 * (the generator swaps the inks for a white tee).
 */
import type { FeatureKey, ShirtCategory } from "../../../types/shirt";

export interface Set7Design {
  body: string;
  variant: string;
  /** The shop category it is filed under (Part 4). */
  category: ShirtCategory;
  title: string;
  /** What the print shows, for its page title and search; the title when unset. */
  subject?: string;
  description: string;
  features: Partial<Record<FeatureKey, number>>;
  /** Near-identical designs share a key (families). */
  sigKey: string;
}

// The drawing kit itself is pure and shared with the browser's personalised prints.
export * from "../../../lib/custom/kit";
