import type { Metadata } from "next";
import { ProductView } from "@/components/shop/ProductView";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { SITE_URL, ogImage } from "@/lib/seo";
import { CATEGORY_LABELS, COLOR_LABELS, otherColor } from "@/types/shirt";
import { formatPrice } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return SHIRTS.map((s) => ({ id: s.id }));
}

/** Link previews (WhatsApp, Facebook, iMessage, X…) for each tee. */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shirt = getShirtById(params.id);
  if (!shirt) return {};
  const title = `${shirt.title} — MONO`;
  const description = `${CATEGORY_LABELS[shirt.category]} back print · ${COLOR_LABELS[shirt.baseColor]} tee (also in ${otherColor(shirt.baseColor)}) · ${formatPrice(shirt.price)}. ${shirt.description}`;
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
  return <ProductView id={params.id} />;
}
