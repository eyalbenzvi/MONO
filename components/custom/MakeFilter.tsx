"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { BUTTON_PRIMARY } from "@/components/ui";
import { ROW_CONTROL } from "@/components/shop/ShopFilters";
import { track } from "@/lib/analytics";
import { MAKE_GROUPS, type MakeGroup } from "@/lib/custom/products";

/**
 * The Make index's filter, as the shop's: "Filter" (with the number chosen)
 * opens a sheet of the groups, each a checkbox with its count, "All" first.
 * Back closes it (#filter).
 */
export function MakeFilter({ groups, counts, onChange }: { groups: MakeGroup[]; counts: Record<MakeGroup, number>; onChange: (groups: MakeGroup[]) => void }) {
  const [open, setOpen] = useState(false);
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
      className="flex h-12 w-full items-center gap-3 text-left text-sm hover:bg-white/5 disabled:opacity-35"
    >
      <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-control ${on ? "bg-white text-black" : "ring-1 ring-inset ring-white/30"}`}>
        {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-white">{label}</span>
      <span className="text-xs tabular-nums text-muted">{count}</span>
    </button>
  );
  return (
    <div className="shrink-0" data-make-filter>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={`${ROW_CONTROL} ${n ? "text-white" : "text-muted hover:text-white"}`}>
        {n ? `Filter · ${n}` : "Filter"}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        historyKey="filter"
        title="Categories"
        footer={
          <button type="button" onClick={() => setOpen(false)} className={`w-full ${BUTTON_PRIMARY}`}>
            Show {shown} {shown === 1 ? "print" : "prints"}
          </button>
        }
      >
        <div role="group" aria-label="Categories" className="grid">
          {row(n === 0, "All", total, () => set([]), true)}
          {MAKE_GROUPS.filter((g) => counts[g.id] > 0).map((g) =>
            row(groups.includes(g.id), g.label, counts[g.id], () => set(groups.includes(g.id) ? groups.filter((x) => x !== g.id) : MAKE_GROUPS.map((x) => x.id).filter((x) => x === g.id || groups.includes(x)))),
          )}
        </div>
      </Sheet>
    </div>
  );
}
