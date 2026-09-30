import type { Metadata } from "next";
import { PRODUCT_FALLBACK_TITLE, pageMeta } from "@/lib/seo";

// Only reached through in-app links to designs without a static page; the
// canonical product URLs are /shop/<id>/, so this route points at the shop.
export const metadata: Metadata = {
  ...pageMeta({ path: "/shop/", title: PRODUCT_FALLBACK_TITLE, description: "A one-ink tee from the MONO shop.", index: false }),
};

export default function ClientProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
