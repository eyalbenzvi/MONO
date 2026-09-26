/**
 * Photographs for the photo categories: Smithsonian Open Access (CC0),
 * read from its public bucket (s3://smithsonian-open-access, anonymous).
 *
 * Shared by fetchPhotos.ts (network, run by hand) and the generator,
 * which only reads what that tool committed: data/photos/photos.json and
 * the prints public/prints/print_<n>.webp.
 */
import { PHOTO_CATEGORIES, type ShirtCategory } from "../../types/shirt";
import { mulberry32, shuffle } from "../gen/core";

export const BUCKET = "https://smithsonian-open-access.s3.amazonaws.com";

/** Photo categories and the Smithsonian units they draw from. */
export const PHOTO_UNITS = { nzp: "Smithsonian's National Zoo", nasm: "National Air and Space Museum" } as const;
export type PhotoUnit = keyof typeof PHOTO_UNITS;

/** A photograph's print: 3:4 greyscale WebP with alpha, the whole 28 × 37 cm print area. */
export const PRINT_W = 750;
export const PRINT_H = 1000;

/** A photograph as committed: where it came from, what it shows, who took it, and what's in the picture. */
export interface PhotoSource {
  /** The Smithsonian image id (idsId). */
  key: string;
  category: Extract<ShirtCategory, "wildlife" | "flight" | "machines">;
  unit: PhotoUnit;
  /** The record's own title ("Douglas DC-3", "Orangutan"). */
  title: string;
  /** What the print shows, cleaned from the title ("Airspeed Indicator"). */
  subject: string;
  /** The record's credit line, verbatim when it has one. */
  credit: string;
  /** EDAN record id: https://collections.si.edu/search/detail/edanmdm:<record>. */
  record: string;
  /** Object type from the record (NASM) or "Animal photograph" (NZP). */
  kind: string;
  /** Cut out from a studio backdrop, or the whole photograph as taken. */
  mode: "object" | "frame";
  /** Mean brightness of the picture (0–1). */
  tone: number;
  /** Tonal spread of the picture (standard deviation, 0–1). */
  contrast: number;
  /** Share of the print area the picture covers (0–1). */
  coverage: number;
  /** Fine detail (mean Laplacian, 0–1). */
  detail: number;
  /** The picture's box on the print, as fractions [x0, y0, x1, y1]. */
  box: [number, number, number, number];
}

export const recordUrl = (record: string) => `https://collections.si.edu/search/detail/edanmdm:${record}`;

/** First photo id and the seed the order within each category comes from. */
export const PHOTO_FIRST_N = 2801;
const SEED = 0x6d6f6e6f; // "mono", as in generateCatalog

/**
 * Which photograph becomes which design: categories interleaved (like
 * every set), each category's photographs in a seeded shuffle of their
 * keys. The fetch tool names the prints by it; the generator reads it.
 */
export function photoOrder(all: PhotoSource[], perCategory: number): { n: number; index: number; photo: PhotoSource }[] {
  const queues = PHOTO_CATEGORIES.map((c, k) => {
    const list = all.filter((p) => p.category === c).sort((a, b) => a.key.localeCompare(b.key));
    if (list.length !== perCategory) throw new Error(`${list.length} ${c} photographs, expected ${perCategory}`);
    return shuffle(mulberry32(SEED ^ (0x4000 + k)), list);
  });
  return Array.from({ length: perCategory * PHOTO_CATEGORIES.length }, (_, i) => {
    const index = Math.floor(i / PHOTO_CATEGORIES.length) + 1;
    return { n: PHOTO_FIRST_N + i, index, photo: queues[i % PHOTO_CATEGORIES.length][index - 1] };
  });
}
