/**
 * Human names for what the search index groups by: variants (the generator's
 * algorithm ids), sources (museum credits) and look tags. Data only — a
 * variant without an entry is humanized from its id, and an unknown source
 * simply isn't a facet (scripts/tools/searchIndex.ts warns about both).
 */
import { clean } from "./normalize";

/** Variant ids that read badly when humanized. Everything else: humanizeId. */
export const VARIANT_LABELS: Record<string, string> = {
  "archive-ukiyo-e": "Ukiyo-e",
  "archive-old-master": "Old master",
  "archive-natural-history": "Natural history",
  "photo-flight-object": "Aircraft",
  "photo-machines-object": "Machines",
  "photo-wildlife-object": "Wildlife",
  "sky-chart": "Star chart",
  "sky-figure": "Constellation",
  "sky-night": "Night sky",
  "type-data": "Typeset data",
  "terminal-data": "Terminal data",
  "moon-year": "Moon phases",
  "planets-date": "Planets",
  "orbit-halley": "Halley's orbit",
  "orbit-moons": "Jupiter's moons",
  "smith-chart": "Smith chart",
  "slide-rule": "Slide rule",
  "logic-gates": "Logic gates",
  "brick-bond": "Brick bond",
  "golden-spiral": "Golden spiral",
};

/** Id parts that only say where a design came from, dropped when humanizing. */
const ID_PREFIXES = ["archive-", "photo-", "lsystem-", "ascii-"];
const ID_SUFFIXES = ["-object"];

/** "archive-etching" → "Etching"; "lsystem-fern" → "Fern". */
export function humanizeId(id: string): string {
  let s = id;
  for (const p of ID_PREFIXES) if (s.startsWith(p) && s.length > p.length) s = s.slice(p.length);
  for (const x of ID_SUFFIXES) if (s.endsWith(x) && s.length > x.length) s = s.slice(0, -x.length);
  s = s.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const variantLabel = (id: string) => VARIANT_LABELS[id] ?? humanizeId(id);
export const hasVariantLabel = (id: string) => id in VARIANT_LABELS;

/**
 * Museum credits → one source. Matched on the start of a cleaned credit
 * segment, so truncated credits in the data ("Smithsonian's Nati") still
 * land. `generic` sources only count when nothing more specific is named.
 */
export const SOURCES: { prefixes: string[]; id: string; label: string; generic?: boolean }[] = [
  { prefixes: ["smithsonian american art museum"], id: "saam", label: "Smithsonian American Art Museum" },
  { prefixes: ["cooper hewitt", "smithsonian design museum"], id: "cooper-hewitt", label: "Cooper Hewitt" },
  { prefixes: ["national museum of asian art", "freer"], id: "asian-art", label: "National Museum of Asian Art" },
  { prefixes: ["national air and space"], id: "air-space", label: "National Air and Space Museum" },
  { prefixes: ["national museum of american history"], id: "american-history", label: "National Museum of American History" },
  { prefixes: ["national museum of natural history"], id: "natural-history", label: "National Museum of Natural History" },
  { prefixes: ["smithsonians nat", "national zoo", "fonz"], id: "zoo", label: "National Zoo" },
  { prefixes: ["smithsonian institution"], id: "smithsonian", label: "Smithsonian Institution", generic: true },
];

/** The source named by a credit ("Roshan Patel, Smithsonian's National Zoo" → zoo), or null. */
export function sourceOf(credit: string): (typeof SOURCES)[number] | null {
  let found: (typeof SOURCES)[number] | null = null;
  for (const seg of credit.split(",")) {
    const c = clean(seg);
    // A truncated credit is still a prefix of the name, at least a word long.
    const s = SOURCES.find((x) => x.prefixes.some((p) => c.startsWith(p) || (c.length >= 12 && p.startsWith(c))));
    if (s && (!found || (found.generic && !s.generic))) found = s;
  }
  return found;
}

/**
 * Look tags: each is one end of a feature or a visual measure, cut at the
 * catalog's own percentiles when the index is built (never a fixed number).
 */
export const LOOK_TAGS: { id: string; label: string; key: string; side: "high" | "low" }[] = [
  { id: "minimal", label: "Minimal", key: "clean_minimal", side: "high" },
  { id: "bold", label: "Bold", key: "contrast", side: "high" },
  { id: "dense", label: "Dense", key: "density", side: "high" },
  { id: "airy", label: "Airy", key: "density", side: "low" },
  { id: "line", label: "Line", key: "line_art", side: "high" },
  { id: "halftone", label: "Halftone", key: "halftone_raster", side: "high" },
  { id: "geometric", label: "Geometric", key: "geometric", side: "high" },
  { id: "figurative", label: "Figurative", key: "figurative", side: "high" },
  { id: "witty", label: "Witty", key: "wit", side: "high" },
  { id: "retro", label: "Retro", key: "retro", side: "high" },
  { id: "nature", label: "Nature", key: "nature", side: "high" },
  { id: "symmetric", label: "Symmetric", key: "symmetry", side: "high" },
  { id: "detailed", label: "Detailed", key: "detail", side: "high" },
  { id: "simple", label: "Simple", key: "detail", side: "low" },
  { id: "small", label: "Small print", key: "extent", side: "low" },
  { id: "full", label: "Full print", key: "extent", side: "high" },
];
/** Two tags that aren't a percentile: a wide print, and one with no lettering. */
export const WIDE_ASPECT = 1.15;
export const EXTRA_TAGS = [
  { id: "wide", label: "Wide" },
  { id: "notext", label: "No text" },
];
/** Feature keys that deliberately have no look tag (covered by a category or medium, or too vague to name). */
export const UNTAGGED_KEYS = ["typography", "architectural", "abstract", "dark_industrial", "pictorial", "classic", "photographic"];
/** Percentiles for a tag's high and low end. */
export const TAG_HIGH = 0.85;
export const TAG_LOW = 0.15;

export const MEDIUM_LABELS: Record<string, string> = { drawn: "Drawn", ink: "Archive print", photo: "Photograph" };
export const TEE_LABELS: Record<string, string> = { black: "Black tee", white: "White tee" };
