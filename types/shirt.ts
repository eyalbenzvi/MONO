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
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** A vector of 0.0 – 1.0 floats keyed by feature name. */
export type FeatureVector = Record<FeatureKey, number>;

export type BaseColor = "black" | "white";

/** Generative category a print belongs to (see scripts/generateCatalog.ts). */
export const SHIRT_CATEGORIES = [
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
] as const;
export type ShirtCategory = (typeof SHIRT_CATEGORIES)[number];

/** SKU code per category: MN-<code>-<B|W>-<n>. */
export const SKU_CODES: Record<ShirtCategory, string> = {
  architectural: "ARC",
  geometric: "GEO",
  typography: "TYP",
  halftone: "HLF",
  waves: "WAV",
  scenes: "SCN",
  slogans: "SLG",
  pixel: "PIX",
  emblems: "EMB",
  objects: "OBJ",
  ascii: "ASC",
  caricatures: "CAR",
  famousart: "ART",
  iconic: "ICN",
};

/** One short line on the feel of each category (product page). */
export const CATEGORY_VIBES: Record<ShirtCategory, string> = {
  architectural: "Concrete, grids and cantilevers — order you can wear.",
  geometric: "Pure shapes doing very little, very well.",
  typography: "Words as objects: set big, set bold, set straight.",
  halftone: "Dots doing the work of greys, like a press sheet up close.",
  waves: "Lines that drift, ripple and refuse to sit still.",
  scenes: "Quiet landscapes printed like a screen print on a gallery wall.",
  slogans: "Deadpan statements for people who mean it (mostly).",
  pixel: "Low-res nostalgia, from the arcade and the command line.",
  emblems: "Badges, crests and stamps for clubs that don't exist.",
  objects: "Everyday things, drawn with more care than they asked for.",
  ascii: "Pictures made of characters, straight out of a terminal.",
  caricatures: "Invented characters, lovingly exaggerated — nobody real.",
  famousart: "Homages to public-domain masterpieces, in one colour.",
  iconic: "Landmarks, space age and symbols, drawn from scratch.",
};

export const CATEGORY_LABELS: Record<ShirtCategory, string> = {
  architectural: "Architectural",
  geometric: "Geometric",
  typography: "Typography",
  halftone: "Halftone",
  waves: "Line & Wave",
  scenes: "Scenes",
  slogans: "Slogans",
  pixel: "Pixel & Retro",
  emblems: "Badges",
  objects: "Objects",
  ascii: "ASCII Art",
  caricatures: "Caricatures",
  famousart: "Famous Art",
  iconic: "Iconic Images",
};

export type ShirtSize = "S" | "M" | "L" | "XL";

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
  /** 3:4 monochrome SVG print, relative to the site root (e.g. /prints/print_1.svg). */
  backPrintUrl: string;
  category: ShirtCategory;
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
  /** The weekly drop a design was released in (the latest drop is "new this week"). */
  dropWeek: number;
}

/** Longer copy and precomputed neighbours, loaded on demand (public/data shards). */
export interface ShirtDetails {
  description: string;
  /** Similar prints from other families, one per algorithm, closest first. */
  similar: string[];
}

/** Full catalog entry (generator output, server-side and tests). */
export type CatalogEntry = ShirtProduct & ShirtDetails;

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

export interface UserSession {
  likedIds: string[];
  dislikedIds: string[];
  preferenceVector: UserProfileVector;
  swipeHistory: SwipeEvent[];
}

export const PRINT_SIZE_CM = { width: 30, height: 40 } as const;

export const SIZE_GUIDE: Record<ShirtSize, { chest: number; length: number }> = {
  S: { chest: 50, length: 70 },
  M: { chest: 53, length: 72 },
  L: { chest: 56, length: 74 },
  XL: { chest: 59, length: 76 },
};

export const SIZES: ShirtSize[] = ["S", "M", "L", "XL"];

export interface CartItem {
  id: string;
  size: ShirtSize;
  /** Tee colour chosen at purchase — every design comes in black and white. */
  color: BaseColor;
  qty: number;
}

export const COLOR_LABELS: Record<BaseColor, string> = { black: "Black", white: "White" };
export const COLORS: readonly BaseColor[] = ["black", "white"];

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
};
