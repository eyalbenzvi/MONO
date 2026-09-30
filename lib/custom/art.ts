/**
 * The landmark picker's thumbnails: each drawing (lib/custom/draw/landmarks)
 * baked at build time to a small picture (scripts/images/bakeMake.ts), so the
 * picker shows 24 of them without drawing any.
 */

/** A drawing's thumbnail ("landmarks/eiffel"), under public/. */
export const artThumbPath = (key: string) => `/img/make/art-${key.replace("/", "-")}.webp`;
/** The thumbnails' size, px (square). */
export const ART_THUMB = 160;
