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

export type ShirtSize = "S" | "M" | "L" | "XL";

export interface ShirtProduct {
  id: string;
  title: string;
  artist: string;
  price: number;
  baseColor: BaseColor;
  backImageUrl: string;
  frontImageUrl: string;
  description: string;
  features: FeatureVector;
}

/** User taste vector — same shape as product features, starts at 0.5. */
export type UserProfileVector = FeatureVector;

export type SwipeAction = "like" | "dislike";

export interface SwipeEvent {
  shirtId: string;
  action: SwipeAction;
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
