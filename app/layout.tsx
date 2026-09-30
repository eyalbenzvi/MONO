import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/AppShell";
import { SITE_URL, ogImage } from "@/lib/seo";
import { INDEX_URL } from "@/lib/catalogIndex";
import "./globals.css";

const TITLE = "MONO · Black and white tees, one ink";
const DESCRIPTION = "One-ink tees in black and white. Swipe ten and the shop edits itself to your taste.";

/** The brand's one face (Geist, OFL), self-hosted: regular and medium only. */
const sans = localFont({
  src: [
    { path: "../public/fonts/geist.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/geist-medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: TITLE,
  description: DESCRIPTION,
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/site.webmanifest`,
  // Links out carry the site's origin only, never a page's address (which can hold a print's details).
  referrer: "strict-origin-when-cross-origin",
  openGraph: {
    type: "website",
    siteName: "MONO",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/`,
    images: [{ ...ogImage("default"), alt: "MONO, black and white tees" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [ogImage("default").url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable}`}>
      <head>
        {/* The Content-Security-Policy meta tag is written after the build,
            first in <head>, with this page's script hashes (lib/csp). */}
        <link rel="sitemap" type="application/xml" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sitemap.xml`} />
        {/* The catalog index starts downloading with the page, alongside the scripts. */}
        <link rel="preload" href={INDEX_URL} as="fetch" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
