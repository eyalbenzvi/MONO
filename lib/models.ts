import models from "@/data/models/models.json";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

/**
 * Model photos (T2): men photographed from behind in a plain tee, against
 * quiet urban backgrounds (a concrete wall, a shutter, an underpass) so the
 * tee is the subject. They are generated images (scripts/models), not
 * photos of real people; the print is laid onto the back of the tee in the
 * browser (TeeMockup). `box` is where the print goes, as fractions of the
 * photo; `<id>-mask.png` is the tee.
 */
export interface ModelPhoto {
  id: string;
  color: BaseColor;
  /** Print area on the photo: x, y, width, height (fractions). */
  box: [number, number, number, number];
}

export const MODEL_PHOTOS = models as ModelPhoto[];
/** The photos' shape (width / height). */
export const MODEL_ASPECT = 512 / 704;

/** The photo a design is shown on in `color`: one of that tee colour's photos, the same one every time. */
export function modelFor(shirt: Pick<ShirtProduct, "n">, color: BaseColor): ModelPhoto | null {
  const list = MODEL_PHOTOS.filter((m) => m.color === color);
  if (!list.length) return null;
  return list[(Math.imul(shirt.n, 2654435761) >>> 0) % list.length];
}
