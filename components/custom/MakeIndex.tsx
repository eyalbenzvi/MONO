"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { drawPrint } from "@/components/custom/useCustom";
import { getShirtById } from "@/lib/catalog";
import { MADE, type MadeProduct } from "@/lib/custom/products";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";
import { SIZES } from "@/lib/images";

/**
 * Make: one ink, for one person. From ours (our designs, each adapted from
 * one thing of yours: a night, a name, a line) and from yours (your own
 * picture or words, /make/yours/). Each card shows an example (a real
 * print; the words on it are ours) and what it is made from.
 */
export function MakeIndex() {
  const price = STORE_POLICY.customPrice;
  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 2xl:max-w-6xl">
        <h1 className="text-balance text-3xl font-black tracking-tight md:text-5xl">Make</h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-400 md:text-base">
          One ink, for one person. {price ? formatPrice(price) : ""}.
        </p>
        <section className="mt-10" aria-labelledby="make-ours">
          <h2 id="make-ours" className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            From ours
          </h2>
          <p className="mt-1 text-sm text-neutral-300">Our designs, made yours.</p>
          <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-4" data-from="ours">
            {MADE.map((m) => (
              <li key={m.slug}>
                <Card made={m} />
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-14" aria-labelledby="make-yours">
          <h2 id="make-yours" className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            From yours
          </h2>
          <p className="mt-1 text-sm text-neutral-300">Your picture or words, in one ink.</p>
          <div className="mt-5 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4" data-from="yours">
            <Link href="/make/yours/" className="group flex aspect-[512/704] flex-col justify-end rounded-3xl bg-ink-900 p-5 ring-1 ring-white/10 transition hover:ring-white/30" data-made="yours">
              <p className="text-sm text-neutral-400">A picture, a drawing or words.</p>
              <p className="mt-2 flex items-center gap-1.5 text-base font-bold">
                Start with a file <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ made }: { made: MadeProduct }) {
  const shirt = getShirtById(made.id);
  const color = shirt?.baseColor ?? "black";
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    drawPrint(made.example, color)
      .then((d) => live && setSvg(d.svg))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [made, color]);
  return (
    <Link href={`/make/${made.slug}/`} className="group block" data-made={made.slug}>
      <div className="overflow-hidden rounded-3xl bg-ink-900 ring-1 ring-white/10 transition group-hover:ring-white/30">
        {shirt && svg ? <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.grid} className="w-full" /> : <div className="aspect-[512/704] w-full animate-pulse bg-white/[0.03]" aria-hidden />}
      </div>
      <h3 className="mt-3 flex items-center gap-1.5 text-base font-bold">
        {made.name} <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </h3>
      <p className="mt-0.5 text-sm text-neutral-400">{made.from}</p>
    </Link>
  );
}
