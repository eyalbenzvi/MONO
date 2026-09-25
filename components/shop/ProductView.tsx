"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Heart, Ruler, ShoppingBag } from "lucide-react";
import { useHydrated } from "@/components/AppShell";
import { PrintImage } from "@/components/PrintImage";
import { ProductCard } from "@/components/shop/ProductCard";
import { Spec } from "@/components/ShirtCard";
import { TeeMockup } from "@/components/TeeMockup";
import { ColorSelector, LABEL, MatchBadge, SizeSelector, STAGE_BG, TraitChips, useShowMatch } from "@/components/ui";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { explainMatch, matchScore, similarShirts } from "@/lib/recommendation";
import { useShirtStore } from "@/store/useShirtStore";
import { makeHeaderScrollHandler, useUiStore } from "@/store/useUiStore";
import { CATEGORY_LABELS, COLOR_LABELS, PRINT_SIZE_CM, SIZE_GUIDE, SIZES, skuFor } from "@/types/shirt";

type View = "tee" | "print";
const VIEWS: { value: View; label: string }[] = [
  { value: "tee", label: "On the tee" },
  { value: "print", label: "Print" },
];

export function ProductView({ id }: { id: string }) {
  const shirt = getShirtById(id);
  const router = useRouter();
  const hydrated = useHydrated();
  const showMatch = useShowMatch();
  const vector = useShirtStore((s) => s.preferenceVector);
  const selected = useShirtStore((s) => s.selectedSizes[id]);
  const setSize = useShirtStore((s) => s.setSize);
  const pickedColor = useShirtStore((s) => s.selectedColors[id]);
  const setColor = useShirtStore((s) => s.setColor);
  const addToCart = useShirtStore((s) => s.addToCart);
  const saved = useShirtStore((s) => s.likedIds.includes(id));
  const toggleSaved = useShirtStore((s) => s.toggleSaved);
  const cameFromShop = useUiStore((s) => s.cameFromShop);
  const setCameFromShop = useUiStore((s) => s.setCameFromShop);
  const [view, setView] = useState<View>("tee");
  const [guideOpen, setGuideOpen] = useState(false);
  const [nudge, setNudge] = useState(0);
  const sizeRow = useRef<HTMLDivElement>(null);
  const onScroll = useMemo(() => makeHeaderScrollHandler(), []);

  // Specs are open by default on desktop, collapsed on phones.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => setDetailsOpen(window.matchMedia("(min-width: 768px)").matches), []);

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
  const size = hydrated ? selected : undefined;
  const score = matchScore(vector, shirt.features);
  const reasons = showMatch ? explainMatch(vector, shirt.features) : [];
  const similar = similarShirts(shirt, SHIRTS, 4);

  // Never a dead, disabled button: without a size it guides you to the sizes.
  const onBuy = () => {
    if (size) return addToCart(shirt.id, size, color);
    sizeRow.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setNudge((n) => n + 1);
  };
  const buyLabel = size ? `Add to bag · $${shirt.price}` : "Choose size";

  const goBack = () => {
    // Return to the exact shop state (filters + scroll) when we came from it.
    if (cameFromShop) {
      setCameFromShop(false);
      router.back();
    } else router.push("/shop/");
  };

  return (
    <div onScroll={onScroll} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-1">
        <button type="button" onClick={goBack} className="mb-2 inline-flex h-10 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Shop
        </button>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Visual */}
          <div className={`relative flex aspect-square max-h-[60dvh] w-full items-center justify-center overflow-hidden rounded-[28px] ring-1 ring-white/10 md:aspect-[4/5] md:max-h-none ${STAGE_BG}`}>
            {showMatch && (
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
                className="flex h-full w-full items-center justify-center p-5 pb-14"
              >
                {view === "print" ? (
                  <div className="aspect-[3/4] h-[88%] overflow-hidden rounded-[3px] shadow-2xl shadow-black/60">
                    <PrintImage shirt={shirt} color={color} />
                  </div>
                ) : (
                  <TeeMockup shirt={shirt} color={color} className="h-full max-h-full" />
                )}
              </motion.div>
            </AnimatePresence>
            <div className="absolute bottom-3 right-3 flex rounded-full bg-black/50 p-0.5 ring-1 ring-white/15 backdrop-blur-md" role="tablist" aria-label="View">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="tab"
                  aria-selected={view === v.value}
                  onClick={() => setView(v.value)}
                  className={`h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                    view === v.value ? "bg-white text-black" : "text-neutral-200 hover:text-white"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-sm text-neutral-400">{CATEGORY_LABELS[shirt.category]}</p>
            <div className="mt-0.5 flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{shirt.title}</h1>
              <span className="mt-0.5 font-mono text-xl font-semibold md:text-2xl">${shirt.price}</span>
            </div>

            {reasons.length > 0 && (
              <div className="mt-3">
                <p className={LABEL}>Why it matches you</p>
                <TraitChips keys={reasons} />
              </div>
            )}

            <p className="mt-3 text-sm leading-relaxed text-neutral-300">{shirt.description}</p>

            <div className="mt-5">
              <p className={LABEL}>Tee colour</p>
              <ColorSelector value={color} original={shirt.baseColor} onChange={(c) => setColor(shirt.id, c)} />
            </div>

            <div className="mt-5" ref={sizeRow}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-400">Size</p>
                <button
                  type="button"
                  onClick={() => setGuideOpen((o) => !o)}
                  aria-expanded={guideOpen}
                  className="-mr-2 flex h-10 items-center gap-1.5 px-2 text-xs text-neutral-300 hover:text-white"
                >
                  <Ruler className="h-3.5 w-3.5" /> Size guide
                </button>
              </div>
              <SizeSelector key={nudge} value={size} onChange={(s) => setSize(shirt.id, s)} highlight={nudge > 0 && !size} />
              <AnimatePresence initial={false}>
                {guideOpen && (
                  <motion.table
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 w-full overflow-hidden text-left font-mono text-xs text-neutral-300"
                  >
                    <thead className="text-neutral-400">
                      <tr>
                        <th className="py-1 font-normal">cm</th>
                        {SIZES.map((s) => <th key={s} className="py-1 font-normal">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 text-neutral-400">Chest ½</td>
                        {SIZES.map((s) => <td key={s}>{SIZE_GUIDE[s].chest}</td>)}
                      </tr>
                      <tr>
                        <td className="py-1 text-neutral-400">Length</td>
                        {SIZES.map((s) => <td key={s}>{SIZE_GUIDE[s].length}</td>)}
                      </tr>
                    </tbody>
                  </motion.table>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop: inline buy row (mobile uses the sticky bar below) */}
            <div className="mt-4 hidden gap-2 md:flex">
              <BuyButton label={buyLabel} onClick={onBuy} disabled={!hydrated} />
              <SaveToggle saved={hydrated && saved} onClick={() => toggleSaved(shirt.id)} />
            </div>

            <div className="mt-5 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
                className="flex h-12 w-full items-center justify-between text-sm font-medium"
              >
                Details
                <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
              </button>
              {detailsOpen && (
                <dl className="pb-2">
                  <Spec label="Tee" value={COLOR_LABELS[color]} />
                  <Spec label="Ink" value={black ? "White, 1 colour" : "Black, 1 colour"} />
                  <Spec label="Print" value={`${PRINT_SIZE_CM.width}×${PRINT_SIZE_CM.height} cm`} />
                  <Spec label="Fabric" value="100% organic cotton, 220 gsm" />
                  <Spec label="Fit" value="Regular" />
                  <Spec label="SKU" value={skuFor(shirt.sku, color)} />
                </dl>
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-400">Free shipping over $80 · demo store, nothing is charged</p>
          </div>
        </div>

        {/* Client-only: keeps the 1,000 pre-rendered product pages small. */}
        {hydrated && (
          <section className="mt-10">
            <h2 className="mb-3 text-base font-semibold">Similar prints</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
              {similar.map((s) => (
                <ProductCard key={s.id} shirt={s} score={matchScore(vector, s.features)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile: sticky buy bar, always visible, never disabled */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:hidden">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-base font-semibold">${shirt.price}</p>
          <p className="truncate text-xs text-neutral-400">
            {COLOR_LABELS[color]} tee{size ? ` · ${size}` : ""}
          </p>
        </div>
        <SaveToggle saved={hydrated && saved} onClick={() => toggleSaved(shirt.id)} />
        <BuyButton label={buyLabel} onClick={onBuy} disabled={!hydrated} compact />
      </div>
    </div>
  );
}

function BuyButton({ label, onClick, disabled, compact }: { label: string; onClick: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] ${
        compact ? "px-5" : "flex-1"
      }`}
    >
      <ShoppingBag className="h-4 w-4" />
      {label}
    </button>
  );
}

function SaveToggle({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      animate={saved ? { scale: [1, 1.25, 1] } : { scale: 1 }}
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 ring-white/15 ${
        saved ? "bg-white text-black" : "bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      <Heart className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
    </motion.button>
  );
}
