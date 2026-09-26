import type { Metadata } from "next";
import { ProductView } from "@/components/shop/ProductView";
import { PRERENDERED, getShirtById } from "@/lib/catalog";
import { getDetails, getEntry } from "@/lib/catalogServer";
import { SITE_URL, ogImage, productDescription, productTitle } from "@/lib/seo";
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
  const entry = getEntry(params.id);
  if (!shirt || !entry) return {};
  const title = productTitle(entry);
  const description = productDescription(entry);
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

/** Structured data for search engines: the tee as a Product with its Offer. */
function productJsonLd(id: string) {
  const shirt = getShirtById(id);
  if (!shirt) return null;
  const details = getDetails(id);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: shirt.title,
    description: details?.description,
    sku: shirt.sku,
    category: `${CATEGORY_LABELS[shirt.category]} T-shirt`,
    color: COLOR_LABELS[shirt.baseColor],
    brand: { "@type": "Brand", name: "MONO" },
    image: [ogImage(shirt.id).url, `${SITE_URL}${shirt.backPrintUrl}`],
    url: `${SITE_URL}/shop/${shirt.id}/`,
    offers: {
      "@type": "Offer",
      price: shirt.price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/shop/${shirt.id}/`,
    },
  };
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const ld = productJsonLd(params.id);
  return (
    <>
      {ld && (
        // JSON inside a script tag: escape "<" so no string can close it.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      )}
      <ProductView id={params.id} details={getDetails(params.id)} />
    </>
  );
}
