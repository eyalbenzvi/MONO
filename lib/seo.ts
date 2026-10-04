/**
 * Absolute URLs for link previews. Open Graph images must be absolute, so the
 * build is told the public origin (NEXT_PUBLIC_SITE_ORIGIN, set by the Pages
 * workflow); the base path comes from NEXT_PUBLIC_BASE_PATH.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_URL = `${SITE_ORIGIN}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;

export const ogImage = (name: string) => ({ url: `${SITE_URL}/og/${name}.jpg`, width: 1200, height: 630 });

/** The fields a product's title and description are built from (generator output). */
export interface SeoFields {
  title: string;
  subject: string;
  style: string;
  summary: string;
  baseColor: "black" | "white";
  /** The tee colours it's sold in (T3). */
  colors: ("black" | "white")[];
  price: number;
}

/**
 * A product page's text, in two places that want different things (the content review, Oct 2026):
 * search shows no picture, so the page title and meta description carry the words people search
 * (the name, the tee colour, "T-Shirt", the price); a chat app's link preview sits under the og
 * image card, which already shows the tee, the name, the category, the price, the colours and the
 * way in, so the og title is only the name and the one idea the card doesn't say ("one ink"), and the
 * og description only the design's own sentence. No subject sentence anywhere: it read as alt text
 * and ran to hundreds of characters.
 */
const TAGLINE = "Black. White. One ink. Your taste.";
/** "Black", "White", or "Black or White" (the tees it's sold in). */
const teeWords = (s: Pick<SeoFields, "colors" | "baseColor">) =>
  s.colors.length > 1 ? "Black or White" : s.colors[0] === "white" || (s.colors.length === 0 && s.baseColor === "white") ? "White" : "Black";
/** "Black tee only", "White tee, also in black". */
const teeLine = (s: Pick<SeoFields, "colors" | "baseColor">) => {
  const tee = s.baseColor === "black" ? "Black" : "White";
  return s.colors.length > 1 ? `${tee} tee, also in ${s.baseColor === "black" ? "white" : "black"}` : `${tee} tee only`;
};
const money = (price: number) => (Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`);

/** The page title (browser tab, search): "Gin Botanicals · White One-Ink T-Shirt | MONO", at most 60 characters. */
export function productTitle(s: Pick<SeoFields, "title" | "colors" | "baseColor">) {
  for (const t of [`${s.title} · ${teeWords(s)} One-Ink T-Shirt | MONO`, `${s.title} · ${teeWords(s)} T-Shirt | MONO`]) if (t.length <= 60) return t;
  return `${s.title} | MONO`;
}

/** The meta description (search): the design's sentence, the tees and the price, at most 160 characters. */
export function productDescription(s: SeoFields) {
  const tail = `${teeLine(s)} · ${money(s.price)}.`;
  const full = `${s.summary.trim()} ${tail}`;
  return s.summary.trim() && full.length <= 160 ? full : `${s.title}. ${TAGLINE} ${tail}`;
}

/** The link preview's bold line: "Gin Botanicals · One-ink tee · MONO", at most 50 characters. */
export function productOgTitle(s: Pick<SeoFields, "title">) {
  const t = `${s.title} · One-ink tee · MONO`;
  return t.length <= 50 ? t : `${s.title} · MONO`;
}

/** The link preview's line under it (where an app shows one): the design's sentence alone, or the tagline. */
export function productOgDescription(s: Pick<SeoFields, "summary">) {
  const t = s.summary.trim();
  return t && t.length <= 160 ? t : TAGLINE;
}

/** The preview image's alt text: "Gin Botanicals, printed in one ink on a white tee." */
export const productOgAlt = (s: Pick<SeoFields, "title" | "baseColor">) => `${s.title}, printed in one ink on a ${s.baseColor} tee.`;

/* ------------------------------------------------------------------ */
/* Page metadata (R22: every page states its URL and canonical)        */
/* ------------------------------------------------------------------ */

const OG_DEFAULT = { ...ogImage("default"), alt: "MONO — monochrome tees" };

/**
 * Title, description, canonical and Open Graph for a page at `path` (`og`: the link preview's own
 * title and description, when they aren't the search ones)
 * (relative to the site, e.g. "/shop/"). Open Graph in Next replaces the
 * layout's object wholesale, so the site name and image come along.
 */
export function pageMeta({ path, title, description, image = OG_DEFAULT, index = true, og }: { path: string; title: string; description: string; image?: { url: string; width: number; height: number; alt: string }; index?: boolean; og?: { title: string; description: string } }) {
  const url = `${SITE_URL}${path}`;
  // The link preview's words, when they differ from the search ones (a product page).
  const ogTitle = og?.title ?? title;
  const ogDescription = og?.description ?? description;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website" as const, siteName: "MONO", title: ogTitle, description: ogDescription, url, images: [image] },
    twitter: { card: "summary_large_image" as const, title: ogTitle, description: ogDescription, images: [image.url] },
    ...(index ? {} : { robots: { index: false } }),
  };
}

/** The client product route's title before its design is known (the page then names the design). */
export const PRODUCT_FALLBACK_TITLE = "Tee | MONO";
