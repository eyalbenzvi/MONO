import { centeredCosine, profileSharpness, topTraits } from "@/lib/recommendation";
import { FEATURE_KEYS, createInitialVector, type FeatureKey, type UserProfileVector } from "@/types/shirt";

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
};

export const ARCHETYPE_NAMES = Object.values(ARCHETYPE);

export function archetypeOf(vector: UserProfileVector): { name: string; traits: FeatureKey[] } {
  const traits = topTraits(vector, 3);
  return { name: traits.length ? ARCHETYPE[traits[0]] : "The Open Mind", traits };
}

/* ------------------------------------------------------------------ */
/* Taste codes for links (/?taste=…)                                   */
/* ------------------------------------------------------------------ */

/** Two base-36 characters per feature (0–100, whole percent) in FEATURE_KEYS order. */
export function encodeTaste(vector: UserProfileVector): string {
  return FEATURE_KEYS.map((k) => Math.round(Math.min(1, Math.max(0, vector[k])) * 100).toString(36).padStart(2, "0")).join("");
}

export function decodeTaste(code: string | null | undefined): UserProfileVector | null {
  if (!code || code.length !== FEATURE_KEYS.length * 2 || !/^[0-9a-z]+$/.test(code)) return null;
  const v = createInitialVector();
  for (let i = 0; i < FEATURE_KEYS.length; i++) {
    const n = parseInt(code.slice(i * 2, i * 2 + 2), 36);
    if (!(n >= 0 && n <= 100)) return null;
    v[FEATURE_KEYS[i]] = n / 100;
  }
  return v;
}

/** How alike two tastes are, 0–100 (centered cosine: same leanings vs opposite). */
export function tasteOverlap(a: UserProfileVector, b: UserProfileVector): number {
  return Math.round(((centeredCosine(a, b) + 1) / 2) * 100);
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

/* ------------------------------------------------------------------ */
/* Daily 5                                                             */
/* ------------------------------------------------------------------ */

export const DAILY_GOAL = 5;

export interface Daily {
  /** Local date (YYYY-MM-DD) the count belongs to. */
  day: string;
  /** New tees swiped that day. */
  count: number;
  /** Consecutive days the goal was reached, up to `last`. */
  streak: number;
  /** Last day the goal was reached. */
  last: string | null;
}

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const prevDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return today(new Date(y, m - 1, d - 1));
};

export const emptyDaily = (): Daily => ({ day: today(), count: 0, streak: 0, last: null });

/** One more new tee swiped on `day`. The streak grows the first time a day reaches the goal. */
export function countSwipe(d: Daily, day = today()): Daily {
  const count = d.day === day ? d.count + 1 : 1;
  let { streak, last } = d;
  if (count === DAILY_GOAL && last !== day) {
    streak = last === prevDay(day) ? streak + 1 : 1;
    last = day;
  }
  return { day, count, streak, last };
}

/**
 * The streak as it stands today (broken if yesterday's goal was missed).
 * One day isn't a streak yet: it counts from the second day in a row.
 */
export function currentStreak(d: Daily, day = today()): number {
  const alive = d.last === day || d.last === prevDay(day);
  return alive && d.streak >= 2 ? d.streak : 0;
}

/* ------------------------------------------------------------------ */
/* How defined the taste profile is, in one word                       */
/* ------------------------------------------------------------------ */

export const TASTE_LEVELS = ["Sharpening", "Focused", "Dialled in"] as const;
export type TasteLevel = (typeof TASTE_LEVELS)[number];

/**
 * The one source for the level word (the strip above the card, Your taste,
 * milestones): from how far the profile has moved from neutral — never a
 * percentage or a count of swipes.
 */
export function tasteLevel(vector: UserProfileVector): TasteLevel {
  const sharp = profileSharpness(vector);
  return sharp < 0.4 ? "Sharpening" : sharp < 0.75 ? "Focused" : "Dialled in";
}
