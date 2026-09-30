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
  "photo-flight-object": "Aircraft",
  "photo-wildlife-object": "Wildlife",
  "sky-chart": "Star chart",
  "sky-figure": "Constellation",
  "sky-night": "Night sky",
  "moon-year": "Moon phases",
  "planets-date": "Planets",
  "orbit-halley": "Halley’s orbit",
  "orbit-moons": "Jupiter’s moons",
  "smith-chart": "Smith chart",
  "slide-rule": "Slide rule",
  "logic-gates": "Logic gates",
  "brick-bond": "Brick bond",
  "golden-spiral": "Golden spiral",
  "archive-etching": "Art print",
  "archive-gallery-print": "Etching",
  "archive-patent": "Patent model",
  "archive-botanical": "Botanical study",
  "archive-natural-history": "Natural history plate",
  "archive-stencil": "Katagami stencil",
  "photo-machines-object": "Engines & instruments",
  "type-data": "Reference table",
  "terminal-data": "Terminal & punch card",
  "ascii-scene": "ASCII scene",
  "ascii-shade": "ASCII solid",
  "lsystem-weed": "L-system weed",
  "lsystem-bush": "L-system bush",
  "lsystem-stem": "L-system stem",
  "lsystem-sprig": "L-system sprig",
  "lsystem-fern": "L-system fern",
  matrix: "Dot matrix",
  daylight: "Daylight hours",
  orders: "Classical orders",
  radial: "Halftone burst",
  gradient: "Halftone gradient",
  interference: "Moiré",
  contours: "Topographic contours",
  tiling: "Truchet tiling",
  monoform: "Primary form",
  poster: "Slogan poster",
  lorenz: "Lorenz attractor",
  rossler: "Rössler attractor",
  platonic: "Platonic solids",
  truss: "Bridge truss",
  dial: "Instrument dial",
  schematic: "Circuit schematic",
};

/* Label case ------------------------------------------------------------ */

/**
 * Words whose case isn't "first letter up": acronyms and the like. Only ones
 * the lexicon or the catalogue's ids actually use (a label is made from a
 * lexicon phrase or an id, both lower-case); keyed by the lower-case word.
 * ("US" is left out on purpose: as a label word "us" is the pronoun.)
 */
export const LABEL_WORDS: Record<string, string> = {
  nasa: "NASA",
  nyc: "NYC",
  ascii: "ASCII",
  bbc: "BBC",
  ibm: "IBM",
  led: "LED",
};

/**
 * Place names in the lexicon (lower case), title-cased wherever they occur in a
 * label: "new york" → "New York", never "New york". Multi-word names keep
 * their particles lower-case (PLACE_PARTICLES: "Rio de Janeiro").
 */
export const PLACES = ["new york", "new england", "manhattan", "brooklyn", "hudson", "japan", "china", "asia", "italy", "rome", "venice", "florence", "tivoli", "france", "paris", "normandy", "honfleur", "england", "britain", "london", "thames", "sussex", "maine", "massachusetts", "vermont", "connecticut", "boston", "nantucket", "fuji", "edo"];
/** Small words that stay lower-case inside a title-cased name. */
export const PLACE_PARTICLES = new Set(["de", "del", "della", "da", "di", "do", "dos", "du", "des", "la", "le", "les", "el", "of", "the", "and", "upon", "on", "en", "sur", "am", "im", "van", "von", "y"]);

/** Straight apostrophes in label text → typographic ones ("Halley's" → "Halley’s"). */
export const typographic = (s: string) => s.replace(/(\p{L})'(?=\p{L})/gu, "$1’").replace(/(\p{L}s)'(?=\s|$)/gu, "$1’");

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** "rio de janeiro" → "Rio de Janeiro", "stratford upon avon" → "Stratford upon Avon" (the first word always up). */
export function titleCase(phrase: string): string {
  return phrase
    .split(/(\s+|-)/)
    .map((w, i) => (/^\s+$|^-$/.test(w) ? w : LABEL_WORDS[w.toLowerCase()] ?? (i > 0 && PLACE_PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : capital(w.toLowerCase()))))
    .join("");
}

const PLACE_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${[...PLACES].sort((a, b) => b.length - a.length).map((p) => p.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`, "giu");

/**
 * A lower-case phrase or humanized id as a label, in sentence case: the first
 * letter up, acronyms (LABEL_WORDS) and places (PLACES) in their own case,
 * typographic apostrophes. "nasa" → "NASA", "new york" → "New York",
 * "ascii art" → "ASCII art". Words already capitalised are kept.
 */
export function labelCase(text: string): string {
  let s = text.trim().replace(/\s+/g, " ");
  s = s.replace(/[\p{L}\p{N}]+/gu, (w) => LABEL_WORDS[w] ?? w);
  s = s.replace(PLACE_RE, (m) => titleCase(m));
  return typographic(capital(s));
}

/** Id parts that only say where a design came from, dropped when humanizing. */
const ID_PREFIXES = ["archive-", "photo-", "lsystem-", "ascii-"];
const ID_SUFFIXES = ["-object"];

/** "archive-etching" → "Etching"; "lsystem-fern" → "Fern"; "nasa-probe" would read "NASA probe". */
export function humanizeId(id: string): string {
  let s = id;
  for (const p of ID_PREFIXES) if (s.startsWith(p) && s.length > p.length) s = s.slice(p.length);
  for (const x of ID_SUFFIXES) if (s.endsWith(x) && s.length > x.length) s = s.slice(0, -x.length);
  return labelCase(s.replace(/-/g, " "));
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
  { id: "line", label: "Line art", key: "line_art", side: "high" },
  { id: "halftone", label: "Halftone dots", key: "halftone_raster", side: "high" },
  { id: "geometric", label: "Geometric", key: "geometric", side: "high" },
  { id: "figurative", label: "Figures", key: "figurative", side: "high" },
  { id: "retro", label: "Retro", key: "retro", side: "high" },
  { id: "nature", label: "Nature", key: "nature", side: "high" },
  { id: "symmetric", label: "Symmetric", key: "symmetry", side: "high" },
  { id: "detailed", label: "Detailed", key: "detail", side: "high" },
  { id: "simple", label: "Simple", key: "detail", side: "low" },
  { id: "small", label: "Small print", key: "extent", side: "low" },
  { id: "full", label: "Full print", key: "extent", side: "high" },
  { id: "wide", label: "Wide format", key: "aspect", side: "high" },
];
/**
 * Feature keys that deliberately have no look tag: covered by a category or medium, too vague to name, or
 * useless as a filter ("wit" held a handful; "no text" — low typography — held most of the catalogue).
 */
export const UNTAGGED_KEYS = ["typography", "architectural", "abstract", "dark_industrial", "pictorial", "classic", "photographic", "wit"];
/** A tag's share of the catalogue past which ties at its cut are left out (many designs share a value). */
export const TAG_MAX_SHARE = 0.25;
/** Percentiles for a tag's high and low end. */
export const TAG_HIGH = 0.85;
export const TAG_LOW = 0.15;

export const MEDIUM_LABELS: Record<string, string> = { drawn: "Drawn", ink: "Archive print", photo: "Photograph" };

/** Words that ride along after an artist's name in museum records (nationality). */
export const ARTIST_SUFFIXES = ["Scottish", "Swiss", "Bohemian", "Flemish", "French", "German", "Dutch", "Italian", "English", "American", "Japanese", "Chinese", "British", "Austrian", "Spanish"];
/** Attributions before a name ("follower of …"): the name after them is the artist. */
export const ARTIST_PREFIXES = ["follower of", "style of", "signature of", "inscription and seals of", "school of", "workshop of", "circle of", "attributed to", "after"];
