import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * Paths carry the base path (/MONO on GitHub Pages). Note: crawlers only
 * read robots.txt at a host's root, so under a project path it has no
 * effect until the site has its own domain (see README); the sitemap is
 * also linked from every page.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function robots(): MetadataRoute.Robots {
  return {
    // The bag and the client-only product route have nothing to index.
    rules: [{ userAgent: "*", allow: `${BASE}/`, disallow: [`${BASE}/cart/`, `${BASE}/shop/p/`] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
