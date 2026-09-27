/**
 * Designs the tests stand on, picked by role from whatever the catalogue
 * holds now: reviews retire designs (ids are never renumbered), so a test
 * never names a fixed id. Drawn designs sold in both tee colours, in id
 * order — W* on a white tee originally, B* on a black one.
 */
import full from "../data/shirts.json";

interface Entry {
  id: string;
  n: number;
  medium: string;
  baseColor: string;
  colors: string[];
}
const LIVE = (full as unknown as Entry[]).filter((s) => s.medium === "drawn" && s.colors.length === 2).sort((a, b) => a.n - b.n);
const pick = (color: string) => LIVE.filter((s) => s.baseColor === color).map((s) => s.id);

export const [W1, W2] = pick("white");
export const [B1, B2, B3, B4, B5, B6, B7, B8, B9, B10] = pick("black");
/** Ids no design has, or had and lost (retired in the content overhaul): they must degrade gracefully. */
export const UNKNOWN = "mono-9999";
export const RETIRED = ["mono-0002", "mono-0003", "mono-0006", "mono-2400"];
