// On GitHub Pages the site is served from /<repo>/, so the deploy workflow
// sets NEXT_PUBLIC_BASE_PATH (e.g. "/MONO"). Locally it is empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Absolute URLs (Open Graph, canonical, sitemap) need the public origin. On
// CI a missing one would publish localhost links: stop the build instead.
// Locally it falls back to http://localhost:3000 (lib/seo).
if (process.env.GITHUB_ACTIONS === "true" && !process.env.NEXT_PUBLIC_SITE_ORIGIN) {
  throw new Error("NEXT_PUBLIC_SITE_ORIGIN must be set when building on GitHub Actions (absolute URLs for Open Graph, canonical and the sitemap).");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  // No build timestamp in the bundle: "New this week" is judged on the
  // viewer's clock (lib/taste), so chunk hashes only change with the code.
};

export default nextConfig;
