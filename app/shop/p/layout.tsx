import type { Metadata } from "next";

// Only reached through in-app links to designs without a static page; the
// canonical product URLs are /shop/<id>/.
export const metadata: Metadata = { robots: { index: false } };

export default function ClientProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
