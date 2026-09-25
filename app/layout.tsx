import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { SITE_URL, ogImage } from "@/lib/seo";
import "./globals.css";

const DESCRIPTION = "Swipe black & white monochrome tees. A vector engine learns your taste, then opens a shop built for you.";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: "MONO — Monochrome Tee Discovery",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "MONO",
    title: "MONO — swipe your taste in tees",
    description: DESCRIPTION,
    url: `${SITE_URL}/`,
    images: [{ ...ogImage("default"), alt: "MONO — monochrome tees" }],
  },
  twitter: { card: "summary_large_image", title: "MONO — swipe your taste in tees", description: DESCRIPTION, images: [ogImage("default").url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
