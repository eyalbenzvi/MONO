// Web app manifest, written once at build time. A route handler rather than
// app/manifest.ts: Next links that one without the base path (/MONO), so the
// link is set in the root layout's metadata instead.
export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function GET() {
  return Response.json(
    {
      name: "MONO · Black and white tees, one ink",
      short_name: "MONO",
      description: "One-ink tees in black and white, edited to your taste.",
      start_url: `${BASE}/`,
      scope: `${BASE}/`,
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      icons: [{ src: `${BASE}/icon.svg`, sizes: "any", type: "image/svg+xml" }],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
