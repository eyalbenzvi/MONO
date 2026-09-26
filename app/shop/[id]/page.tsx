import type { Metadata } from "next";
import { ProductView } from "@/components/shop/ProductView";
import { PRERENDERED, familyMembers, getShirtById, productHref } from "@/lib/catalog";
import { getDetails, getEntry } from "@/lib/catalogServer";
import { ORGANIZATION, SITE_URL, jsonLd, ogImage, pageMeta, productDescription, productTitle } from "@/lib/seo";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart";
import { STORE_POLICY } from "@/lib/store-policy";
import { COLORS, COLOR_LABELS, SIZES, skuFor, type ShirtProduct } from "@/types/shirt";

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

/** A year ahead, fixed per build year (prices don't change mid-year). */
const PRICE_VALID_UNTIL = `${new Date().getUTCFullYear() + 1}-12-31`;
const COUNTRIES = STORE_POLICY.countries.map(([code]) => code);

/** Shipping and returns, once per page (the offers point at them). */
const POLICIES = [
  {
    "@type": "OfferShippingDetails",
    "@id": `${SITE_URL}/#shipping`,
    shippingRate: { "@type": "MonetaryAmount", value: SHIPPING_FEE, currency: "USD" },
    shippingDestination: COUNTRIES.map((c) => ({ "@type": "DefinedRegion", addressCountry: c })),
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: STORE_POLICY.delivery.shipDays[0], maxValue: STORE_POLICY.delivery.shipDays[1], unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: STORE_POLICY.delivery.transitDays[0], maxValue: STORE_POLICY.delivery.transitDays[1], unitCode: "DAY" },
    },
    description: `Free over $${FREE_SHIPPING_THRESHOLD}`,
  },
  {
    "@type": "MerchantReturnPolicy",
    "@id": `${SITE_URL}/#returns`,
    applicableCountry: COUNTRIES,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 30,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
  },
];

/**
 * Structured data: the design as a ProductGroup varying by colour and size
 * (eight variants with their offers), the shop's policies, and a breadcrumb.
 */
function productJsonLd(shirt: ShirtProduct) {
  const entry = getEntry(shirt.id)!;
  const url = `${SITE_URL}/shop/${shirt.id}/`;
  const variants = COLORS.flatMap((color) =>
    SIZES.map((size) => ({
      "@type": "Product",
      sku: `${skuFor(shirt.sku, color)}-${size}`,
      name: `${shirt.title} — ${COLOR_LABELS[color]}, ${size}`,
      color: COLOR_LABELS[color],
      size,
      image: ogImage(shirt.id).url,
      offers: {
        "@type": "Offer",
        url: color === shirt.baseColor ? url : `${url}?c=${color}`,
        price: shirt.price.toFixed(2),
        priceCurrency: "USD",
        priceValidUntil: PRICE_VALID_UNTIL,
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        shippingDetails: { "@id": `${SITE_URL}/#shipping` },
        hasMerchantReturnPolicy: { "@id": `${SITE_URL}/#returns` },
      },
    })),
  );
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION,
      ...POLICIES,
      {
        "@type": "ProductGroup",
        "@id": `${url}#product`,
        name: shirt.title,
        description: entry.description,
        productGroupID: shirt.id,
        category: `${entry.subject} T-shirt`,
        brand: { "@type": "Brand", name: "MONO" },
        image: [ogImage(shirt.id).url, `${SITE_URL}${shirt.backPrintUrl}`],
        url,
        variesBy: ["https://schema.org/color", "https://schema.org/size"],
        hasVariant: variants,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "MONO", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop/` },
          { "@type": "ListItem", position: 3, name: shirt.title, item: url },
        ],
      },
    ],
  };
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
  return (
    <>
      {shirt && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(shirt)) }} />}
      <ProductView id={params.id} details={getDetails(params.id)} related={shirt ? relatedLinks(shirt) : undefined} />
    </>
  );
}
