"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { BUTTON_PRIMARY } from "@/components/ui";
import { track } from "@/lib/analytics";
import { toggleCategory } from "@/lib/catalog";
import { CATEGORY_LABELS, COLORS, COLOR_LABELS, SHIRT_CATEGORIES, type BaseColor, type ShirtCategory } from "@/types/shirt";

/** One control of the shop's bottom row: words only, 44px tall, the chosen one white. */
export const ROW_CONTROL = "flex h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150";

/** The shop's tee colour, in words: "Black · White". A toggle — tap again for both colours. */
export function TeeSwatches({ tee, onChange, onWarm }: { tee: BaseColor | null; onChange: (tee: BaseColor | null) => void; onWarm: (tee: BaseColor) => void }) {
  return (
    <div role="group" aria-label="Tee colour" className="flex shrink-0 items-center">
      {COLORS.map((c, i) => {
        const active = tee === c;
        return (
          <span key={c} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className="text-muted">
                ·
              </span>
            )}
            <button
              type="button"
              aria-pressed={active}
              aria-label={`${COLOR_LABELS[c]} tees`}
              onPointerDown={() => onWarm(c)}
              onPointerEnter={() => onWarm(c)}
              onFocus={() => onWarm(c)}
              onClick={() => onChange(active ? null : c)}
              className={`${ROW_CONTROL} ${active ? "text-white underline underline-offset-4" : "text-muted hover:text-white"}`}
            >
              {COLOR_LABELS[c]}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/**
 * "Filter": a sheet to choose the categories shown (Back closes it, #filter).
 * Changes apply at once; the grid behind follows. The counts and the
 * button's number are the same unit: tees, variations included.
 */
export function CategoryFilter({
  cats,
  counts,
  total,
  results,
  onChange,
  onWarm,
  onOpen,
}: {
  cats: ShirtCategory[];
  counts: Record<ShirtCategory, number>;
  total: number;
  results: number;
  onChange: (cats: ShirtCategory[]) => void;
  onWarm: (cats: ShirtCategory[]) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = (via: "button" | "backdrop" | "escape") => {
    track("shop_filter_close", { via, cats: cats.join("."), results });
    setOpen(false);
  };
  const n = cats.length;
  const row = (on: boolean, label: string, count: number, onClick: () => void, onFocus?: () => void, autofocus = false) => (
    <button
      key={label}
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={count === 0}
      onClick={onClick}
      onPointerDown={onFocus}
      onFocus={onFocus}
      {...(autofocus ? { "data-autofocus": true } : {})}
      className="flex h-12 w-full items-center gap-3 text-left text-sm hover:bg-white/5 disabled:opacity-35"
    >
      <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-control ${on ? "bg-white text-black" : "ring-1 ring-inset ring-white/30"}`}>
        {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-white">{label}</span>
      <span className="text-xs tabular-nums text-muted">{count.toLocaleString("en-US")}</span>
    </button>
  );
  return (
    <>
      <button
        type="button"
        onClick={() => {
          track("shop_filter_open", { cats_active: n });
          onOpen?.();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${ROW_CONTROL} ${n ? "text-white" : "text-muted hover:text-white"}`}
      >
        {n ? `Filter · ${n}` : "Filter"}
      </button>
      <Sheet
        open={open}
        onClose={() => close("backdrop")}
        historyKey="filter"
        title="Categories"
        footer={
          <button type="button" onClick={() => close("button")} className={`w-full ${BUTTON_PRIMARY}`}>
            Show {results.toLocaleString("en-US")} {results === 1 ? "tee" : "tees"}
          </button>
        }
      >
        <div role="group" aria-label="Categories" className="grid">
          {row(n === 0, "All", total, () => onChange([]), () => onWarm([]), true)}
          {SHIRT_CATEGORIES.map((c) => {
            const next = toggleCategory(cats, c);
            return row(cats.includes(c), CATEGORY_LABELS[c], counts[c], () => onChange(next), () => onWarm(next));
          })}
        </div>
      </Sheet>
    </>
  );
}
