"use client";

import Link from "next/link";
import { Suspense, lazy, useEffect, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { MakeHeader } from "@/components/custom/MakeHeader";
import { MakeFilter } from "@/components/custom/MakeFilter";
import { markFrom } from "@/lib/custom/makeFrom";
import { drawPrint } from "@/components/custom/useCustom";
import { STAGE_BG } from "@/components/stage";
import { getShirtById } from "@/lib/catalog";
import { MADE, MAKE_GROUPS, type MakeGroup, type MadeProduct } from "@/lib/custom/products";
import type { CustomSpec } from "@/lib/custom/spec";
import { SIZES } from "@/lib/images";

/** Your Taste's card, drawn from the visitor's own taste once it's known (its store loads apart from this page). */
const TasteCard = lazy(() => import("@/components/custom/TasteCard"));

/**
 * Make, from ours: our designs, each adapted from one thing of yours,
 * grouped by what you arrive with (a date, a name, a place, yourself) as
 * shop-style cards: the example print on its tee, the name, and what it
 * takes. From yours (your own file or words) is the other track, behind the
 * switch (/make/yours/).
 */
const COUNTS = Object.fromEntries(MAKE_GROUPS.map((g) => [g.id, MADE.filter((m) => m.group === g.id).length])) as Record<MakeGroup, number>;
const GROUP_IDS = MAKE_GROUPS.map((g) => g.id);
/** The groups the address asks for (`?g=date.name`), known ones only, in their order. */
const groupsFrom = (search: string): MakeGroup[] => {
  const want = (new URLSearchParams(search).get("g") ?? "").split(".");
  return GROUP_IDS.filter((g) => want.includes(g));
};

export function MakeIndex() {
  // The filter: every group until some are chosen; kept in the address (replaced, so Back leaves Make).
  const [groups, setGroups] = useState<MakeGroup[]>([]);
  useEffect(() => setGroups(groupsFrom(window.location.search)), []);
  const choose = (next: MakeGroup[]) => {
    setGroups(next);
    const q = new URLSearchParams(window.location.search);
    if (next.length) q.set("g", next.join("."));
    else q.delete("g");
    const qs = q.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  };
  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 2xl:max-w-6xl">
        <MakeHeader track="ours" filter={<MakeFilter groups={groups} counts={COUNTS} onChange={choose} />} />
        <p className="mt-4 text-sm">
          <Link href="/make/two/" className="text-neutral-300 underline underline-offset-4 hover:text-white" data-for-two>
            For two: one date, every print it makes →
          </Link>
        </p>
        {MAKE_GROUPS.filter((g) => COUNTS[g.id] > 0 && (!groups.length || groups.includes(g.id))).map((g) => (
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
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function MakeCard({ made, spec = made.example, from = made.from }: { made: MadeProduct; spec?: CustomSpec; from?: string }) {
  const shirt = getShirtById(made.id);
  const color = shirt?.baseColor ?? "black";
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    drawPrint(spec, color)
      .then((d) => live && setSvg(d.svg))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [spec, color]);
  return (
    <div className="group relative isolate">
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ${STAGE_BG}`}>
        {shirt && svg ? (
          <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.grid} className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="aspect-[512/704] w-full animate-pulse rounded-xl bg-white/[0.03]" aria-hidden />
        )}
      </div>
      <div className="mt-2 px-0.5">
        <Link
          href={`/make/${made.slug}/`}
          data-made={made.slug}
          onClick={() => markFrom("index")}
          className="block truncate rounded-2xl text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-black"
        >
          {made.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-neutral-400">{from}</p>
      </div>
    </div>
  );
}
