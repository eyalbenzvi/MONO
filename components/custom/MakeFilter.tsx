"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { track } from "@/lib/analytics";
import { MAKE_GROUPS, type MakeGroup } from "@/lib/custom/products";

/**
 * The Make index's filter, as the shop's: an icon (with the number chosen)
 * that opens a sheet of the groups, each a checkbox with its count, "All"
 * first. No animation library: this page stays light.
 */
export function MakeFilter({ groups, counts, onChange }: { groups: MakeGroup[]; counts: Record<MakeGroup, number>; onChange: (groups: MakeGroup[]) => void }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, open, () => setOpen(false));
  const n = groups.length;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const shown = n ? groups.reduce((a, g) => a + counts[g], 0) : total;
  const set = (next: MakeGroup[]) => {
    track("make_filter", { groups: next.join(".") || "all" });
    onChange(next);
  };
  const row = (on: boolean, label: string, count: number, onClick: () => void, autofocus = false) => (
    <button
      key={label}
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={count === 0}
      onClick={onClick}
      {...(autofocus ? { "data-autofocus": true } : {})}
      className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-white/5 disabled:opacity-35"
    >
      <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${on ? "bg-white text-black" : "ring-1 ring-white/25"}`}>
        {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-white">{label}</span>
      <span className="text-xs tabular-nums text-neutral-500">{count}</span>
    </button>
  );
  return (
    <div className="relative shrink-0" data-make-filter>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={n ? `Categories, ${n} selected` : "Categories"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 ${n ? "text-white" : "text-neutral-300"}`}
      >
        <Icon name="sliders-horizontal" className="h-5 w-5" />
        {n > 0 && (
          <span aria-hidden className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-none tabular-nums text-black">
            {n}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50 animate-[fade-in_0.15s_ease-out] bg-black/50 md:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="make-filter-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg animate-[fade-in_0.15s_ease-out] overflow-y-auto rounded-t-3xl bg-ink-900 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 ring-1 ring-white/10 md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-80 md:rounded-2xl md:pb-2 md:shadow-2xl md:shadow-black"
          >
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden />
            <div className="flex h-12 items-center px-3">
              <h2 id="make-filter-title" className="text-sm font-semibold text-white">
                Categories
              </h2>
            </div>
            <div role="group" aria-labelledby="make-filter-title" className="grid">
              {row(n === 0, "All", total, () => set([]), true)}
              {MAKE_GROUPS.filter((g) => counts[g.id] > 0).map((g) => row(groups.includes(g.id), g.label, counts[g.id], () => set(groups.includes(g.id) ? groups.filter((x) => x !== g.id) : MAKE_GROUPS.map((x) => x.id).filter((x) => x === g.id || groups.includes(x)))))}
            </div>
            <div className="sticky bottom-0 bg-ink-900 pt-2 md:hidden">
              <button type="button" onClick={() => setOpen(false)} className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black">
                Show {shown} designs
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
