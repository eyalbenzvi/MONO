/**
 * The print grid (1500 × 2000 px over a 28 cm wide print area) and its two
 * placements. Kept apart from the converter so the page can use the sizes
 * without loading it (lib/upload/convert re-exports all of this).
 */
export type PrintSize = "full" | "small";

export const OUT_W = 1500;
export const OUT_H = 2000;
/** The grid is 28 cm across: 1 px ≈ 0.187 mm, at Full and Small alike (Small is a smaller placement on the same grid). */
export const MM_PER_PX = 280 / OUT_W;
export const PX_PER_MM = OUT_W / 280;
/**
 * The catalogue's fixed placement (scripts/tools/topAlignPrints TOP): every
 * picture starts 3% down the print area, centred across. Full fills the
 * 28 × 37 cm area below that margin; Small is a 12 × 12 cm square with the
 * same top, centred.
 */
export const TOP = Math.round(0.03 * OUT_H);
export const BOXES: Record<PrintSize, { x: number; y: number; w: number; h: number }> = {
  full: { x: 0, y: TOP, w: OUT_W, h: Math.min(OUT_H - TOP, Math.round(370 * PX_PER_MM)) },
  small: { x: Math.round((OUT_W - 120 * PX_PER_MM) / 2), y: TOP, w: Math.round(120 * PX_PER_MM), h: Math.round(120 * PX_PER_MM) },
};
