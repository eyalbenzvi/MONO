import type { Metadata } from "next";
import { ProductView } from "@/components/shop/ProductView";
import { PRERENDERED, familyMembers, getShirtById, productHref } from "@/lib/catalog";
import { getDetails, getEntry } from "@/lib/catalogServer";
import { ogImage, pageMeta, productDescription, productTitle } from "@/lib/seo";
import type { ShirtProduct } from "@/types/shirt";

export const dynamicParams = false;

/** All designs by default; NEXT_PUBLIC_PRERENDER_LIMIT keeps only the top of the rank (see README). */
export function generateStaticParams() {
  return PRERENDERED.map((s) => ({ id: s.id }));
}

/** Link previews (WhatsApp, Facebook, iMessage, X…) and search snippets for each tee. */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shirt = getShirtById(params.id);
  const entry = getEntry(params.id);
  if (!shirt || !entry) return {};
  // og:type=product and product:price:* are written by the postbuild step
  // (Next's Open Graph types have no "product").
  return pageMeta({
    path: `/shop/${shirt.id}/`,
    title: productTitle(entry),
    description: productDescription(entry),
    image: { ...ogImage(shirt.id), alt: `${shirt.title} on a ${shirt.baseColor} tee` },
  });
}

/**
 * Links in the pre-rendered HTML (R08): up to four variations and four
 * "more like this", so crawlers — and visitors without JavaScript — can
 * move on from any product.
 */
function relatedLinks(shirt: ShirtProduct) {
  const variations = familyMembers(shirt).filter((s) => s.id !== shirt.id).slice(0, 4);
  const similar = (getDetails(shirt.id)?.similar ?? []).map(getShirtById).filter((s): s is ShirtProduct => !!s).slice(0, 4);
  const link = (s: ShirtProduct) => ({ href: productHref(s.id), title: s.title });
  return { variations: variations.map(link), similar: similar.map(link) };
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const shirt = getShirtById(params.id);
  // Structured data is written into the HTML after the build (scripts/tools/postbuild.ts),
  // so it isn't repeated in the page's React payload.
  return <ProductView id={params.id} details={getDetails(params.id)} related={shirt ? relatedLinks(shirt) : undefined} />;
}
