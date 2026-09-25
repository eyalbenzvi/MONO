import type { Metadata } from "next";
import { ProductView } from "@/components/shop/ProductView";
import { PRERENDERED, getShirtById } from "@/lib/catalog";
import { getDetails } from "@/lib/catalogServer";
import { SITE_URL, ogImage } from "@/lib/seo";
import { CATEGORY_LABELS, COLOR_LABELS, otherColor } from "@/types/shirt";
import { formatPrice } from "@/lib/format";

export const dynamicParams = false;

/** All designs by default; NEXT_PUBLIC_PRERENDER_LIMIT keeps only the top of the rank (see README). */
export function generateStaticParams() {
  return PRERENDERED.map((s) => ({ id: s.id }));
}

/** Link previews (WhatsApp, Facebook, iMessage, X…) for each tee. */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shirt = getShirtById(params.id);
  if (!shirt) return {};
  const title = `${shirt.title} — MONO`;
  const details = getDetails(shirt.id);
  const description = `${CATEGORY_LABELS[shirt.category]} back print · ${COLOR_LABELS[shirt.baseColor]} tee (also in ${otherColor(shirt.baseColor)}) · ${formatPrice(shirt.price)}.${details ? ` ${details.description}` : ""}`;
  const url = `${SITE_URL}/shop/${shirt.id}/`;
  const image = { ...ogImage(shirt.id), alt: `${shirt.title} on a ${shirt.baseColor} tee` };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "MONO", title, description, url, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return <ProductView id={params.id} details={getDetails(params.id)} />;
}
