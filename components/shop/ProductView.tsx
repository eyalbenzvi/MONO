"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Heart, ShoppingBag } from "lucide-react";
import { useHydrated } from "@/components/AppShell";
import { PrintImage } from "@/components/PrintImage";
import { ProductCard } from "@/components/shop/ProductCard";
import { Spec } from "@/components/ShirtCard";
import { TeeMockup } from "@/components/TeeMockup";
import { ColorSelector, MatchBadge, SizeSelector, STAGE_BG, TraitChips } from "@/components/ui";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { explainMatch, matchScore, similarShirts } from "@/lib/recommendation";
import { useShirtStore } from "@/store/useShirtStore";
import { CATEGORY_LABELS, COLOR_LABELS, PRINT_SIZE_CM, SIZE_GUIDE, SIZES, skuFor } from "@/types/shirt";

type View = "tee" | "print";
const VIEWS: { value: View; label: string }[] = [
  { value: "tee", label: "On the tee" },
  { value: "print", label: "Print" },
];

export function ProductView({ id }: { id: string }) {
  const shirt = getShirtById(id);
  const hydrated = useHydrated();
  const vector = useShirtStore((s) => s.preferenceVector);
  const selected = useShirtStore((s) => s.selectedSizes[id]);
  const setSize = useShirtStore((s) => s.setSize);
  const pickedColor = useShirtStore((s) => s.selectedColors[id]);
  const setColor = useShirtStore((s) => s.setColor);
  const addToCart = useShirtStore((s) => s.addToCart);
  const saved = useShirtStore((s) => s.likedIds.includes(id));
  const toggleSaved = useShirtStore((s) => s.toggleSaved);
  const [view, setView] = useState<View>("tee");
  const [guideOpen, setGuideOpen] = useState(false);

  if (!shirt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-neutral-400">
        This tee doesn&apos;t exist.
        <Link href="/shop/" className="font-semibold text-white underline">Back to shop</Link>
      </div>
    );
  }

  // Before hydration render the original colourway so SSR and client agree.
  const color = (hydrated && pickedColor) || shirt.baseColor;
  const black = color === "black";
  const score = matchScore(vector, shirt.features);
  const reasons = explainMatch(vector, shirt.features);
  const similar = similarShirts(shirt, SHIRTS, 4);

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-1">
        <Link href="/shop/" className="mb-3 inline-flex h-9 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Shop
        </Link>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Visual */}
          <div>
            <div className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[28px] ring-1 ring-white/10 ${STAGE_BG}`}>
              {hydrated && (
                <div className="absolute left-4 top-4 z-10">
                  <MatchBadge score={score} />
                </div>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${view}-${color}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full w-full items-center justify-center p-6"
                >
                  {view === "print" ? (
                    <div className="aspect-[3/4] h-[78%] overflow-hidden rounded-[3px] shadow-2xl shadow-black/60">
                      <PrintImage shirt={shirt} color={color} />
                    </div>
                  ) : (
                    <TeeMockup shirt={shirt} color={color} className="h-full max-h-full" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-3 flex justify-center">
              <div className="flex rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="View">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="tab"
                    aria-selected={view === v.value}
                    onClick={() => setView(v.value)}
                    className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
                      view === v.value ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{CATEGORY_LABELS[shirt.category]} · {skuFor(shirt.sku, color)}</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{shirt.title}</h1>
              <span className="mt-1 font-mono text-2xl font-semibold">${shirt.price}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">{shirt.description}</p>

            {hydrated && reasons.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-neutral-500">Why it matches you</p>
                <TraitChips keys={reasons} />
              </div>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
              <Spec label="Tee" value={COLOR_LABELS[color]} />
              <Spec label="Ink" value={black ? "White, 1 colour" : "Black, 1 colour"} />
              <Spec label="Print" value={`${PRINT_SIZE_CM.width}×${PRINT_SIZE_CM.height} cm`} />
              <Spec label="Style" value={CATEGORY_LABELS[shirt.category]} />
              <Spec label="Fabric" value="100% organic cotton" />
              <Spec label="Weight" value="220 gsm, regular fit" />
            </dl>

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Tee colour</p>
              <ColorSelector value={color} original={shirt.baseColor} onChange={(c) => setColor(shirt.id, c)} />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Size</p>
                <button type="button" onClick={() => setGuideOpen((o) => !o)} className="text-xs text-neutral-400 underline hover:text-white">
                  Size guide
                </button>
              </div>
              <SizeSelector value={hydrated ? selected : undefined} onChange={(s) => setSize(shirt.id, s)} />
              <AnimatePresence initial={false}>
                {guideOpen && (
                  <motion.table
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 w-full overflow-hidden text-left font-mono text-xs text-neutral-300"
                  >
                    <thead className="text-neutral-500">
                      <tr>
                        <th className="py-1 font-normal">cm</th>
                        {SIZES.map((s) => <th key={s} className="py-1 font-normal">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 text-neutral-500">Chest ½</td>
                        {SIZES.map((s) => <td key={s}>{SIZE_GUIDE[s].chest}</td>)}
                      </tr>
                      <tr>
                        <td className="py-1 text-neutral-500">Length</td>
                        {SIZES.map((s) => <td key={s}>{SIZE_GUIDE[s].length}</td>)}
                      </tr>
                    </tbody>
                  </motion.table>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!hydrated || !selected}
                onClick={() => selected && addToCart(shirt.id, selected, color)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] disabled:bg-white/10 disabled:text-neutral-500"
              >
                <ShoppingBag className="h-4 w-4" />
                {hydrated && selected ? `Add to bag · ${COLOR_LABELS[color]} · ${selected}` : "Select a size"}
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => toggleSaved(shirt.id)}
                aria-pressed={hydrated && saved}
                aria-label={saved ? "Remove from saved" : "Save"}
                className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-white/15 ${
                  hydrated && saved ? "bg-white text-black" : "bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                <Heart className={`h-5 w-5 ${hydrated && saved ? "fill-current" : ""}`} />
              </motion.button>
            </div>
            <p className="mt-2 text-center text-[11px] text-neutral-500">Free shipping over $80 · demo store, nothing is charged</p>
          </div>
        </div>

        {/* Client-only: keeps the 1,000 pre-rendered product pages small. */}
        {hydrated && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-neutral-400">Similar prints</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
            {similar.map((s) => (
              <ProductCard key={s.id} shirt={s} score={matchScore(vector, s.features)} />
            ))}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}
