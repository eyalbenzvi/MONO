import type { MetadataRoute } from "next";
import { PRERENDERED } from "@/lib/catalog";
import { SITE_URL } from "@/lib/seo";

// Written once at build time (static export).
export const dynamic = "force-static";

/** Home, shop, and every pre-rendered product page. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/shop/`, changeFrequency: "weekly", priority: 0.9 },
    ...PRERENDERED.map((s) => ({ url: `${SITE_URL}/shop/${s.id}/`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
