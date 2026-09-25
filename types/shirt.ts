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
  // Added with the second 1,000 designs (pictures, captions, retro, nature):
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

/** Generative family a print was made with (see scripts/generate1000Shirts.ts). */
export const SHIRT_CATEGORIES = [
  "architectural",
  "geometric",
  "typography",
  "halftone",
  "waves",
  // second 1,000
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

export interface ShirtProduct {
  id: string;
  sku: string;
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
  description: string;
  features: FeatureVector;
}

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

export const otherColor = (c: BaseColor): BaseColor => (c === "black" ? "white" : "black");

/**
 * SKU for a colourway. The catalog SKU encodes the original colour
 * (MN-GEO-B-0001); the reverse colourway swaps that letter.
 */
export const skuFor = (sku: string, color: BaseColor) =>
  sku.replace(/-[BW]-/, `-${color === "black" ? "B" : "W"}-`);

export interface Order {
  number: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  name: string;
  email: string;
  placedAt: number;
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
