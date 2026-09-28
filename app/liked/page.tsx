import type { Metadata } from "next";
import { LikedView } from "@/components/LikedView";
import { pageMeta } from "@/lib/seo";

// Personal: kept out of search results.
export const metadata: Metadata = pageMeta({ path: "/liked/", title: "Liked tees — MONO", description: "Every tee you liked on MONO, ready for the bag.", index: false });

export default function LikedPage() {
  return <LikedView />;
}
