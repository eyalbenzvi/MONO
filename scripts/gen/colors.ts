import { otherColor, type BaseColor } from "../../types/shirt";
import type { ArchiveGroup } from "../archive/source";

/**
 * The tee colours a design is sold in (T3), from what its print does on the
 * other colour:
 * - a photograph keeps its tones, so on the other tee most of the picture
 *   drops out (a light picture on white): its own colour only;
 * - tonal ink (brush paintings, woodblock prints, botanical watercolours)
 *   printed white on black is a negative of the original: white only;
 * - a print that is mostly ink (a knocked-out block, over INK_HEAVY of the
 *   area) turns into a solid slab on the other colour: its own colour only;
 * - everything else — line work, drawn two-tone prints — works on both.
 */
export const INK_HEAVY = 0.4;
export const TONAL_INK: ArchiveGroup[] = ["ink-painting", "ukiyo-e", "botanical"];
export function offeredColors(baseColor: BaseColor, single: boolean): BaseColor[] {
  return single ? [baseColor] : [baseColor, otherColor(baseColor)];
}

