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
 * Made for you: the four tees that are yours alone, each shown with an
 * example (a real print of a real day; the words on it are ours).
 */
export function MakeIndex() {
  const price = STORE_POLICY.customPrice;
  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 2xl:max-w-6xl">
        <h1 className="text-balance text-3xl font-black tracking-tight md:text-5xl">Made for you</h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-400 md:text-base">
          The sky, the moon or the planets on the day that mattered, with your words. Computed from real positions, printed in one ink. {price ? formatPrice(price) : ""}.
        </p>
        <ul className="mt-8 grid grid-cols-1 gap-x-4 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {MADE.map((m) => (
            <li key={m.slug}>
              <Card made={m} />
            </li>
          ))}
        </ul>
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
      <h2 className="mt-3 flex items-center gap-1.5 text-base font-bold">
        {made.name} <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </h2>
      <p className="mt-0.5 text-sm text-neutral-400">{made.line}</p>
    </Link>
  );
}
