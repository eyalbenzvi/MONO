import models from "@/data/models/models.json";
import type { BaseColor, ShirtCategory, ShirtProduct } from "@/types/shirt";

/**
 * Model photos (T2): men photographed from behind in a plain tee, in a
 * scene that fits each category — a parking garage for architecture, a
 * zen garden for ink, a hangar for machines. They are generated images
 * (scripts/models), not photos of real people; the print is laid onto the
 * back of the tee in the browser (TeeMockup). `box` is where the print goes,
 * as fractions of the photo; `<id>-mask.png` is the tee.
 */
export interface ModelPhoto {
  id: string;
  category: ShirtCategory;
  color: BaseColor;
  /** Print area on the photo: x, y, width, height (fractions). */
  box: [number, number, number, number];
}

export const MODEL_PHOTOS = models as ModelPhoto[];
/** The photos' shape (width / height). */
export const MODEL_ASPECT = 512 / 704;

/**
 * The photo a design is shown on in `color`: one of its category's photos
 * for that tee colour (else any in that colour), the same one every time.
 */
export function modelFor(shirt: Pick<ShirtProduct, "n" | "category">, color: BaseColor): ModelPhoto | null {
  const own = MODEL_PHOTOS.filter((m) => m.category === shirt.category && m.color === color);
  const list = own.length ? own : MODEL_PHOTOS.filter((m) => m.color === color);
  if (!list.length) return null;
  return list[(Math.imul(shirt.n, 2654435761) >>> 0) % list.length];
}
