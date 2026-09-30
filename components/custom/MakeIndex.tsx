"use client";

import Link from "next/link";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { MakeHeader } from "@/components/custom/MakeHeader";
import { MakeFilter } from "@/components/custom/MakeFilter";
import { markFrom } from "@/lib/custom/makeFrom";
import { drawPrint } from "@/components/custom/useCustom";
import { STAGE_BG } from "@/components/stage";
import { assetUrl, getShirtById } from "@/lib/catalog";
import { CARD_WIDTHS, TWO_KEY, TWO_SPEC, cardPath } from "@/lib/custom/makeCards";
import { GROUP_COUNTS as COUNTS, MADE, MAKE_GROUPS, groupsFrom, madeBySlug, type MakeGroup, type MadeProduct } from "@/lib/custom/products";
import type { CustomSpec } from "@/lib/custom/spec";
import { updateQuery } from "@/lib/url";
import { SIZES } from "@/lib/images";
import { makeScroll } from "@/store/useUiStore";

/** Your Taste's card, drawn from the visitor's own taste once it's known (its store loads apart from this page). */
const TasteCard = lazy(() => import("@/components/custom/TasteCard"));

/**
 * Make, from ours: our designs, each adapted from one thing of yours,
 * grouped by what you arrive with (a date, a name, a place, yourself) as
 * shop-style cards: the example print on its tee, the name, and what it
 * takes. From yours (your own photo or drawing) is the other track, behind the
 * switch (/make/yours/).
 */
/** A card's name: the product's, without its leading "Your" (the product page and the bag keep it). */
const cardName = (name: string) => name.replace(/^Your /, "");
/** For two's card: our example couple's initials, woven (lib/custom/makeCards). */
const MONOGRAM = madeBySlug("monogram") as MadeProduct;
export function MakeIndex() {
  // The filter: every group until some are chosen; kept in the address (replaced, so Back leaves Make).
  const [groups, setGroups] = useState<MakeGroup[] | null>(null);
  useEffect(() => setGroups(groupsFrom(window.location.search)), []);
  const choose = (next: MakeGroup[]) => {
    setGroups(next);
    makeScroll.top = 0;
    updateQuery((q) => (next.length ? q.set("g", next.join(".")) : q.delete("g")));
  };
  // Coming back (Back, the header's Make tab, a product's own link): the list where it was left, once its filter is read.
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!groups || !el) return;
    // A group asked for by name (More from a name → /make/#name) goes to that group instead.
    if (window.location.hash) return void (makeScroll.focus = null);
    el.scrollTop = makeScroll.top;
    const slug = makeScroll.focus;
    makeScroll.focus = null;
    if (slug) el.querySelector<HTMLElement>(`[data-made="${slug}"], [data-for-two][href*="${slug}"]`)?.focus({ preventScroll: true });
    // Only on arrival: the filter changing starts from the top (choose).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups === null]);
  const shown = groups ?? [];
  return (
    <div ref={scroller} data-make-index onScroll={(e) => groups && (makeScroll.top = e.currentTarget.scrollTop)} className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 2xl:max-w-6xl">
        <MakeHeader track="ours" filter={<MakeFilter groups={shown} counts={COUNTS} onChange={choose} />} />
        {MAKE_GROUPS.filter((g) => COUNTS[g.id] > 0 && (!shown.length || shown.includes(g.id))).map((g) => (
          <section key={g.id} id={g.id} className="mt-10 scroll-mt-24" aria-labelledby={`make-${g.id}`}>
            <h2 id={`make-${g.id}`} className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
              {g.label}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4" data-from="ours" data-group={g.id}>
              {MADE.filter((m) => m.group === g.id).map((m) => (
                <li key={m.slug}>
                  {m.slug === "taste" ? (
                    <Suspense fallback={<MakeCard made={m} />}>
                      <TasteCard made={m} />
                    </Suspense>
                  ) : (
                    <MakeCard made={m} />
                  )}
                </li>
              ))}
              {/* For two, a card among the dated prints: one date, every print it makes. */}
              {g.id === "date" && (
                <li>
                  <MakeCard made={MONOGRAM} spec={TWO_SPEC} baked={TWO_KEY} name="For two" from="One date, every print" href="/make/two/" data-for-two />
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * A Make card: the example print worn, baked at build time
 * (scripts/images/bakeMake.ts), so the index draws nothing; a card drawn
 * from the visitor's own input (Your Taste, once known), or one whose picture
 * didn't load, is drawn here instead.
 */
export function MakeCard({
  made,
  spec = made.example,
  baked = spec === made.example ? made.slug : undefined,
  from = made.from,
  name = made.name,
  href = `/make/${made.slug}/`,
  ...rest
}: { made: MadeProduct; spec?: CustomSpec; baked?: string; from?: string; name?: string; href?: string; "data-for-two"?: boolean }) {
  const shirt = getShirtById(made.id);
  const color = shirt?.baseColor ?? "black";
  const [failed, setFailed] = useState(false);
  const live = !baked || failed;
  // A picture that failed before the page woke up (it's in the served HTML) fires no onError here: checked once mounted.
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    let on = true;
    drawPrint(spec, color)
      .then((d) => on && setSvg(d.svg))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [spec, color, live]);
  return (
    <div className="group relative isolate">
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ${STAGE_BG}`}>
        {!live ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={img}
            src={assetUrl(cardPath(baked!, CARD_WIDTHS[0]))}
            srcSet={CARD_WIDTHS.map((w) => `${assetUrl(cardPath(baked!, w))} ${w}w`).join(", ")}
            sizes={SIZES.grid}
            width={CARD_WIDTHS[0]}
            height={(CARD_WIDTHS[0] * 4) / 3}
            loading="lazy"
            decoding="async"
            alt={`${made.name}, personalised, worn on a ${color} tee`}
            onError={() => setFailed(true)}
            className="block aspect-[3/4] w-full transition-transform duration-300 group-hover:scale-[1.03]"
            data-card-baked
          />
        ) : shirt && svg ? (
          <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.grid} crop className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-white/[0.03]" aria-hidden />
        )}
      </div>
      <div className="mt-2 px-0.5">
        <Link
          href={href}
          {...(rest["data-for-two"] ? { "data-for-two": true } : { "data-made": made.slug })}
          onClick={(e) => {
            markFrom("index");
            // A click with no pointer (Enter on the link) is the keyboard: its focus comes back to this card.
            makeScroll.focus = e.detail === 0 ? (rest["data-for-two"] ? "two" : made.slug) : null;
          }}
          className="block truncate rounded-2xl text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-black"
        >
          {cardName(name)}
        </Link>
        <p className="mt-0.5 truncate text-xs text-neutral-400">{from}</p>
      </div>
    </div>
  );
}
