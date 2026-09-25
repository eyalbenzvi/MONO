"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, SlidersHorizontal, Sparkles } from "lucide-react";
import { useHydrated } from "@/components/AppShell";
import { ProductCard } from "@/components/shop/ProductCard";
import { TraitChips } from "@/components/ui";
import { SHIRTS } from "@/lib/catalog";
import { rankShirts, topTraits, type ShopSort } from "@/lib/recommendation";
import { useCalibrationProgress, useShirtStore } from "@/store/useShirtStore";
import { FEATURE_LABELS, type BaseColor, type FeatureKey } from "@/types/shirt";

const STYLE_FILTERS: FeatureKey[] = [
  "architectural",
  "abstract",
  "geometric",
  "typography",
  "line_art",
  "halftone_raster",
  "clean_minimal",
  "dark_industrial",
];
const STYLE_THRESHOLD = 0.6;

/** Cards rendered per batch — the catalog has 1,000 mockups, render them lazily. */
const PAGE_SIZE = 24;

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "match", label: "Best match" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
];

export function ShopView() {
  const hydrated = useHydrated();
  const vector = useShirtStore((s) => s.preferenceVector);
  const { done, total, complete } = useCalibrationProgress();
  // Every design comes in both colours, so this is a "view as" switch, not a filter.
  const [teeView, setTeeView] = useState<BaseColor | "original">("original");
  const [style, setStyle] = useState<FeatureKey | null>(null);
  const [sort, setSort] = useState<ShopSort>("match");

  const ranked = useMemo(() => rankShirts(vector, SHIRTS, sort), [vector, sort]);
  const bestId = useMemo(() => rankShirts(vector, SHIRTS)[0]?.shirt.id, [vector]);
  const visible = ranked.filter(
    ({ shirt }) =>
      (!style || shirt.features[style] >= STYLE_THRESHOLD),
  );
  const traits = topTraits(vector, 3);

  const [limit, setLimit] = useState(PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(PAGE_SIZE), [style, sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setLimit((l) => l + PAGE_SIZE),
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hydrated, visible.length]);

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-2">
        {/* Taste summary / calibration nudge */}
        {hydrated && (
          <div className="mb-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            {complete ? (
              <>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                  <Sparkles className="h-3.5 w-3.5" /> Ranked for you
                </div>
                <p className="mt-1 text-sm text-neutral-300">
                  Every print is scored against your taste vector. Saving a tee here trains it too.
                </p>
                <TraitChips keys={traits} className="mt-2" />
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Finish calibrating for real picks</p>
                  <p className="text-xs text-neutral-400">
                    {done}/{total} swipes done — the ranking below is still rough.
                  </p>
                </div>
                <Link
                  href="/"
                  className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-xs font-bold text-black"
                >
                  Swipe <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="mb-2 flex items-center gap-2">
          <Segmented
            value={teeView}
            onChange={setTeeView}
            label="Show tees in"
            options={[
              { value: "original", label: "Original" },
              { value: "black", label: "Black" },
              { value: "white", label: "White" },
            ]}
          />
          <label className="relative ml-auto flex h-9 items-center gap-1.5 rounded-full bg-white/[0.05] pl-3 pr-2 text-xs text-neutral-300 ring-1 ring-white/10">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ShopSort)}
              className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold text-white outline-none"
              aria-label="Sort"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value} className="bg-ink-900">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip active={style === null} onClick={() => setStyle(null)}>
            All styles
          </Chip>
          {STYLE_FILTERS.map((k) => (
            <Chip key={k} active={style === k} onClick={() => setStyle(style === k ? null : k)}>
              {FEATURE_LABELS[k]}
            </Chip>
          ))}
        </div>

        <p className="mb-3 text-xs text-neutral-500">
          {visible.length} tee{visible.length === 1 ? "" : "s"}
        </p>

        {hydrated ? (
          visible.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {visible.slice(0, limit).map(({ shirt, score }) => (
                  <ProductCard
                    key={shirt.id}
                    shirt={shirt}
                    score={score}
                    color={teeView === "original" ? undefined : teeView}
                    highlight={complete && shirt.id === bestId ? "Top pick" : undefined}
                  />
                ))}
              </div>
              {limit < visible.length && (
                <div ref={sentinel} className="flex justify-center pt-6">
                  <button
                    type="button"
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                    className="h-10 rounded-full px-5 text-xs font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/5"
                  >
                    Show more · {visible.length - limit} left
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-sm text-neutral-500">
              No tees match these filters.
              <button type="button" onClick={() => setStyle(null)} className="ml-1 font-semibold text-white underline">
                Clear filters
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="flex rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/10" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
            value === o.value ? "bg-white text-black" : "text-neutral-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-colors ${
        active ? "bg-white text-black" : "bg-white/[0.04] text-neutral-300 ring-1 ring-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
