/**
 * Your Taste's spec: the taste vector quantised to 0–10 per axis and written
 * as one base-36 digit each, in FEATURE_KEYS order (17 characters). Near
 * tastes give the same plant, and the link stays short.
 */
import { FEATURE_KEYS, type FeatureKey } from "@/types/shirt";
import { clamp01 } from "@/lib/math";

export const tasteQ = (vector: Partial<Record<FeatureKey, number>>) =>
  FEATURE_KEYS.map((k) => Math.round(clamp01(vector[k] ?? 0.5) * 10).toString(36)).join("");

/** The vector a spec's `q` stands for (each axis back to 0–1, in tenths). */
export const tasteFromQ = (q: string): Record<FeatureKey, number> =>
  Object.fromEntries(FEATURE_KEYS.map((k, i) => [k, parseInt(q[i] ?? "5", 36) / 10])) as Record<FeatureKey, number>;
