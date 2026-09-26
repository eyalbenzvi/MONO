/**
 * The catalog's shape, in one place: the generator builds from these and
 * the tests check against them (never against copied numbers).
 */
import { SHIRT_CATEGORIES } from "../../types/shirt";

/** Designs per category (every set adds its categories at this size). */
export const PER_CATEGORY = 200;
/** All designs: ids mono-0001 … mono-<TOTAL>. */
export const TOTAL = SHIRT_CATEGORIES.length * PER_CATEGORY;
/** Every tee costs the same (both colourways too). */
export const PRICE = 48;
/** Designs per weekly drop (ids in order). */
export const DROP_SIZE = 40;
/** Designs per detail shard in public/data. */
export const SHARD_SIZE = 100;
