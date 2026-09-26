import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Only reached through in-app links to designs without a static page; the
// canonical product URLs are /shop/<id>/, so this route points at the shop.
export const metadata: Metadata = {
  ...pageMeta({ path: "/shop/", title: "Monochrome tee — MONO", description: "A monochrome tee from the MONO shop.", index: false }),
};

export default function ClientProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
