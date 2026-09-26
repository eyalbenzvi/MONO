import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Shop monochrome tees — MONO",
  description: "2,800 black & white graphic tees in 14 styles, one price. Take the 10-swipe taste test and the shop ranks itself for you.",
  alternates: { canonical: `${SITE_URL}/shop/` },
};

export default function ShopPage() {
  return <ShopView />;
}
