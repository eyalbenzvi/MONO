import full from "@/data/shirts.json";
import type { CatalogEntry, ShirtDetails } from "@/types/shirt";

/**
 * The full generator output, for build-time use only (product page metadata
 * and props). Never imported by client components, so it stays out of the
 * browser bundle.
 */
const BY_ID = new Map((full as unknown as CatalogEntry[]).map((s) => [s.id, s]));

export const getEntry = (id: string) => BY_ID.get(id);

export function getDetails(id: string): ShirtDetails | null {
  const s = BY_ID.get(id);
  return s ? { description: s.description, similar: s.similar, subject: s.subject, printCm: s.printCm, ...(s.photo ? { photo: { credit: s.photo.credit, url: s.photo.url } } : {}) } : null;
}
