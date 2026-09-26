/**
 * Ordered list of feature dimensions. Every vector in the system (product
 * features, user preference) is keyed by exactly these names, in this order.
 */
export const FEATURE_KEYS = [
  "geometric",
  "typography",
  "architectural",
  "abstract",
  "line_art",
  "halftone_raster",
  "density",
  "contrast",
  "dark_industrial",
  "clean_minimal",
  // Added with the second set of designs (pictures, captions, retro, nature):
  "pictorial",
  "wit",
  "retro",
  "nature",
  // Added with ASCII art, caricatures, famous art and iconic images:
  "figurative",
  "classic",
  // Added with the photographs (a photograph vs. a drawn print):
  "photographic",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** A vector of 0.0 – 1.0 floats keyed by feature name. */
export type FeatureVector = Record<FeatureKey, number>;

export type BaseColor = "black" | "white";

/**
 * Where a design comes from in the generator (scripts only): the generator
 * family that made it, or the archive. Kept as it was when each set was
 * made, so ids, prints and names never change; the shop groups designs by
 * ShirtCategory instead (see displayCategory in scripts/generateCatalog).
 */
export const SOURCE_CATEGORIES = [
  "architectural",
  "geometric",
  "typography",
  "halftone",
  "waves",
  // second set
  "scenes",
  "slogans",
  "pixel",
  "emblems",
  "objects",
  // third set
  "ascii",
  "caricatures",
  "famousart",
  "iconic",
  // fourth set: photographs (Smithsonian Open Access, CC0)
  "wildlife",
  "flight",
  "machines",
  // fifth set: generated from data and maths
  "sky",
  "curves",
  "botany",
  "ornament",
  // sixth set: public-domain artworks and photographs (Smithsonian Open Access, CC0)
  "archive",
] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

/**
 * The shop's categories (from the content review): what a design shows and
 * how it was made, in the order the shop lists them.
 */
export const SHIRT_CATEGORIES = [
  "ink",
  "engraved",
  "masterworks",
  "botanical",
  "wildlife",
  "archive",
  "machines",
  "architecture",
  "landscapes",
  "ornament",
  "abstract",
  "type",
  "retro",
] as const;
export type ShirtCategory = (typeof SHIRT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ShirtCategory, string> = {
  ink: "Ukiyo & Ink",
  engraved: "Engraved",
  masterworks: "Masterworks",
  botanical: "Botanical",
  wildlife: "Wildlife",
  archive: "Archive Photography",
  machines: "Flight & Machines",
  architecture: "Architecture & Cities",
  landscapes: "Landscapes & Sky",
  ornament: "Ornament & Pattern",
  abstract: "Abstract & Op Art",
  type: "Type & Emblems",
  retro: "Retro Digital",
};

/** SKU code per category: MN-<code>-<B|W>-<n>. */
export const SKU_CODES: Record<ShirtCategory, string> = {
  ink: "INK",
  engraved: "ENG",
  masterworks: "ART",
  botanical: "BOT",
  wildlife: "WLD",
  archive: "PHO",
  machines: "MCH",
  architecture: "ARC",
  landscapes: "LND",
  ornament: "ORN",
  abstract: "ABS",
  type: "TYP",
  retro: "RET",
};

/** One short line on the feel of each category. */
export const CATEGORY_VIBES: Record<ShirtCategory, string> = {
  ink: "Brush, wash and woodblock from Japan and China, in one ink.",
  engraved: "Etchings, woodcuts and engravings: lines cut by hand.",
  masterworks: "Homages to public-domain masterpieces, in one colour.",
  botanical: "Plants drawn, printed and grown by rule, like old herbarium plates.",
  wildlife: "Animals photographed and studied in motion, from the Smithsonian.",
  archive: "Old photographs from museum archives: places, machines, sky.",
  machines: "Aircraft, engines, instruments and patent models.",
  architecture: "Buildings, landmarks and cities — order you can wear.",
  landscapes: "Mountains, seas and the night sky, charted and drawn.",
  ornament: "Lace, stencils, rosettes and tiles: pattern for its own sake.",
  abstract: "Shapes, dots and curves doing very little, very well.",
  type: "Words, badges and stamps: set big, set bold, set straight.",
  retro: "Pixels and characters from the arcade and the command line.",
};

/** A photograph (Medium "photo"): never inverted for the other tee colour — that would make a negative. */
export const isPhoto = (s: { medium: Medium }) => s.medium === "photo";

/**
 * How a print is made, which decides its file and how it turns for the
 * other tee colour:
 * - drawn: a two-tone SVG, inverted exactly for the other colour;
 * - ink: a picture's marks as one ink (WebP, black ink with alpha), shown in
 *   white on a black tee;
 * - photo: a greyscale photograph (WebP), never inverted (that would be a negative).
 */
export type Medium = "drawn" | "ink" | "photo";

/** Adult sizes, then kids' sizes (by age). Stored as these codes; shown with SIZE_LABELS. */
export const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
export const KID_SIZES = ["K4", "K6", "K8", "K10", "K12"] as const;
export type ShirtSize = (typeof ADULT_SIZES)[number] | (typeof KID_SIZES)[number];
export const isKidSize = (s: ShirtSize | null | undefined) => !!s && (KID_SIZES as readonly string[]).includes(s);

/** How a size reads: "XXL", "Kids 5–6". */
export const SIZE_LABELS: Record<ShirtSize, string> = {
  XS: "XS", S: "S", M: "M", L: "L", XL: "XL", "2XL": "XXL", "3XL": "3XL",
  K4: "Kids 3–4", K6: "Kids 5–6", K8: "Kids 7–8", K10: "Kids 9–10", K12: "Kids 11–12",
};
/** The short form on a size button (the kids row is labelled "Kids", so ages only). */
export const SIZE_SHORT: Record<ShirtSize, string> = { ...SIZE_LABELS, K4: "3–4", K6: "5–6", K8: "7–8", K10: "9–10", K12: "11–12" };

/**
 * A design as the app knows it everywhere (the lean catalog index, bundled
 * with the app). Longer copy lives in ShirtDetails, fetched on demand.
 */
export interface ShirtProduct {
  id: string;
  /** Catalog number (the N in mono-000N and print_N.svg). */
  n: number;
  /** Number within its category, shown small as "No. 067". */
  no: number;
  sku: string;
  /** Display name, without a number (the number is `no`, and part of the SKU). */
  title: string;
  price: number;
  /** Tee colour. Prints are single-ink: white ink on black tees, black ink on white. */
  baseColor: BaseColor;
  /** 3:4 monochrome print, relative to the site root: two-tone SVG (/prints/print_1.svg), or WebP (ink or photograph). */
  backPrintUrl: string;
  category: ShirtCategory;
  /** How the print is made (see Medium). */
  medium: Medium;
  /**
   * The tee colours it's sold in, the original first (T3): both for most;
   * one for a design that doesn't work on the other (see offeredColors in
   * scripts/generateCatalog).
   */
  colors: BaseColor[];
  /** Algorithm within the category (e.g. "facade", "ridges"). */
  variant: string;
  /**
   * Design family: near-identical prints (same algorithm, close parameters).
   * Discover and the shop show one design per family; the rest are offered
   * as variations on the product page.
   */
  family: string;
  features: FeatureVector;
  /** Editorial rank (0 = first) from the generator: the order of the "Popular" sort. */
  rank: number;
  /** The day the design dropped (UTC midnight, ms): "New this week" for seven days after. */
  dropDate: number;
  /** A weak print (a lone small shape): kept out of the taste test and the top of the shop. */
  weak: boolean;
}

/** Longer copy and precomputed neighbours, loaded on demand (public/data shards). */
export interface ShirtDetails {
  description: string;
  /** Similar prints from other families, one per algorithm, closest first. */
  similar: string[];
  /** What the print shows ("Solar Eclipse"). */
  subject?: string;
  /** The print's real size on the tee (its ink), cm. */
  printCm?: { width: number; height: number };
  /** Photographs: who took it and the museum record it comes from. */
  photo?: PhotoCredit;
}

/** Where a photograph comes from (Smithsonian Open Access, CC0). */
export interface PhotoCredit {
  /** "Roshan Patel, Smithsonian's National Zoo". */
  credit: string;
  /** The Smithsonian collection record. */
  url: string;
  /** The Smithsonian image id (data/photos/img/<image>.png); full catalog only. */
  image?: string;
}

/** Full catalog entry (generator output, server-side and tests). */
export type CatalogEntry = Omit<ShirtProduct, "dropDate" | "weak"> &
  Required<Omit<ShirtDetails, "photo">> & Pick<ShirtDetails, "photo"> & {
    /** The design's own sentence (without the closing line): meta descriptions. */
    summary: string;
    /** The print style for the SEO title ("Line-Art"). */
    style: string;
    /** 0–100 (see generateCatalog: coverage, extent, detail). */
    quality: number;
    /** YYYY-MM-DD. */
    dropDate: string;
  };

/** User taste vector — same shape as product features, starts at 0.5. */
export type UserProfileVector = FeatureVector;

export type SwipeAction = "like" | "dislike";

export interface SwipeEvent {
  shirtId: string;
  action: SwipeAction;
  /** "swipe" from Discover, "shop" when saved with the heart in the shop. */
  source: "swipe" | "shop";
  /** Match score (0–100) the card showed at the time of the swipe. */
  matchScore: number;
  strategy: RecommendationStrategy;
  timestamp: number;
}

export type RecommendationStrategy = "calibration" | "greedy" | "explore";

/** The printed area on the tee (the 3:4 print, as screen-printed). */
export const PRINT_SIZE_CM = { width: 28, height: 37 } as const;

/** "28 × 37 cm" — the print's real size on the tee. */
export const printSizeLabel = (cm: { width: number; height: number } = PRINT_SIZE_CM) => `${cm.width} × ${cm.height} cm`;

/** Garment measurements, cm (chest is half the width, laid flat). Kids' prints are scaled to 20 × 26 cm. */
export const SIZE_GUIDE: Record<ShirtSize, { chest: number; length: number }> = {
  XS: { chest: 47, length: 68 },
  S: { chest: 50, length: 70 },
  M: { chest: 53, length: 72 },
  L: { chest: 56, length: 74 },
  XL: { chest: 59, length: 76 },
  "2XL": { chest: 62, length: 78 },
  "3XL": { chest: 65, length: 80 },
  K4: { chest: 32, length: 43 },
  K6: { chest: 35, length: 48 },
  K8: { chest: 38, length: 53 },
  K10: { chest: 41, length: 58 },
  K12: { chest: 44, length: 63 },
};

export const SIZES: readonly ShirtSize[] = [...ADULT_SIZES, ...KID_SIZES];

export interface CartItem {
  id: string;
  size: ShirtSize;
  /** Tee colour chosen at purchase — every design comes in black and white. */
  color: BaseColor;
  qty: number;
}

export const COLOR_LABELS: Record<BaseColor, string> = { black: "Black", white: "White" };
export const COLORS: readonly BaseColor[] = ["black", "white"];

/** Whether a design is sold in `color`. */
export const offers = (s: Pick<ShirtProduct, "colors">, color: BaseColor) => s.colors.includes(color);
/** The colour to show or sell: `color` if the design comes in it, else its original. */
export const teeColor = (s: Pick<ShirtProduct, "colors" | "baseColor">, color?: BaseColor | null): BaseColor => (color && offers(s, color) ? color : s.baseColor);

export const otherColor = (c: BaseColor): BaseColor => (c === "black" ? "white" : "black");

/**
 * SKU for a colourway. The catalog SKU encodes the original colour
 * (MN-GEO-B-0001); the reverse colourway swaps that letter.
 */
export const skuFor = (sku: string, color: BaseColor) =>
  sku.replace(/-[BW]-/, `-${color === "black" ? "B" : "W"}-`);

/**
 * What's kept of an order on this device (the bag's "last order"): no name,
 * email or address — just the number, the items and the money.
 */
export interface OrderRecord {
  number: string;
  items: CartItem[];
  subtotal: number;
  /** Pair discount (black + white of one print), if any. */
  discount?: number;
  shipping: number;
  total: number;
  placedAt: number;
}

/** Delivery details from the checkout form (held in memory only). */
export interface Customer {
  name: string;
  email: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

/** A just-placed order, as the confirmation screen sees it (not persisted). */
export interface Order extends OrderRecord {
  customer: Customer;
  /** Estimated arrival window (timestamps, start of day). */
  arrives: { from: number; to: number };
}

export const createInitialVector = (value = 0.5): UserProfileVector =>
  FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as UserProfileVector);

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  geometric: "Geometric",
  typography: "Typography",
  architectural: "Architectural",
  abstract: "Abstract",
  line_art: "Line Art",
  halftone_raster: "Halftone",
  density: "Density",
  contrast: "Contrast",
  dark_industrial: "Industrial",
  clean_minimal: "Minimal",
  pictorial: "Pictorial",
  wit: "Witty",
  retro: "Retro",
  nature: "Nature",
  figurative: "Figurative",
  classic: "Classic Art",
  photographic: "Photographic",
};
