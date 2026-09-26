// On GitHub Pages the site is served from /<repo>/, so the deploy workflow
// sets NEXT_PUBLIC_BASE_PATH (e.g. "/MONO"). Locally it is empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  // One build time for server and client, so "New this week" (lib/taste)
  // renders the same on both.
  env: { NEXT_PUBLIC_BUILD_DATE: String(Date.now()) },
};

export default nextConfig;
