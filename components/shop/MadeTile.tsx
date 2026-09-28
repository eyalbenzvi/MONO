import Link from "next/link";
import { Icon } from "@/components/Icon";
import { STAGE_BG } from "@/components/ui";
import { SHIRTS } from "@/lib/catalog";
import { mockupImage, SIZES } from "@/lib/images";

/**
 * The shop's first card: Made for you (the tees that are yours alone). A
 * computed sky from the catalogue as its picture, and where it leads.
 */
export function MadeTile() {
  const sky = SHIRTS.find((s) => s.variant === "sky-night");
  const img = sky ? mockupImage(sky, sky.baseColor) : null;
  return (
    <Link href="/make/" className="group relative block" data-made-tile>
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ring-1 ring-white/25 ${STAGE_BG}`}>
        {img && <img src={img.src} srcSet={img.srcSet} sizes={SIZES.grid} alt="" className="aspect-[512/704] w-full opacity-60 transition group-hover:opacity-80" loading="lazy" decoding="async" />}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-300">Made for you</p>
          <p className="mt-1 text-sm font-bold leading-snug">Your sky, your moon, your words</p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1 px-1 text-sm font-semibold">
        Make yours <Icon name="arrow-right" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
