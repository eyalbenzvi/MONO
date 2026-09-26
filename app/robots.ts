import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // The bag and the client-only product route have nothing to index.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/cart/", "/shop/p/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
