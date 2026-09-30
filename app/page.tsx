import type { Metadata } from "next";
import { DiscoverPage } from "@/components/DiscoverPage";
import { pageMeta } from "@/lib/seo";

const DESCRIPTION = "One-ink tees in black and white. Swipe ten and the shop edits itself to your taste.";

export const metadata: Metadata = pageMeta({ path: "/", title: "MONO · Black and white tees, one ink", description: DESCRIPTION });

/** Discover: the swipe deck (client); its heading follows the taste test (in the static HTML too). JSON-LD is added after the build. */
export default function Home() {
  return <DiscoverPage />;
}
