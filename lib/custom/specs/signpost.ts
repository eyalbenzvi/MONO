/**
 * Your Signpost: home, and up to SIGNPOST_MAX places, each on a board with
 * its real distance along the great circle and an arrow at its true bearing
 * from home; or, "since", two cities, the distance between them and a year.
 * Cities of data/cities by GeoNames id. Drawn by lib/custom/templates/signpost.
 */
import { FIRST_YEAR, LAST_YEAR, int, unpackPlaces, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** "since": two cities and a year (absent: home and its places). */
  k?: "since";
  /** Home (or the first of the two). */
  h: number;
  /** The places, packed (specKit packPlaces, no years): 1–SIGNPOST_MAX, or exactly one "since". */
  x: string;
  /** The year ("since" only). */
  y?: number;
  /** 1: miles (else kilometres). */
  mi?: 1;
  cap?: Cap;
}

export const NAME = "Your Signpost";
export const SIGNPOST_MAX = 6;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, ctx: CheckContext): Params | null {
  if (!int(p.h, 1, 0xffffffff) || (ctx.cityById && !ctx.cityById(p.h as number))) return null;
  const since = p.k === "since";
  if (p.k !== undefined && !since) return null;
  const rows = unpackPlaces(p.x, { min: 1, max: since ? 1 : SIGNPOST_MAX, years: false }, ctx.cityById);
  if (!rows || rows.some((r) => r.c === p.h) || new Set(rows.map((r) => r.c)).size !== rows.length) return null;
  if (since ? !int(p.y, FIRST_YEAR, LAST_YEAR) : p.y !== undefined) return null;
  if (p.mi !== undefined && p.mi !== 1) return null;
  return { ...(since ? { k: "since" as const } : {}), h: p.h as number, x: p.x as string, ...(since ? { y: p.y as number } : {}), ...(p.mi === 1 ? { mi: 1 as const } : {}) };
}

export const detail = (p: Params) => (p.k === "since" ? `Since ${p.y}` : "From home");

export const PRODUCT: ProductMeta<Params> = {
  line: "A signpost from home to the places that matter, at their real distances.",
  from: "Home and your places",
  group: "travels",
  base: "celestial",
  bases: ["celestial", "contours"],
  hints: { dense: "Try fewer places.", faint: "Try another place or two." },
  // Tel Aviv, and London, New York, Tokyo, Sydney (data/cities GeoNames ids), packed.
  example: { h: 293397, x: "vtzCAgCKhvIEAMbs4QEAhJaGAgA" },
};
