import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { pageMeta } from "@/lib/seo";
import { SHIRTS } from "@/lib/catalog";
import { productRedirectScript } from "@/lib/notFound";

// Not a page to index; its canonical is the home page.
export const metadata: Metadata = pageMeta({ path: "/", title: "Not in the drop — MONO", description: "This page isn't in the MONO drop. Everything else is still here.", index: false });

/**
 * 404 (static export: served as 404.html for any unknown path). Static
 * content only — nothing here reads the stores, so it hydrates cleanly
 * whatever URL it's served at.
 */
const REDIRECT = productRedirectScript(process.env.NEXT_PUBLIC_BASE_PATH ?? "", SHIRTS.length);

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <script dangerouslySetInnerHTML={{ __html: REDIRECT }} />
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400">404</p>
      <h1 className="text-balance text-2xl font-bold tracking-tight">This page isn&apos;t in the drop</h1>
      <p className="max-w-xs text-sm text-neutral-400">The link may be old, or the tee has moved. Everything else is still here.</p>
      <div className="mt-3 flex gap-2">
        <Link href="/shop/" className="flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-bold text-black">
          Shop <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
        <Link href="/" className="flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/5">
          Discover
        </Link>
      </div>
    </div>
  );
}
