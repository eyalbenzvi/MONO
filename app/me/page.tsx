import type { Metadata } from "next";
import { MeView } from "@/components/MeView";
import { pageMeta } from "@/lib/seo";

// Personal: kept out of search results.
export const metadata: Metadata = pageMeta({ path: "/me/", title: "You — MONO", description: "Your taste, saved tees, bag and orders on MONO.", index: false });

export default function MePage() {
  return <MeView />;
}
