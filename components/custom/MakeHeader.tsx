"use client";

import Link from "next/link";

/**
 * Make's two tracks, in words: Personalise (/make/) and Upload
 * (/make/yours/). Links that replace the history entry, so Back leaves Make
 * rather than toggling. `row`: in a bottom control row (the Make index);
 * otherwise at the top of the page (the upload flow, whose bottom is its
 * buy bar).
 */
export function MakeSwitch({ track }: { track: "ours" | "yours" }) {
  const tab = (t: "ours" | "yours", label: string, href: string) => (
    <Link
      href={href}
      replace
      aria-current={track === t ? "page" : undefined}
      className={`flex h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150 ${track === t ? "text-white underline underline-offset-4" : "text-muted hover:text-white"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Make" className="flex items-center" data-make-switch>
      {tab("ours", "Personalise", "/make/")}
      <span aria-hidden className="text-muted">
        ·
      </span>
      {tab("yours", "Upload", "/make/yours/")}
    </nav>
  );
}

/** What Make is, in one quiet line (the page's heading). */
export const MAKE_LINE = "Our prints, made yours. Or print your own.";

/** The top of the upload flow: the heading line and the two tracks. */
export function MakeHeader({ track }: { track: "ours" | "yours" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3">
      <h1 className="py-2 text-[13px] text-muted">{MAKE_LINE}</h1>
      <MakeSwitch track={track} />
    </div>
  );
}
