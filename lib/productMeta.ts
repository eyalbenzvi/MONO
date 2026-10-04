import type { Metadata } from "next";
import { getShirtById } from "@/lib/catalog";
import { getEntry } from "@/lib/catalogServer";
import { ogImage, pageMeta, productDescription, productOgAlt, productOgDescription, productOgTitle, productTitle } from "@/lib/seo";

/**
 * A product's page metadata: its own page (/shop/<id>/) and its short share page (/s/<n>/) carry the
 * same link preview, so a chat app shows the same card whichever address it is given; the short page
 * points its canonical at the product and stays out of search. Build time only (the full catalogue).
 */
/** A product's page metadata, for /shop/<id>/ and its short share page /s/<n>/ (server only: generateMetadata). */
export function productMetadata(id: string, { short = false }: { short?: boolean } = {}): Metadata {
  const shirt = getShirtById(id);
  const entry = getEntry(id);
  if (!shirt || !entry) return {};
  // og:type=product and product:price:* are written by the postbuild step (Next's Open Graph types have no "product").
  return pageMeta({
    path: `/shop/${shirt.id}/`,
    title: productTitle(entry),
    description: productDescription(entry),
    og: { title: productOgTitle(entry), description: productOgDescription(entry) },
    image: { ...ogImage(shirt.id), alt: productOgAlt(entry) },
    index: !short,
  });
}
