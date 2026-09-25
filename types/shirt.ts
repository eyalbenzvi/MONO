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
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** A vector of 0.0 – 1.0 floats keyed by feature name. */
export type FeatureVector = Record<FeatureKey, number>;

export type BaseColor = "black" | "white";

/**
 * Dominant tone of the artwork. Prints are single-ink monochrome, so the tee
 * colour follows the art: a dark artwork is printed in white ink on a black
 * tee (its blacks become the fabric), a light artwork in black ink on white.
 */
export type ArtTone = "dark" | "light";

export const teeColorForTone = (tone: ArtTone): BaseColor => (tone === "dark" ? "black" : "white");

export type ShirtSize = "S" | "M" | "L" | "XL";

export interface ShirtProduct {
  id: string;
  title: string;
  artist: string;
  price: number;
  /** Derived from artTone — see teeColorForTone. */
  baseColor: BaseColor;
  artTone: ArtTone;
  /** The only print on the product: a 3:4 rectangle on the back. Front is plain. */
  backImageUrl: string;
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
  qty: number;
}

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
};
