/**
 * Absolute URLs for link previews. Open Graph images must be absolute, so the
 * build is told the public origin (NEXT_PUBLIC_SITE_ORIGIN, set by the Pages
 * workflow); the base path comes from NEXT_PUBLIC_BASE_PATH.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_URL = `${SITE_ORIGIN}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;

export const ogImage = (name: string) => ({ url: `${SITE_URL}/og/${name}.png`, width: 1200, height: 630 });

/** The fields a product's title and description are built from (generator output). */
export interface SeoFields {
  title: string;
  subject: string;
  style: string;
  summary: string;
  baseColor: "black" | "white";
  price: number;
}

/**
 * The product page's title: the name, then what the print actually shows
 * ("Northern Pines — Solar Eclipse Line-Art Tee | MONO"). The style is left
 * out when the subject already says it ("ASCII Rocket").
 */
/** Subjects that already name their kind of print ("ASCII Sphere", "Great Wave Homage"). */
const SAYS_ITS_KIND = /\b(ascii|homage|poster|icon|sprite|sign|badge|crest|stamp|label|receipt|quote|caricature|mugshot|bobblehead|linocut|diagram|banner|wordmark|repeat|halftone|dot-matrix|stub|screen|session)\b/i;

export function productTitle(s: Pick<SeoFields, "title" | "subject" | "style">) {
  const styleWord = s.style.split("-")[0].toLowerCase();
  const kind = s.subject.toLowerCase().includes(styleWord) || SAYS_ITS_KIND.test(s.subject) ? s.subject : `${s.subject} ${s.style}`;
  return `${s.title} — ${kind} Tee | MONO`;
}

/**
 * Its meta description: the name and subject, the design's own sentence,
 * the tee and the price. Unique per design (the name is), with no stock
 * sentence repeated across the catalog.
 */
export function productDescription(s: SeoFields) {
  const other = s.baseColor === "black" ? "white" : "black";
  const price = Number.isInteger(s.price) ? `$${s.price}` : `$${s.price.toFixed(2)}`;
  return `${s.title}: ${s.subject}. ${s.summary} ${s.baseColor === "black" ? "Black" : "White"} tee, also in ${other} · ${price}.`;
}
