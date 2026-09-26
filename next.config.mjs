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
  // No build timestamp in the bundle: "New this week" is judged on the
  // viewer's clock (lib/taste), so chunk hashes only change with the code.
};

export default nextConfig;
