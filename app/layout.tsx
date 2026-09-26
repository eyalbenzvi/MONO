import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { SITE_URL, ogImage } from "@/lib/seo";
import "./globals.css";

const DESCRIPTION = "Swipe black & white monochrome tees. A vector engine learns your taste, then opens a shop built for you.";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: "MONO — Monochrome Tee Discovery",
  description: DESCRIPTION,
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/site.webmanifest`,
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

/**
 * Content Security Policy (a meta tag: GitHub Pages can't send headers).
 * Scripts and styles need 'unsafe-inline' — Next's static export inlines its
 * bootstrap data, and motion styles are inline. Images: our own files plus
 * data:/blob: (the share image). Requests: our origin, and the API when one
 * is configured. Production only (the dev server needs eval).
 */
const API_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : "";
  } catch {
    return "";
  }
})();
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${API_ORIGIN ? ` ${API_ORIGIN}` : ""}`,
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>{process.env.NODE_ENV === "production" && <meta httpEquiv="Content-Security-Policy" content={CSP} />}</head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
