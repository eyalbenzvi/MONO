import type { Metadata } from "next";
import Link from "next/link";
import { TeeMockup } from "@/components/TeeMockup";
import { BUTTON_PRIMARY } from "@/components/buttons";
import { SHIRTS } from "@/lib/catalog";
import { SIZES } from "@/lib/images";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/about/",
  title: "About | MONO",
  description: "Black. White. One ink. Swipe ten and MONO edits every print to your taste.",
});

/** The picture: the first of the editorial rank (the shop window's first tee). */
const COVER = [...SHIRTS].sort((a, b) => a.rank - b.rank)[0];

/**
 * The brand page: one picture, one paragraph, one way in. Short on purpose.
 */
export default function AboutPage() {
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto flex max-w-[560px] flex-col pb-14">
        {COVER && <TeeMockup shirt={COVER} priority sizes={SIZES.product} className="w-full" />}
        <div className="px-5">
          <h1 className="mt-8 text-[28px] font-medium leading-tight">Black. White. One ink.</h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-200">
            Every MONO tee carries a single ink on black or white: drawings, archive works and photographs, printed to order. Swipe ten and the shop edits itself to your taste. Every print, in your order.
          </p>
          <Link href="/" className={`mt-10 ${BUTTON_PRIMARY}`}>
            Start the taste test
          </Link>
        </div>
      </article>
    </div>
  );
}
