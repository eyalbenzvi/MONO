import type { Metadata } from "next";
import Link from "next/link";
import { SHIRTS } from "@/lib/catalog";
import { pageMeta } from "@/lib/seo";

// Facts from the catalog itself (never hard-coded).
const COUNT = SHIRTS.length.toLocaleString("en-US");

export const metadata: Metadata = pageMeta({
  path: "/about/",
  title: "About MONO — Monochrome Tees, Ranked by Your Taste",
  description: `Black or white tees, one-ink prints. Swipe a few and MONO ranks all ${COUNT} designs for you. A demo store: nothing is charged.`,
});

/** The brand's three words, set like the mark: heavy caps, wide tracking. */
const WORDS: { word: string; inverse?: boolean }[] = [{ word: "Black." }, { word: "White.", inverse: true }, { word: "One ink." }];

const FACTS: [string, string][] = [
  [COUNT, "designs"],
  ["2", "colours"],
  ["1", "ink"],
];

/**
 * The brand page (the logo leads here): three words set like the mark, one line, and
 * the honest note about this demo. Short on purpose.
 */
export default function AboutPage() {
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto flex max-w-[560px] flex-col px-5 pb-14 pt-8">
        <h1 className="mt-6 font-black uppercase leading-[0.95] tracking-[0.08em]">
          {WORDS.map(({ word, inverse }) => (
            <span
              key={word}
              className={`block w-fit text-[clamp(2.75rem,14vw,4.5rem)] ${inverse ? "-mx-2 my-1 bg-white px-2 text-black" : "text-white"}`}
            >
              {word}
            </span>
          ))}
        </h1>

        <p className="mt-8 max-w-[22rem] text-base leading-relaxed text-neutral-300">Swipe a few. MONO ranks every design to your taste.</p>

        <dl className="mt-10 grid grid-cols-3 border-y border-white/15">
          {FACTS.map(([n, label], i) => (
            <div key={label} className={`py-5 ${i ? "border-l border-white/15 pl-4" : ""}`}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-mono text-2xl font-bold tabular-nums text-white">{n}</dd>
              <dd className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">{label}</dd>
            </div>
          ))}
        </dl>

        <Link href="/" className="mt-10 flex h-14 items-center justify-center rounded-full bg-white text-sm font-black uppercase tracking-[0.2em] text-black">
          Start swiping
        </Link>

        <section aria-labelledby="this-site" className="mt-14">
          <h2 id="this-site" className="scroll-mt-24 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            About this site
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-neutral-500">
            A demo store: nothing is charged and nothing ships. Your taste stays in this browser. Archive prints are public domain, credited on
            each tee; the models are generated images. Places: GeoNames (CC BY 4.0).
          </p>
        </section>
      </article>
    </div>
  );
}
