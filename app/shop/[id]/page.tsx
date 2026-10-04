import type { Metadata } from "next";
import { ProductView } from "@/components/shop/ProductView";
import { PRERENDERED, familyMembers, getShirtById, productHref } from "@/lib/catalog";
import { getDetails } from "@/lib/catalogServer";
import { productMetadata } from "@/lib/productMeta";
import type { ShirtProduct } from "@/types/shirt";

// Only the pages built exist in the export; `next dev` (which errors on false with output: "export") renders any.
export const dynamicParams = process.env.NODE_ENV !== "production";

/** All designs by default; NEXT_PUBLIC_PRERENDER_LIMIT keeps only the top of the rank (see README). */
export function generateStaticParams() {
  return PRERENDERED.map((s) => ({ id: s.id }));
}

/** Link previews (WhatsApp, Facebook, iMessage, X…) and search snippets for each tee. */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return productMetadata(params.id);
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
