// Web app manifest, written once at build time. A route handler rather than
// app/manifest.ts: Next links that one without the base path (/MONO), so the
// link is set in the root layout's metadata instead.
export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function GET() {
  return Response.json(
    {
      name: "MONO — Monochrome Tee Discovery",
      short_name: "MONO",
      description: "Swipe black & white monochrome tees; the shop learns your taste.",
      start_url: `${BASE}/`,
      scope: `${BASE}/`,
      display: "standalone",
      background_color: "#050505",
      theme_color: "#050505",
      icons: [{ src: `${BASE}/icon.svg`, sizes: "any", type: "image/svg+xml" }],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
