/**
 * Your Journey: the places you've been, in order (2–8 cities of the place
 * list, data/cities, by GeoNames id) and optional words. Drawn by
 * lib/custom/templates/journey.
 */
import { int, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The stops, in order: GeoNames ids (data/cities). The same city may come back, never twice in a row. */
  c: number[];
  w?: string;
}

export const NAME = "Your Journey";
export const JOURNEY_MIN = 2;
export const JOURNEY_MAX = 8;

/** Why this list of stops can't be a journey (one line), or null. */
export function journeyProblem(ids: readonly number[]): string | null {
  if (ids.length < JOURNEY_MIN) return "Add at least two places";
  if (ids.length > JOURNEY_MAX) return `Up to ${JOURNEY_MAX} places`;
  return ids.some((id, i) => i > 0 && ids[i - 1] === id) ? "The same place twice in a row" : null;
}

export function check(p: Record<string, unknown>, ctx: CheckContext): Params | null {
  const c = p.c;
  if (!Array.isArray(c) || !c.every((id) => int(id, 1, 0xffffffff)) || journeyProblem(c as number[])) return null;
  if (ctx.cityById && !c.every((id) => ctx.cityById!(id as number))) return null;
  const words = wordsOf(p);
  if (!words) return null;
  return { c: [...(c as number[])], ...words };
}

export const detail = (p: Params) => p.w ?? `${p.c.length} places`;

export const PRODUCT: ProductMeta<Params> = {
  line: "The places you've been, joined on a globe in the order you went.",
  from: "Two to eight places",
  group: "place",
  base: "daylight",
  bases: ["daylight", "analemma"],
  wordsHint: "The long way home",
  // Tel Aviv, Rome, London, New York (GeoNames ids).
  example: { c: [293397, 3169070, 2643743, 5128581], w: "The long way home" },
  hints: { dense: "Try shorter words, or fewer places.", faint: "Try places further apart." },
};
