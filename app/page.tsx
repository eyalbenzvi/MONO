import type { Metadata } from "next";
import { DiscoverPage } from "@/components/DiscoverPage";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { pageMeta } from "@/lib/seo";

const DESCRIPTION = "Swipe ten black-and-white tees. MONO ranks over a thousand more to your taste.";

export const metadata: Metadata = pageMeta({ path: "/", title: "MONO — Monochrome Tee Discovery", description: DESCRIPTION });

/** Discover: the swipe deck (client), with what the page is in its static HTML (JSON-LD added after the build). */
export default function Home() {
  return (
    <>
      <h1 className="sr-only">Swipe {CALIBRATION_TOTAL} tees. Get a shop ranked for you.</h1>
      <DiscoverPage />
    </>
  );
}
