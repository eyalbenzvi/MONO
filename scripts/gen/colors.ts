import { otherColor, type BaseColor } from "../../types/shirt";
import type { ArchiveGroup } from "../archive/source";

/**
 * The tee colours a design is sold in (T3), from what its print does on the
 * other colour:
 * - a photograph keeps its tones, so on the other tee most of the picture
 *   drops out (a light picture on white): its own colour only;
 * - tonal ink (brush paintings, woodblock prints, botanical and natural
 *   history plates) is screened into a one-ink halftone (Part 2), so like
 *   line work it prints as white ink on black too: both colours, and
 *   brush work and plates now start on black tees as well (Part 3);
 * - a print that is mostly ink (over INK_HEAVY of the
 *   area) turns into a solid slab on the other colour: its own colour only;
 * - everything else — line work, drawn two-tone prints — works on both.
 */
export const INK_HEAVY = 0.4;
export const TONAL_INK: ArchiveGroup[] = ["ink-painting", "ukiyo-e", "botanical", "natural-history"];
/** Share of tonal prints that start on a black tee: brush work half, plates a third. */
export const TONAL_ON_BLACK: Partial<Record<ArchiveGroup, number>> = { "ink-painting": 0.5, "ukiyo-e": 0.5, botanical: 1 / 3, "natural-history": 1 / 3 };
export function offeredColors(baseColor: BaseColor, single: boolean): BaseColor[] {
  return single ? [baseColor] : [baseColor, otherColor(baseColor)];
}

