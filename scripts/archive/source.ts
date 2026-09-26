/**
 * Archive designs: public-domain (CC0) artworks and photographs from
 * Smithsonian Open Access — ink paintings, woodcuts and etchings, botanical
 * plates, ornament and stencils, archive photographs, Muybridge's animal
 * studies and patent models. Shared by fetchArchive.ts (network, run by
 * hand) and the generator, which only reads what that tool committed:
 * data/archive/archive.json and the prints public/prints/print_<n>.webp.
 */

export const ARCHIVE_UNITS = {
  fsg: { dir: "fs", name: "National Museum of Asian Art" },
  saam: { dir: "saam", name: "Smithsonian American Art Museum" },
  sia: { dir: "sia", name: "Smithsonian Institution Archives" },
  nmah: { dir: "nmah", name: "National Museum of American History" },
  chndm: { dir: "chsdm", name: "Cooper Hewitt, Smithsonian Design Museum" },
} as const;
export type ArchiveUnit = keyof typeof ARCHIVE_UNITS;

/**
 * How a picture becomes a print:
 * - ink: a drawing, print or painting on paper — the paper drops out and the
 *   marks become one ink (alpha = how dark), so it prints in white on a black
 *   tee and in black on a white one, like a drawn print;
 * - photo: a photograph, the whole picture in greyscale (never inverted);
 * - cut: a photographed object cut out of its studio backdrop.
 */
export type ArchiveMode = "ink" | "photo" | "cut";

/** The groups of the archive set: where they come from and how they print. */
export const ARCHIVE_GROUPS = {
  "ink-painting": { unit: "fsg", mode: "ink", kind: "ink painting" },
  "ukiyo-e": { unit: "fsg", mode: "ink", kind: "woodblock print" },
  "gallery-print": { unit: "fsg", mode: "ink", kind: "print" },
  woodcut: { unit: "saam", mode: "ink", kind: "woodcut" },
  etching: { unit: "saam", mode: "ink", kind: "print" },
  botanical: { unit: "saam", mode: "ink", kind: "botanical study" },
  "art-photo": { unit: "saam", mode: "photo", kind: "photograph" },
  "archive-photo": { unit: "sia", mode: "photo", kind: "archive photograph" },
  locomotion: { unit: "nmah", mode: "photo", kind: "motion study" },
  patent: { unit: "nmah", mode: "cut", kind: "patent model" },
  ornament: { unit: "chndm", mode: "ink", kind: "ornament print" },
  stencil: { unit: "chndm", mode: "ink", kind: "katagami stencil" },
} as const satisfies Record<string, { unit: ArchiveUnit; mode: ArchiveMode; kind: string }>;
export type ArchiveGroup = keyof typeof ARCHIVE_GROUPS;

/** A print: 3:4, 750 × 1000, the whole 28 × 37 cm print area (as the photographs). */
export const ARCHIVE_W = 750;
export const ARCHIVE_H = 1000;

/** One archive design as committed (data/archive/archive.json). */
export interface ArchiveSource {
  /** Smithsonian image id (idsId). */
  key: string;
  group: ArchiveGroup;
  unit: ArchiveUnit;
  /** The record's own title. */
  title: string;
  /** The design's name (cleaned, unique). */
  name: string;
  /** Artist or photographer as the record names them, if it does. */
  maker: string | null;
  /** The record's date ("1857", "19th century"), if any. */
  date: string | null;
  /** The record's credit line, verbatim when it has one. */
  credit: string;
  /** EDAN record id: https://collections.si.edu/search/detail/edanmdm:<record>. */
  record: string;
  /** Measures of the print: mean ink (0–1), tonal spread, share of the area covered, fine detail. */
  tone: number;
  contrast: number;
  coverage: number;
  detail: number;
  /** The picture's box on the print, as fractions [x0, y0, x1, y1]. */
  box: [number, number, number, number];
}

/** First archive design number (ids run on after the generated fifth set's range). */
export const ARCHIVE_FIRST_N = 3831;
