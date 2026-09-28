"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { TeeMockup } from "@/components/TeeMockup";
import { ZoomViewer } from "@/components/ZoomViewer";
import { STAGE_BG } from "@/components/ui";
import { getShirtById, productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { SIZES } from "@/lib/images";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { ADULT_SIZES, COLOR_LABELS, KID_SIZES, SIZE_LABELS, teeColor, type BaseColor, type ShirtProduct, type ShirtSize } from "@/types/shirt";

/** One tee picked for the bag: its colour, and its size once chosen. */
interface Pick {
  color: BaseColor;
  size?: ShirtSize;
}

const control = "h-10 w-full rounded-lg bg-white/[0.06] px-2 text-sm font-semibold text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white";

/**
 * Liked tees (`/liked/`, the header's heart): every tee liked in Discover or
 * hearted in the shop, as a gallery to buy from. Pick one or more, give each
 * a colour and size, and "Add selected to bag" puts them all in the bag.
 * The picks live in memory only; the likes are the taste store's.
 */
export function LikedView() {
  const hydrated = useHydrated();
  const router = useRouter();
  const likedIds = useTasteStore((s) => s.likedIds);
  const showToast = useUiStore((s) => s.showToast);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [zoom, setZoom] = useState<{ shirt: ShirtProduct; color: BaseColor } | null>(null);

  // Newest like first.
  const items = useMemo(
    () =>
      [...likedIds]
        .reverse()
        .map((id) => getShirtById(id))
        .filter((s): s is ShirtProduct => Boolean(s)),
    [likedIds],
  );
  const chosen = items.filter((s) => picks[s.id]);
  const total = chosen.reduce((sum, s) => sum + s.price, 0);

  const toggle = (shirt: ShirtProduct) =>
    setPicks((p) => {
      if (p[shirt.id]) {
        const { [shirt.id]: _gone, ...rest } = p;
        return rest;
      }
      const cart = useCartStore.getState();
      return { ...p, [shirt.id]: { color: teeColor(shirt, cart.selectedColors[shirt.id]), size: sizeFor(cart, shirt.id) } };
    });
  const edit = (id: string, patch: Partial<Pick>) => {
    setPicks((p) => (p[id] ? { ...p, [id]: { ...p[id], ...patch } } : p));
    if (patch.size) setMissing((m) => m.filter((x) => x !== id));
  };
  const allChosen = items.length > 0 && chosen.length === items.length;
  const toggleAll = () => {
    if (allChosen) return setPicks({});
    const cart = useCartStore.getState();
    setPicks(Object.fromEntries(items.map((s) => [s.id, picks[s.id] ?? { color: teeColor(s, cart.selectedColors[s.id]), size: sizeFor(cart, s.id) }])));
  };

  const unlike = (shirt: ShirtProduct) => {
    const { likedIds, removeLiked, restoreSaved } = useTasteStore.getState();
    const at = likedIds.indexOf(shirt.id);
    removeLiked(shirt.id);
    setPicks((p) => {
      const { [shirt.id]: _gone, ...rest } = p;
      return rest;
    });
    showToast(`Removed ${shirt.title} from your likes`, { label: "Undo", run: () => restoreSaved(shirt.id, at) });
  };

  const addSelected = () => {
    const noSize = chosen.filter((s) => !picks[s.id].size).map((s) => s.id);
    if (noSize.length) {
      setMissing(noSize);
      document.getElementById(`liked-size-${noSize[0]}`)?.focus();
      return;
    }
    const { addToCart } = useCartStore.getState();
    const added = chosen.filter((s) => addToCart(s.id, picks[s.id].size!, picks[s.id].color, 1, { source: "liked", silent: true }));
    if (!added.length) return;
    setPicks({});
    router.push("/cart/");
  };

  if (!hydrated) return <div className="flex-1" />;

  return (
    <div className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-1 2xl:max-w-6xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Liked tees</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {items.length === 0 ? "Nothing liked yet." : `${items.length} tee${items.length === 1 ? "" : "s"} you liked. Pick the ones you want, then choose colour and size.`}
            </p>
          </div>
          {items.length > 1 && (
            <button type="button" onClick={toggleAll} className="h-10 rounded-full px-4 text-sm font-semibold text-neutral-200 ring-1 ring-white/15 hover:bg-white/10">
              {allChosen ? "Clear selection" : "Select all"}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Icon name="heart" className="h-10 w-10 text-neutral-600" />
            <p className="max-w-xs text-sm text-neutral-400">Swipe right on a tee in Discover (or tap its heart in the shop) and it lands here.</p>
            <Link href="/" className="flex h-11 items-center rounded-full bg-white px-6 text-sm font-bold text-black">
              Go to Discover
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Liked tees">
            {items.map((shirt) => {
              const pick = picks[shirt.id];
              const color = pick?.color ?? teeColor(shirt, null);
              const needsSize = missing.includes(shirt.id) && pick && !pick.size;
              return (
                <li key={shirt.id} data-liked={shirt.id} className={`flex flex-col rounded-2xl p-2 ring-1 transition ${pick ? "bg-white/[0.06] ring-2 ring-white" : "bg-white/[0.02] ring-white/10"}`}>
                  <div className={`relative overflow-hidden rounded-xl ${STAGE_BG}`}>
                    <button type="button" onClick={() => setZoom({ shirt, color })} aria-label={`View ${shirt.title} full size`} className="block w-full cursor-zoom-in p-1.5">
                      <TeeMockup shirt={shirt} color={color} sizes={SIZES.grid} className="w-full" />
                    </button>
                    <label className="absolute left-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 backdrop-blur-md">
                      <input type="checkbox" checked={!!pick} onChange={() => toggle(shirt)} aria-label={`Select ${shirt.title}`} className="peer sr-only" />
                      <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-md ring-1 peer-focus-visible:ring-2 ${pick ? "bg-white text-black ring-white" : "ring-white/60"}`}>
                        {pick && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => unlike(shirt)}
                      aria-label={`Remove ${shirt.title} from likes`}
                      title="Remove from likes"
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-black/80"
                    >
                      <Icon name="heart" className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2 px-1">
                    <Link href={productHref(shirt.id)} className="min-w-0 text-sm font-semibold leading-snug hover:underline">
                      <span className="line-clamp-2">{shirt.title}</span>
                    </Link>
                    <span className="shrink-0 font-mono text-sm">{formatPrice(shirt.price)}</span>
                  </div>
                  {pick ? (
                    <div className="mt-2 grid gap-2 px-1">
                      <select value={pick.color} onChange={(e) => edit(shirt.id, { color: e.target.value as BaseColor })} disabled={shirt.colors.length < 2} aria-label={`Colour for ${shirt.title}`} className={control}>
                        {shirt.colors.map((c) => (
                          <option key={c} value={c} className="bg-ink-900">
                            {COLOR_LABELS[c]} tee
                          </option>
                        ))}
                      </select>
                      <select
                        id={`liked-size-${shirt.id}`}
                        value={pick.size ?? ""}
                        onChange={(e) => edit(shirt.id, { size: e.target.value as ShirtSize })}
                        aria-label={`Size for ${shirt.title}`}
                        aria-invalid={!!needsSize}
                        className={`${control} ${needsSize ? "ring-2 ring-white" : ""}`}
                      >
                        <option value="" disabled className="bg-ink-900">
                          Choose size
                        </option>
                        {([["Adults", ADULT_SIZES], ["Kids", KID_SIZES]] as const).map(([label, group]) => (
                          <optgroup key={label} label={label} className="bg-ink-900">
                            {group.map((s) => (
                              <option key={s} value={s} className="bg-ink-900">
                                Size {SIZE_LABELS[s]}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {needsSize && (
                        <p role="alert" className="text-xs font-medium text-white">
                          Choose a size
                        </p>
                      )}
                      <button type="button" onClick={() => toggle(shirt)} className="h-9 text-xs text-neutral-400 underline underline-offset-2 hover:text-white">
                        Remove from selection
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => toggle(shirt)} className="mx-1 mt-2 h-10 rounded-full text-sm font-semibold ring-1 ring-white/20 hover:bg-white/10">
                      Select
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <p className="shrink-0 text-sm text-neutral-300">
              <span className="font-mono text-white">{formatPrice(total)}</span>
            </p>
            <button type="button" onClick={addSelected} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-5 text-sm font-bold uppercase tracking-wide text-black active:scale-[0.98]">
              <Icon name="shopping-bag" className="h-4 w-4 shrink-0" />
              <span className="truncate">Add selected to bag · {chosen.length}</span>
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>{zoom && <ZoomViewer shirt={zoom.shirt} color={zoom.color} onClose={() => setZoom(null)} />}</AnimatePresence>
    </div>
  );
}
