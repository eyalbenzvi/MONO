import type { Metadata } from "next";
import Link from "next/link";
import { SHIRTS } from "@/lib/catalog";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { PAIR_PRICE } from "@/lib/cart";
import { pageMeta } from "@/lib/seo";

// Facts from the catalog itself (never hard-coded).
const COUNT = SHIRTS.length.toLocaleString("en-US");
const PRICE = SHIRTS[0]?.price ?? 0;

export const metadata: Metadata = pageMeta({
  path: "/about/",
  title: "About MONO — Monochrome Tees, Ranked by Your Taste",
  description: `Black or white tees, single-ink prints, one price. Swipe a short taste test and MONO ranks all ${COUNT} designs for you. A demo store: nothing is charged.`,
});

const STEPS: [string, string][] = [
  ["Swipe.", `Like what you'd wear, pass on the rest. ${CALIBRATION_TOTAL} cards is enough to start.`],
  ["Shop.", "The whole catalog, ranked by your taste. It keeps learning as you save."],
  ["Pick your tee.", "Black, white or both. 100% organic cotton, 220 gsm, a single-ink print up to 28 × 37 cm."],
];

/**
 * The brand story (the logo leads here): what MONO is, how it works, and
 * an honest note about this site. Plain facts only — no invented claims.
 */
export default function AboutPage() {
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto max-w-[560px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">Black. White. One ink. Your taste.</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-300">
          <p>Every tee here is black or white. Every print is a single ink. Nothing else.</p>
          <p>
            Limits make the work. With no colour to hide behind, each design has to stand on its own — drawn graphics, and real photographs from the
            Smithsonian&apos;s open archive.
          </p>
          <p>You shouldn&apos;t have to scroll through thousands of tees to find yours. Swipe a few, and MONO ranks the rest for you.</p>
          <p className="text-white">
            One price. ${PRICE} a tee, or ${PAIR_PRICE} for the pair in black and white.
          </p>
        </div>

        <h2 className="mt-10 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">How it works</h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <span className="font-mono text-sm text-neutral-400">{i + 1}</span>
              <p className="text-sm leading-relaxed text-neutral-300">
                <span className="font-semibold text-white">{title}</span> {text}
              </p>
            </li>
          ))}
        </ol>

        <h2 id="this-site" className="mt-10 scroll-mt-24 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          About this site
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          MONO is a demo store. You can fill a bag and place an order, but no payment details are asked for, nothing is charged and nothing ships. There
          are no accounts: your taste profile stays in this browser on your device, and Reset clears it. The graphic prints are generated. The
          photographs are CC0, from Smithsonian Open Access, and each product page credits the photographer or museum and links to the source record.
        </p>
        <p className="mt-3 hidden text-xs text-neutral-500 [@media(hover:hover)_and_(pointer:fine)]:block">Keyboard in Discover: ← pass · → like · space details · Z undo</p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="flex h-12 items-center rounded-full bg-white px-6 text-sm font-bold text-black">
            Start swiping
          </Link>
          <Link href="/shop/" className="flex h-12 items-center rounded-full px-6 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/5">
            Browse the shop
          </Link>
        </div>
      </article>
    </div>
  );
}
