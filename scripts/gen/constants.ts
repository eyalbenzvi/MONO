/**
 * The catalog's shape, in one place: the generator builds from these and
 * the tests check against them (never against copied numbers).
 */
/** Designs per category (every set adds its categories at this size). */
export const PER_CATEGORY = 200;
/** Designs the first four sets generate (17 source categories): ids mono-0001 … mono-<TOTAL>, before retirement. */
export const TOTAL = 17 * PER_CATEGORY;
/** Every tee costs the same (both colourways too). */
export const PRICE = 48;
/** Designs per weekly drop (ids in order). */
export const DROP_SIZE = 40;
/** Designs per detail shard in public/data. */
export const SHARD_SIZE = 100;
