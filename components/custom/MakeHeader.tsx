"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The top of both Make pages: the switch between the two tracks (links
 * that replace the history entry, so Back leaves Make rather than
 * toggling), with the track's filter beside it. The H1 is for screen
 * readers only: the header's Make tab already says where this is. From
 * ours is /make/, from yours /make/yours/.
 */
export function MakeHeader({ track, filter }: { track: "ours" | "yours"; filter?: ReactNode }) {
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
      <h1 className="sr-only">Make</h1>
      <div className="flex items-center gap-3">
        <nav aria-label="Make" className="flex min-w-0 flex-1 gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 sm:max-w-xs sm:flex-none sm:basis-80" data-make-switch>
          {tab("ours", "From ours", "/make/")}
          {tab("yours", "From yours", "/make/yours/")}
        </nav>
        {filter && <div className="ml-auto">{filter}</div>}
      </div>
    </div>
  );
}
