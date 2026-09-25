/**
 * Absolute URLs for link previews. Open Graph images must be absolute, so the
 * build is told the public origin (NEXT_PUBLIC_SITE_ORIGIN, set by the Pages
 * workflow); the base path comes from NEXT_PUBLIC_BASE_PATH.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_URL = `${SITE_ORIGIN}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;

export const ogImage = (name: string) => ({ url: `${SITE_URL}/og/${name}.png`, width: 1200, height: 630 });
