import type { Metadata } from "next";
import { DiscoverPage } from "@/components/DiscoverPage";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { homeJsonLd, jsonLd, pageMeta } from "@/lib/seo";

const DESCRIPTION = "Swipe black & white monochrome tees. A vector engine learns your taste, then opens a shop built for you.";

export const metadata: Metadata = pageMeta({ path: "/", title: "MONO — Monochrome Tee Discovery", description: DESCRIPTION });

/** Discover: the swipe deck (client), with what the page is in its static HTML. */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(homeJsonLd()) }} />
      <h1 className="sr-only">Swipe {CALIBRATION_TOTAL} tees. Get a shop ranked for you.</h1>
      <DiscoverPage />
    </>
  );
}
