import type { Metadata } from "next";
import { MakeIndex } from "@/components/custom/MakeIndex";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/make/",
  title: "Made for you — MONO",
  description: "The night sky, the moon or the planets on the day you choose, with your words. Computed, not drawn. One ink, black or white.",
});

export default function MakeIndexPage() {
  return <MakeIndex />;
}
