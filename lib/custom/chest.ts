import { MODEL_ASPECT } from "@/lib/models";

/** The print's share of a chest crop's width. */
const CROP_FILL = 0.6;

/** The chest crop of a model photo, as fractions of it, around its print box: 3:4, the print CROP_FILL wide, a little room above. */
export function chestBox(box: readonly number[]): { x: number; y: number; w: number; h: number } {
  const w = Math.min(1, box[2] / CROP_FILL);
  const h = Math.min(1, (w * MODEL_ASPECT * 4) / 3);
  const x = Math.min(1 - w, Math.max(0, box[0] + box[2] / 2 - w / 2));
  const y = Math.min(1 - h, Math.max(0, box[1] - h * 0.12));
  return { x, y, w, h };
}
