/**
 * Your World Tour: a band tour's shirt for a life. "NOA · WORLD TOUR ·
 * 1990–2026", then the cities and their years, 4 to TOUR_MAX, in two columns
 * down the back. The title is one of ours or the visitor's. Cities of
 * data/cities by GeoNames id. Drawn by lib/custom/templates/tour.
 */
import { label, unpackPlaces, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** Whose tour ("Noa"). */
  n: string;
  /** The tour ("World Tour"): one of TOUR_TITLES or the visitor's. */
  t: string;
  /** The dates: packed places with their years (specKit packPlaces), TOUR_MIN to TOUR_MAX. */
  x: string;
  cap?: Cap;
}

export const NAME = "Your World Tour";
export const TOUR_MIN = 4;
export const TOUR_MAX = 24;
export const TOUR_NAME_MAX = 14;
export const TOUR_TITLE_MAX = 18;
export const TOUR_TITLES = ["World Tour", "Family Tour", "Farewell Tour", "Reunion Tour", "Tour of Duty", "Comeback Tour"] as const;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, ctx: CheckContext): Params | null {
  if (!label(p.n, TOUR_NAME_MAX) || !label(p.t, TOUR_TITLE_MAX)) return null;
  const rows = unpackPlaces(p.x, { min: TOUR_MIN, max: TOUR_MAX }, ctx.cityById);
  if (!rows) return null;
  return { n: p.n as string, t: p.t as string, x: p.x as string };
}

export const detail = (p: Params) => `${p.n} · ${p.t}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "The tour tee for the places you’ve lived, with the dates on the back.",
  from: "Your places and years",
  group: "travels",
  base: "poster",
  bases: ["poster", "type-data"],
  wordsHint: "Noa",
  hints: { dense: "Try fewer dates.", faint: "Try another date or two." },
  // Tel Aviv, London, Paris, New York, Tokyo and home again (data/cities GeoNames ids), packed.
  example: { n: "Noa", t: "World Tour", x: "qugjtgG-3MIC2gG25-wC4AGKhvIE5gHG7OEB8AGq6CP4AQ" },
};
