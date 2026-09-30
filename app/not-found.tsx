import type { Metadata } from "next";
import Link from "next/link";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/buttons";
import { pageMeta } from "@/lib/seo";
import { SHIRTS, isPrerendered } from "@/lib/catalog";
import { productRedirectScript } from "@/lib/notFound";

// Not a page to index; its canonical is the home page.
export const metadata: Metadata = pageMeta({ path: "/", title: "Not in the drop | MONO", description: "This page isn’t in the MONO drop. Everything else is still here.", index: false });

/**
 * 404 (static export: served as 404.html for any unknown path). Static
 * content only — nothing here reads the stores, so it hydrates cleanly
 * whatever URL it's served at.
 */
const REDIRECT = productRedirectScript(process.env.NEXT_PUBLIC_BASE_PATH ?? "", SHIRTS.filter((s) => !isPrerendered(s)).map((s) => s.n));

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <script dangerouslySetInnerHTML={{ __html: REDIRECT }} />
      <p className="text-xs text-muted">404</p>
      <h1 className="text-balance text-[20px] font-medium">This page isn&rsquo;t in the drop</h1>
      <p className="max-w-xs text-sm text-muted">The link may be old, or the tee has moved. Everything else is still here.</p>
      <div className="mt-3 flex gap-2">
        <Link href="/shop/" className={BUTTON_PRIMARY}>
          Shop
        </Link>
        <Link href="/" className={BUTTON_SECONDARY}>
          Discover
        </Link>
      </div>
    </div>
  );
}
