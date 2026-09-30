import { topTraits } from "@/lib/recommendation";
import { FEATURE_KEYS, createInitialVector, type FeatureKey, type UserProfileVector } from "@/types/shirt";
import { clamp01 } from "@/lib/math";

/**
 * A name for a taste profile, from its strongest trait (then the second, to
 * split ties). Deterministic, and never the same as a caricature character
 * name (those are "The Barista", "The Artist"…; see tests).
 */
const ARCHETYPE: Record<FeatureKey, string> = {
  geometric: "The Geometer",
  typography: "The Typesetter",
  architectural: "The Brutalist",
  abstract: "The Abstractionist",
  line_art: "The Draughtsman",
  halftone_raster: "The Printmaker",
  density: "The Maximalist",
  contrast: "The Sharp Edge",
  dark_industrial: "The Industrialist",
  clean_minimal: "The Minimalist",
  pictorial: "The Storyteller",
  wit: "The Deadpan",
  retro: "The Retrofuturist",
  nature: "The Wanderer",
  figurative: "The Portraitist",
  classic: "The Curator",
  photographic: "The Documentarian",
};

export const ARCHETYPE_NAMES = Object.values(ARCHETYPE);

/**
 * Each trait in words, the one wording people see (the stylist note, Why and
 * Because lines, the reveal, Your taste, a friend's comparison): never the
 * engine's own labels ("Halftone", "Density").
 */
export const TRAIT_WORDS: Record<FeatureKey, string> = {
  geometric: "geometric shapes",
  typography: "lettering",
  architectural: "architecture",
  abstract: "abstract forms",
  line_art: "line drawings",
  halftone_raster: "printed-dot textures",
  density: "dense prints",
  contrast: "high contrast",
  dark_industrial: "industrial subjects",
  clean_minimal: "minimal prints",
  pictorial: "scenes",
  wit: "wit",
  retro: "retro",
  nature: "nature",
  figurative: "figures",
  classic: "classic art",
  photographic: "photographs",
};

/** Traits in words, as a list: "dense prints, nature" (`sep` between them). */
export const traitWords = (keys: readonly FeatureKey[], sep = ", ") => keys.map((k) => TRAIT_WORDS[k]).join(sep);

/** The same list, first letter up: "Dense prints · nature". */
export const traitLine = (keys: readonly FeatureKey[]) => {
  const s = traitWords(keys, " · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * How a trait reads inside the taste's one sentence: most as a word before
 * "prints" ("dense, high-contrast prints"), some as a phrase after it
 * ("drawn from nature"). The sentence's words, not a second list of labels.
 */
const SENTENCE: Record<FeatureKey, { before: string } | { after: string }> = {
  geometric: { before: "geometric" },
  typography: { after: "built on lettering" },
  architectural: { before: "architectural" },
  abstract: { before: "abstract" },
  line_art: { before: "line-drawn" },
  halftone_raster: { after: "in printed dots" },
  density: { before: "dense" },
  contrast: { before: "high-contrast" },
  dark_industrial: { before: "industrial" },
  clean_minimal: { before: "minimal" },
  pictorial: { before: "pictorial" },
  wit: { after: "with a sense of humour" },
  retro: { before: "retro" },
  nature: { after: "drawn from nature" },
  figurative: { before: "figurative" },
  classic: { after: "from the classic archive" },
  photographic: { after: "made from photographs" },
};

/**
 * The taste in one sentence, from its strongest traits (up to three):
 * "Dense, high-contrast prints drawn from nature."
 */
export function tasteSentence(vector: UserProfileVector): string {
  const traits = topTraits(vector, 3);
  if (!traits.length) return "Open to anything, for now.";
  const before = traits.flatMap((k) => ("before" in SENTENCE[k] ? [(SENTENCE[k] as { before: string }).before] : []));
  const after = traits.flatMap((k) => ("after" in SENTENCE[k] ? [(SENTENCE[k] as { after: string }).after] : []));
  const s = `${before.join(", ")}${before.length ? " prints" : "Prints"}${after.length ? ` ${after.join(" and ")}` : ""}.`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The traits two tastes both lean to (strongest of yours first), up to three. */
export function sharedTraits(a: UserProfileVector, b: UserProfileVector): FeatureKey[] {
  const theirs = topTraits(b, 5);
  return topTraits(a, 5).filter((k) => theirs.includes(k)).slice(0, 3);
}

/**
 * The one stylist note during the taste test ("Noted: dense prints"): the
 * trait the answers so far lean to most, only when the lean is clear.
 */
export const NOTE_MIN = 0.62;
export function noteOf(vector: UserProfileVector): string | null {
  const [k] = topTraits(vector, 1);
  return k && vector[k] >= NOTE_MIN ? `Noted: ${TRAIT_WORDS[k]}` : null;
}

export function archetypeOf(vector: UserProfileVector): { name: string; traits: FeatureKey[] } {
  const traits = topTraits(vector, 3);
  return { name: traits.length ? ARCHETYPE[traits[0]] : "The Open Mind", traits };
}

/* ------------------------------------------------------------------ */
/* Taste codes for links (/?taste=…)                                   */
/* ------------------------------------------------------------------ */

/**
 * Two base-36 characters per feature (0–100, whole percent) in FEATURE_KEYS
 * order. Codes from before a dimension was added are shorter: the features
 * they don't carry read as neutral (0.5), so old links keep working.
 */
export function encodeTaste(vector: UserProfileVector): string {
  return FEATURE_KEYS.map((k) => Math.round(clamp01(vector[k]) * 100).toString(36).padStart(2, "0")).join("");
}

/** Code lengths of earlier builds: 16 features (before "photographic"). */
const LEGACY_CODE_LENGTHS = [32];

export function decodeTaste(code: string | null | undefined): UserProfileVector | null {
  if (!code || !LEGACY_CODE_LENGTHS.concat(FEATURE_KEYS.length * 2).includes(code.length) || !/^[0-9a-z]+$/.test(code)) return null;
  const v = createInitialVector();
  for (let i = 0; i < code.length / 2; i++) {
    const n = parseInt(code.slice(i * 2, i * 2 + 2), 36);
    if (!(n >= 0 && n <= 100)) return null;
    v[FEATURE_KEYS[i]] = n / 100;
  }
  return v;
}

/* ------------------------------------------------------------------ */
/* Drops                                                               */
/* ------------------------------------------------------------------ */

const WEEK = 7 * 86_400_000;

/**
 * The newest drop date in a list of designs. A plain loop: spreading a large
 * catalog into Math.max(...) overflows the argument limit (Safari: ~65k).
 */
export function latestDrop(shirts: readonly { dropDate: number }[]): number {
  let max = 0;
  for (const s of shirts) if (s.dropDate > max) max = s.dropDate;
  return max;
}

/**
 * "New this week" only while it's true: for the seven days after the
 * design's drop date, measured when the page is viewed (client-side; a
 * weekly rebuild refreshes the pre-rendered pages). No invented urgency.
 */
export const isNew = (dropDate: number, now = Date.now()) => now >= dropDate && now < dropDate + WEEK;
