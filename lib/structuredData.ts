/**
 * Structured data (schema.org JSON-LD) for the static pages. Written into
 * the exported HTML by scripts/tools/postbuild.ts — not rendered by React,
 * so it isn't repeated in each page's React payload.
 */
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart";
import { SITE_URL, ogImage } from "@/lib/seo";
import { STORE_POLICY } from "@/lib/store-policy";
import { COLORS, COLOR_LABELS, SIZES, SIZE_LABELS, skuFor, type CatalogEntry } from "@/types/shirt";

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: "MONO",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icon.svg`,
};

/** Home: who we are, and the site. */
export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [ORGANIZATION, { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: "MONO", url: `${SITE_URL}/`, publisher: { "@id": ORGANIZATION["@id"] } }],
  };
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
 * (every colour × size with its offer; name, image and brand live on the
 * group), the shop's policies, and a breadcrumb.
 */
export function productJsonLd(shirt: CatalogEntry) {
  const entry = shirt;
  const url = `${SITE_URL}/shop/${shirt.id}/`;
  // Only the colours it's sold in (T3).
  const variants = COLORS.filter((c) => shirt.colors.includes(c)).flatMap((color) =>
    SIZES.map((size) => ({
      "@type": "Product",
      sku: `${skuFor(shirt.sku, color)}-${size}`,
      name: `${shirt.title} — ${COLOR_LABELS[color]}, ${SIZE_LABELS[size]}`,
      color: COLOR_LABELS[color],
      size,
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


/** JSON inside a <script> tag: escape "<" so no string can close it. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
