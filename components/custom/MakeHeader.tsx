"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";

/**
 * The top of both Make pages: the H1, the switch between the two tracks
 * (links that replace the history entry, so Back leaves Make rather than
 * toggling), and one line for the track. From ours is /make/, from yours
 * /make/yours/.
 */
export function MakeHeader({ track, filter }: { track: "ours" | "yours"; filter?: ReactNode }) {
  const line =
    track === "ours"
      ? `Our designs, from one thing of yours. ${formatPrice(STORE_POLICY.customPrice)}, or ${formatPrice(STORE_POLICY.customPairPrice)} the pair.`
      : `Your picture, drawing or words, in one ink. ${formatPrice(STORE_POLICY.customPrice)}.`;
  const tab = (t: "ours" | "yours", label: string, href: string) => (
    <Link
      href={href}
      replace
      aria-current={track === t ? "page" : undefined}
      className={`flex h-10 flex-1 items-center justify-center rounded-full text-sm font-semibold transition ${track === t ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
    >
      {label}
    </Link>
  );
  return (
    <div>
      <h1 className="text-balance text-3xl font-black tracking-tight md:text-5xl">Make</h1>
      <nav aria-label="Make" className="mt-4 flex w-full gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 sm:max-w-xs" data-make-switch>
        {tab("ours", "From ours", "/make/")}
        {tab("yours", "From yours", "/make/yours/")}
      </nav>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-neutral-400">{line}</p>
        {filter}
      </div>
    </div>
  );
}
