import type { Metadata } from "next";
import { CartView } from "@/components/shop/CartView";

// Personal and empty for crawlers: keep it out of search results.
export const metadata: Metadata = { title: "Your bag — MONO", robots: { index: false } };

export default function CartPage() {
  return <CartView />;
}
