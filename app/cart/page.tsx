import type { Metadata } from "next";
import { CartView } from "@/components/shop/CartView";
import { pageMeta } from "@/lib/seo";

// Personal and empty for crawlers: keep it out of search results.
export const metadata: Metadata = pageMeta({ path: "/cart/", title: "Your bag — MONO", description: "Your MONO bag and checkout.", index: false });

export default function CartPage() {
  return <CartView />;
}
