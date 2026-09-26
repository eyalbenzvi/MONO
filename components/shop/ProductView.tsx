"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Layers, Leaf, Repeat, Ruler, Share2, ShoppingBag, Truck, X, ZoomIn } from "lucide-react";
import { PrintImage } from "@/components/PrintImage";
import { ProductCard } from "@/components/shop/ProductCard";
import { MiniBag } from "@/components/shop/MiniBag";
import { TeeMockup } from "@/components/TeeMockup";
import { ZoomViewer } from "@/components/ZoomViewer";
import { ColorSelector, LABEL, MatchBadge, SaveButton, ShareButton, SizeSelector, Spec, STAGE_BG, TraitChips, useShowMatch } from "@/components/ui";
import { familyMembers, getShirtById, productHref } from "@/lib/catalog";
import { useShirtDetails } from "@/lib/details";
import { explainMatch, matchScore } from "@/lib/recommendation";
import { matchTier } from "@/lib/match";
import { SHARE_PARAMS, parseShareParams } from "@/lib/share";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { makeHeaderScrollHandler, scrollIntoViewQuietly, useUiStore, useHydrated } from "@/store/useUiStore";
import { CATEGORY_LABELS, CATEGORY_VIBES, COLOR_LABELS, PRINT_SIZE_CM, SIZE_GUIDE, SIZES, skuFor, type ShirtDetails, type ShirtProduct } from "@/types/shirt";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, PAIR_PRICE } from "@/lib/cart";
import { STORE_POLICY, type TrustKey } from "@/lib/store-policy";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { track } from "@/lib/analytics";

type View = "tee" | "print";
const VIEWS: { value: View; label: string }[] = [
  { value: "tee", label: "On the tee" },
  { value: "print", label: "Print" },
];

/**
 * `details` come as props from the pre-rendered page (/shop/<id>/); the
 * client route (/shop/p/?id=) leaves them out and they are fetched.
 */
export function ProductView({ id, details: initialDetails }: { id: string; details?: ShirtDetails | null }) {
  const shirt = getShirtById(id);
  const details = useShirtDetails(shirt ? id : null, initialDetails);
  const router = useRouter();
  const hydrated = useHydrated();
  const showMatch = useShowMatch();
  const vector = useTasteStore((s) => s.preferenceVector);
  // The size picked for this tee, else the one remembered from any other.
  const selected = useCartStore((s) => sizeFor(s, id));
  const setSize = useCartStore((s) => s.setSize);
  const pickedColor = useCartStore((s) => s.selectedColors[id]);
  const setColor = useCartStore((s) => s.setColor);
  const addToCart = useCartStore((s) => s.addToCart);
  const addPair = useCartStore((s) => s.addPair);
  // After adding: "✓ Added" for a moment, then the button leads to the bag
  // (until the size or colour changes).
  const [added, setAdded] = useState<{ key: string; phase: "added" | "view" } | null>(null);
  const productOrigin = useUiStore((s) => s.productOrigin);
  const setProductOrigin = useUiStore((s) => s.setProductOrigin);
  const clearOrigin = useCallback(() => setProductOrigin(null), [setProductOrigin]);
  const [view, setView] = useState<View>("tee");
  const zoom = useUiStore((s) => s.zoomId === id);
  const setZoom = (open: boolean) => useUiStore.getState().setZoom(open ? id : null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [nudge, setNudge] = useState(0);
  const sizeRow = useRef<HTMLDivElement>(null);
  const onScroll = useMemo(() => makeHeaderScrollHandler(), []);

  // Arriving via ".../#variations" (e.g. from a Discover card): jump to them.
  const variationsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hydrated && window.location.hash === "#variations")
      requestAnimationFrame(() => scrollIntoViewQuietly(variationsRef.current, { behavior: "smooth", block: "start" }));
  }, [hydrated]);

  // Opened from a shared link (?c=white&ref=whatsapp): show the tee in the
  // colour it was shared in, and greet the visitor.
  const [sharedVia, setSharedVia] = useState<string | null>(null);
  const calibrated = useTasteStore((s) => s.calibrationAcknowledged);
  useEffect(() => {
    if (!hydrated || !shirt) return;
    const { color: c, ref } = parseShareParams(window.location.search);
    if (c) setColor(shirt.id, c);
    if (ref) setSharedVia(ref);
    // Clean the URL so a reload or a re-share doesn't carry the tag along.
    if (c || ref) {
      const q = new URLSearchParams(window.location.search);
      for (const k of SHARE_PARAMS) q.delete(k);
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
    }
  }, [hydrated, shirt, setColor]);

  useEffect(() => {
    if (shirt) track("product_view", { id: shirt.id, category: shirt.category, price: shirt.price });
  }, [shirt]);

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
  const tier = showMatch ? matchTier(vector, shirt.features) : null;
  const reasons = showMatch ? explainMatch(vector, shirt.features) : [];
  const members = familyMembers(shirt);
  // "Similar" = related but *different* designs: never this family (those are
  // the variations above) and at most one per algorithm. Precomputed by the
  // generator, closest first.
  const similar = (details?.similar ?? [])
    .map(getShirtById)
    .filter((s): s is ShirtProduct => !!s)
    .slice(0, 4);

  const addedKey = `${size}-${color}`;
  const phase = added?.key === addedKey ? added.phase : null;
  const confirmAdded = (key: string) => {
    setAdded({ key, phase: "added" });
    // The header comes back so the bag (and its count) is in view.
    useUiStore.getState().setHeaderHidden(false);
    setTimeout(() => setAdded((a) => (a?.key === key ? { key, phase: "view" } : a)), 1200);
  };
  const needSize = () => {
    scrollIntoViewQuietly(sizeRow.current);
    setNudge((n) => n + 1);
  };

  // Never a dead, disabled button: without a size it guides you to the sizes.
  const onBuy = () => {
    if (!size) return needSize();
    if (phase === "view") return router.push("/cart/");
    if (addToCart(shirt.id, size, color, 1, { quiet: true })) confirmAdded(addedKey);
  };
  const onPair = () => {
    if (!size) return needSize();
    if (addPair(shirt.id, size, { quiet: true })) confirmAdded(addedKey);
  };
  const buyLabel = !size
    ? "Choose size"
    : phase === "added"
      ? "Added"
      : phase === "view"
        ? "View bag · Checkout"
        : `Add to bag · ${size}`;

  const goBack = () => {
    // Return to the exact shop state (filters + scroll) when we came from it.
    if (productOrigin === "/shop/") {
      setProductOrigin(null);
      router.back();
    } else router.push("/shop/");
  };

  return (
    <div onScroll={onScroll} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-1">
        <button type="button" onClick={goBack} className="mb-2 inline-flex h-10 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Shop
        </button>

        <AnimatePresence>
          {sharedVia && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10"
              role="status"
            >
              <Share2 className="h-5 w-5 shrink-0 text-neutral-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">A friend shared this tee with you</p>
                <p className="text-xs text-neutral-400">{calibrated ? "Your shop is ranked for you — have a look around." : `Swipe ${CALIBRATION_TOTAL} tees and MONO learns your taste.`}</p>
              </div>
              <Link href={calibrated ? "/shop/" : "/"} className="flex h-9 shrink-0 items-center rounded-full bg-white px-3.5 text-xs font-bold text-black">
                {calibrated ? "My shop" : "Try it"}
              </Link>
              <button type="button" onClick={() => setSharedVia(null)} aria-label="Dismiss" className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Visual */}
          <div className={`relative flex aspect-square max-h-[60dvh] w-full items-center justify-center overflow-hidden rounded-[28px] ring-1 ring-white/10 md:aspect-[4/5] md:max-h-none ${STAGE_BG}`}>
            {showMatch && tier && (
              <div className="absolute left-4 top-4 z-10">
                <MatchBadge tier={tier} why={() => explainMatch(vector, shirt.features)} />
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
                    <PrintImage shirt={shirt} color={color} priority />
                  </div>
                ) : (
                  <TeeMockup shirt={shirt} color={color} priority className="h-full max-h-full" />
                )}
              </motion.div>
            </AnimatePresence>
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              <button
                type="button"
                onClick={() => setZoom(true)}
                aria-label="Zoom in on the print"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/70"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>
            {/* Tee colour, right on the picture: visible without scrolling. */}
            <div className="absolute bottom-3 left-3">
              <ColorSelector variant="overlay" value={color} original={shirt.baseColor} onChange={(c) => setColor(shirt.id, c)} />
            </div>
            <div className="absolute bottom-3 right-3 flex rounded-full bg-black/50 p-0.5 ring-1 ring-white/15 backdrop-blur-md" role="group" aria-label="View">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={view === v.value}
                  onClick={() => setView(v.value)}
                  className={`h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                    view === v.value ? "bg-white text-black" : "text-neutral-200 hover:text-white"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <AnimatePresence>{zoom && <ZoomViewer shirt={shirt} color={color} initialView={view} onClose={() => setZoom(false)} />}</AnimatePresence>
          </div>

          {/* Info */}
          <div>
            <p className="text-sm text-neutral-400">
              {CATEGORY_LABELS[shirt.category]} <span className="ml-1 font-mono text-xs">No. {String(shirt.no).padStart(3, "0")}</span>
            </p>
            <div className="mt-0.5 flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{shirt.title}</h1>
              <span className="mt-0.5 font-mono text-xl font-semibold md:text-2xl">{formatPrice(shirt.price)}</span>
            </div>

            {reasons.length > 0 && (
              <div className="mt-3">
                <p className={LABEL}>Why it matches you</p>
                <TraitChips keys={reasons} />
              </div>
            )}

            <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-neutral-300">{details?.description}</p>
            <p className="mt-2 text-xs text-neutral-400">{CATEGORY_VIBES[shirt.category]}</p>

            {members.length > 1 ? (
              <button
                type="button"
                onClick={() => scrollIntoViewQuietly(variationsRef.current, { behavior: "smooth", block: "start" })}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                <Layers className="h-4 w-4" /> See {members.length - 1} close variation{members.length === 2 ? "" : "s"}
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            ) : (
              <p className="mt-3 text-xs text-neutral-400">One of a kind — no close variations.</p>
            )}

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
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <p className="mt-3 text-xs text-neutral-300">{STORE_POLICY.fit}</p>
                  <table className="mt-2 w-full text-left font-mono text-xs text-neutral-300">
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
                  </table>
                  </motion.div>
                )}
              </AnimatePresence>
              <TrustLine />
            </div>


            {/* Desktop: inline buy row (mobile uses the sticky bar below) */}
            <div className="mt-4 hidden gap-2 md:flex">
              <BuyButton label={buyLabel} phase={phase} onClick={onBuy} disabled={!hydrated} />
              <SaveButton id={shirt.id} size="lg" />
              <ShareButton id={shirt.id} title={shirt.title} color={color} size="lg" />
            </div>

            {/* The pair: same print in both tee colours, one tap. */}
            <button
              type="button"
              onClick={onPair}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left ring-1 ring-white/10 hover:bg-white/[0.07]"
            >
              <span className="flex items-center gap-3">
                <span className="flex -space-x-2" aria-hidden>
                  <span className="h-5 w-5 rounded-full bg-black ring-1 ring-white/50" />
                  <span className="h-5 w-5 rounded-full bg-white ring-1 ring-black/20" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Get it in both</span>
                  <span className="block text-xs text-neutral-400">Black + White{size ? ` · ${size}` : ""}</span>
                </span>
              </span>
              <span className="font-mono text-sm font-semibold">{formatPrice(PAIR_PRICE)}</span>
            </button>

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
            <p className="mt-2 text-xs text-neutral-400">Free shipping over {formatPrice(FREE_SHIPPING_THRESHOLD)} · demo store, nothing is charged</p>
          </div>
        </div>

        {/* Client-only: keeps the pre-rendered product pages small. */}
        {hydrated && members.length > 1 && (
          <section ref={variationsRef} id="variations" className="mt-10 scroll-mt-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Variations</h2>
              <span className="text-xs text-neutral-400">
                {members.length} versions of this print
              </span>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {members.map((m) => {
                const current = m.id === shirt.id;
                return (
                  <Link
                    key={m.id}
                    href={productHref(m.id)}
                    replace
                    // Keep the tee colour the user is looking at.
                    onClick={() => setColor(m.id, color)}
                    aria-current={current ? "page" : undefined}
                    aria-label={`${m.title}, ${formatPrice(m.price)}${current ? " (showing)" : ""}`}
                    className={`relative w-28 shrink-0 rounded-2xl p-1.5 transition ${STAGE_BG} ${
                      current ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/40"
                    }`}
                  >
                    {current && (
                      <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                    <TeeMockup shirt={m} color={color} shadow={false} className="w-full" />
                    <p className="mt-1 truncate px-0.5 text-xs text-neutral-300">{m.title}</p>
                    <p className="px-0.5 font-mono text-xs text-neutral-400">{formatPrice(m.price)}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {hydrated && similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-base font-semibold">Similar prints</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
              {similar.map((s) => (
                <ProductCard key={s.id} shirt={s} score={matchScore(vector, s.features)} vector={vector} showMatch={showMatch} onOpen={clearOrigin} />
              ))}
            </div>
          </section>
        )}
      </div>

      <MiniBag shirt={shirt} similar={similar} />

      {/* Mobile: sticky buy bar, always visible, never disabled */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:hidden">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-base font-semibold">{formatPrice(shirt.price)}</p>
          <p className="truncate text-xs text-neutral-400">
            {COLOR_LABELS[color]} tee{size ? ` · ${size}` : ""}
          </p>
        </div>
        <SaveButton id={shirt.id} size="lg" />
        <ShareButton id={shirt.id} title={shirt.title} color={color} size="lg" />
        <BuyButton label={buyLabel} phase={phase} onClick={onBuy} disabled={!hydrated} compact />
      </div>
    </div>
  );
}

function BuyButton({
  label,
  phase,
  onClick,
  disabled,
  compact,
}: {
  label: string;
  phase: "added" | "view" | null;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const Icon = phase === "added" ? Check : phase === "view" ? ArrowRight : ShoppingBag;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-live="polite"
      className={`flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] ${
        compact ? "px-5" : "flex-1"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={phase === "added" ? 3 : 2} />
      {label}
    </button>
  );
}

const TRUST_ICONS: Record<TrustKey, typeof Truck> = { exchange: Repeat, shipping: Truck, fabric: Leaf };

/** Quiet store promises under the sizes (lib/store-policy, pending approval). */
function TrustLine() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
      {STORE_POLICY.trust.map(({ key, text }) => {
        const Icon = TRUST_ICONS[key];
        return (
          <li key={key} className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden /> {text}
          </li>
        );
      })}
    </ul>
  );
}

