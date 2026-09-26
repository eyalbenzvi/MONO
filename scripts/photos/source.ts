/**
 * Photographs for the photo categories: Smithsonian Open Access (CC0),
 * read from its public bucket (s3://smithsonian-open-access, anonymous).
 *
 * Shared by fetchPhotos.ts (network, run by hand) — the generator only
 * reads what that tool committed under data/photos.
 */
import type { ShirtCategory } from "../../types/shirt";

export const BUCKET = "https://smithsonian-open-access.s3.amazonaws.com";

/** Photo categories and the Smithsonian units they draw from. */
export const PHOTO_UNITS = { nzp: "Smithsonian's National Zoo", nasm: "National Air and Space Museum" } as const;
export type PhotoUnit = keyof typeof PHOTO_UNITS;

/** A photograph as committed: where it came from, what it shows, who took it. */
export interface PhotoSource {
  /** File stem in data/photos/img (and the idsId of the Smithsonian image). */
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
  /** Isolated object (background removed) or a full-frame photograph. */
  mode: "object" | "frame";
  /** Mean luminance of the photograph's subject (0–1). */
  tone: number;
}

export const recordUrl = (record: string) => `https://collections.si.edu/search/detail/edanmdm:${record}`;
