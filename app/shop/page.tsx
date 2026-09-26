import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";
import { SHIRTS } from "@/lib/catalog";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { pageMeta } from "@/lib/seo";
import { SHIRT_CATEGORIES } from "@/types/shirt";

// Counts and price from the catalog itself (never hard-coded).
const COUNT = SHIRTS.length.toLocaleString("en-US");
const PRICES = [...new Set(SHIRTS.map((s) => s.price))];
const PRICE = PRICES.length === 1 ? `one price, $${PRICES[0]}` : `from $${Math.min(...PRICES)}`;

export const metadata: Metadata = pageMeta({
  path: "/shop/",
  title: "Shop monochrome tees — MONO",
  description: `${COUNT} black & white graphic tees in ${SHIRT_CATEGORIES.length} styles, ${PRICE}. Take the ${CALIBRATION_TOTAL}-swipe taste test and the shop ranks itself for you.`,
});

export default function ShopPage() {
  return (
    <>
      <h1 className="sr-only">
        Shop {COUNT} monochrome tees in {SHIRT_CATEGORIES.length} styles
      </h1>
      <ShopView />
    </>
  );
}
