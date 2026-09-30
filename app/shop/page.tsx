import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";
import { SHIRTS } from "@/lib/catalog";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { pageMeta } from "@/lib/seo";

// Counts from the catalog itself (never hard-coded).
const COUNT = SHIRTS.length.toLocaleString("en-US");

export const metadata: Metadata = pageMeta({
  path: "/shop/",
  title: "Shop · Black and white tees | MONO",
  description: `${COUNT} one-ink tees in black and white: drawn, archive and photo prints. Swipe ${CALIBRATION_TOTAL === 10 ? "ten" : CALIBRATION_TOTAL} and the shop edits itself to your taste.`,
});

export default function ShopPage() {
  return <ShopView />;
}
