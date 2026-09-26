"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Layers, Leaf, Repeat, Ruler, Share2, ShoppingBag, Truck, X, ZoomIn } from "lucide-react";
import { PrintImage } from "@/components/PrintImage";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShirtStrip } from "@/components/ShirtStrip";
import { TeeMockup } from "@/components/TeeMockup";
import { ZoomViewer } from "@/components/ZoomViewer";
import { LABEL, MatchBadge, SaveButton, ShareButton, SizeSelector, Spec, STAGE_BG, TraitChips, radioKeys, useShowMatch } from "@/components/ui";
import { familyMembers, getShirtById } from "@/lib/catalog";
import { useShirtDetails } from "@/lib/details";
import { explainMatch } from "@/lib/recommendation";
import { matchTier } from "@/lib/match";
import { isNewThisWeek } from "@/lib/taste";
import { SHARE_PARAMS, parseShareParams } from "@/lib/share";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { makeHeaderScrollHandler, scrollIntoViewQuietly, useUiStore, useHydrated } from "@/store/useUiStore";
import { CATEGORY_LABELS, COLOR_LABELS, SIZE_GUIDE, SIZES, printSizeLabel, skuFor, type BaseColor, type ShirtDetails, type ShirtProduct } from "@/types/shirt";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, PAIR_PRICE, pairLabel, pairStatus } from "@/lib/cart";
import { STORE_POLICY, type TrustKey } from "@/lib/store-policy";
import { CALIBRATION_TOTAL } from "@/lib/deck";
import { track } from "@/lib/analytics";

type View = "tee" | "print";
const VIEWS: { value: View; label: string; short: string }[] = [
  { value: "tee", label: "On the tee", short: "Tee" },
  { value: "print", label: "Print", short: "Print" },
];

type Choice = BaseColor | "both";
const CHOICES: readonly Choice[] = ["black", "white", "both"];

/**
 * The one tee picker, on the picture: black, white, or both (the pair, with
 * its price anchor). Every design comes in both colours; the original is
 * marked in the label.
 */
function TeeChoice({ value, original, price, onChange }: { value: Choice; original: BaseColor; price: number; onChange: (c: Choice) => void }) {
  const keys = radioKeys(CHOICES, value, onChange);
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/55 p-1 ring-1 ring-white/15 backdrop-blur-md" role="radiogroup" aria-label="Tee colour">
      {CHOICES.map((c, i) => {
        const active = value === c;
        const common = { type: "button" as const, role: "radio", "aria-checked": active, onClick: () => onChange(c), ...keys(i) };
        if (c === "both")
          return (
            <button
              key={c}
              {...common}
              aria-label={`Both tees, black and white: ${formatPrice(PAIR_PRICE)} instead of ${formatPrice(price * 2)}`}
              className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full pl-1 pr-2.5 text-xs font-semibold transition ${active ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
            >
              <span aria-hidden className="h-6 w-6 shrink-0 rounded-full bg-[linear-gradient(90deg,#000_50%,#fff_50%)] ring-1 ring-white/40" />
              Both
              <s className={`font-mono font-normal ${active ? "text-neutral-500" : "text-neutral-400"}`}>{formatPrice(price * 2)}</s>
              <span className="font-mono">{formatPrice(PAIR_PRICE)}</span>
            </button>
          );
        const label = `${COLOR_LABELS[c]} tee${c === original ? " (original)" : ""}`;
        return (
          <button
            key={c}
            {...common}
            aria-label={label}
            title={label}
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-shadow before:absolute before:-inset-1 before:content-[''] ${active ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
          >
            <span aria-hidden className={`h-6 w-6 rounded-full ring-1 ${c === "black" ? "bg-black ring-white/50" : "bg-white ring-black/20"}`} />
          </button>
        );
      })}
    </div>
  );
}

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
  const cart = useCartStore((s) => s.cart);
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

  // Details start closed (everywhere).
  const [detailsOpen, setDetailsOpen] = useState(false);
  // "Both": the black + white pair, picked in the same picker as the colour.
  const [both, setBoth] = useState(false);

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

  const addedKey = `${size}-${both ? "both" : color}`;
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

  // What "Both" would add now, given the bag (this size): only what's missing.
  const pair = both && size ? pairStatus(cart, shirt.id, size) : null;
  const pairComplete = !!pair && pair.missing.length === 0;
  // Never a dead, disabled button: without a size it guides you to the sizes.
  const onBuy = () => {
    if (!size) return needSize();
    if (phase === "view" || pairComplete) return router.push("/cart/");
    if (both ? addPair(shirt.id, size) : addToCart(shirt.id, size, color)) confirmAdded(addedKey);
  };
  // "Add to bag · M" → "✓ Added" → "View bag" (until the size or choice changes).
  const idleLabel = pair ? (pair.missing.length === 2 ? `Add both · ${size}` : pairLabel(pair, shirt.price)) : `Add to bag · ${size}`;
  const buyLabel = !size ? "Choose size" : phase === "added" ? "Added" : phase === "view" ? "View bag" : idleLabel;
  const shortLabel = !size || phase ? buyLabel : pair ? (pair.missing.length === 2 ? `Both · ${size}` : pairComplete ? "In your bag ✓" : `Complete +${formatPrice(PAIR_PRICE - shirt.price)}`) : `Add · ${size}`;
  const shownPrice = both ? (
    <>
      <s className="mr-1.5 text-[0.8em] font-normal text-neutral-500">{formatPrice(shirt.price * 2)}</s>
      {formatPrice(PAIR_PRICE)}
    </>
  ) : (
    formatPrice(shirt.price)
  );

  const goBack = () => {
    // Return to the exact shop state (filters + scroll) when this product was
    // opened from the grid; after moving on to another product, history
    // holds that one, so go to the shop instead.
    if (productOrigin?.id === shirt.id) {
      setProductOrigin(null);
      router.back();
    } else router.push("/shop/");
  };

  return (
    // Reaches up under the floating header (see ShopView).
    <div onScroll={onScroll} className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-1 2xl:max-w-6xl">
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
              {/* Phones under 400 px: the buy bar has no room for Share, so it's here. */}
              <button
                type="button"
                onClick={() => useUiStore.getState().openShare(shirt.id, color)}
                aria-label={`Share ${shirt.title}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/70 min-[400px]:hidden"
              >
                <Share2 className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(true)}
                aria-label="Zoom in on the print"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/70"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>
            {/* Tee colour (or both), right on the picture: visible without scrolling. */}
            <div className="absolute bottom-3 left-3">
              <TeeChoice
                value={both ? "both" : color}
                original={shirt.baseColor}
                price={shirt.price}
                onChange={(c) => {
                  setBoth(c === "both");
                  if (c !== "both") setColor(shirt.id, c);
                }}
              />
            </div>
            <div className="absolute bottom-3 right-3 flex rounded-full bg-black/50 p-0.5 ring-1 ring-white/15 backdrop-blur-md" role="group" aria-label="View">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={view === v.value}
                  onClick={() => setView(v.value)}
                  aria-label={v.label}
                  className={`h-9 rounded-full px-3.5 text-xs font-semibold transition-colors max-[399px]:px-2.5 ${
                    view === v.value ? "bg-white text-black" : "text-neutral-200 hover:text-white"
                  }`}
                >
                  {/* Short labels on phones, clear of the tee picker. */}
                  <span className="max-[399px]:hidden">{v.label}</span>
                  <span className="min-[400px]:hidden">{v.short}</span>
                </button>
              ))}
            </div>
            <AnimatePresence>{zoom && <ZoomViewer shirt={shirt} color={color} initialView={view} onClose={() => setZoom(false)} />}</AnimatePresence>
          </div>

          {/* Info */}
          <div>
            <p className="text-sm text-neutral-400">
              {CATEGORY_LABELS[shirt.category]} <span className="ml-1 font-mono text-xs">No. {String(shirt.no).padStart(3, "0")}</span>
              {isNewThisWeek(shirt.dropWeek) && <span className="ml-2 rounded-full border border-dashed border-white/50 px-2 py-0.5 text-xs text-white">New this week</span>}
            </p>
            <div className="mt-0.5 flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{shirt.title}</h1>
              <span className="mt-0.5 whitespace-nowrap font-mono text-xl font-semibold md:text-2xl">{shownPrice}</span>
            </div>

            {reasons.length > 0 && (
              <div className="mt-3">
                <p className={LABEL}>Why it matches you</p>
                <TraitChips keys={reasons} />
              </div>
            )}

            <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-neutral-300">{details?.description}</p>

            {members.length > 1 ? (
              <button
                type="button"
                onClick={() => scrollIntoViewQuietly(variationsRef.current, { behavior: "smooth", block: "start" })}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                <Layers className="h-4 w-4" /> See {members.length - 1} close variation{members.length === 2 ? "" : "s"}
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            ) : null}

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
                  <Spec label="Tee" value={both ? "Black + White" : COLOR_LABELS[color]} />
                  <Spec label="Ink" value={black ? "White, 1 colour" : "Black, 1 colour"} />
                  <Spec label="Print" value={printSizeLabel()} />
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
            {/* Variations replace this page in history, so Back still reaches the grid. */}
            <ShirtStrip
              shirts={members}
              label="Variations"
              prices
              color={color}
              currentId={shirt.id}
              replace
              onOpen={(m) => {
                // Keep the tee colour the user is looking at.
                setColor(m.id, color);
                if (productOrigin?.id === shirt.id) setProductOrigin({ ...productOrigin, id: m.id });
              }}
            />
          </section>
        )}

        {hydrated && similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-base font-semibold">Similar prints</h2>
            <div className="grid grid-cols-1 gap-x-3 gap-y-6 min-[340px]:grid-cols-2 sm:grid-cols-4">
              {similar.map((s) => (
                <ProductCard key={s.id} shirt={s} onOpen={clearOrigin} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile: sticky buy bar, always visible, never disabled */}
      {/* Narrow phones: tighter gaps below 360 px, and below 400 px Share
          moves up to the image toolbar so price, save and the buy button fit. */}
      <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md max-[359px]:gap-2 max-[359px]:px-3 md:hidden">
        {/* The price never gives way: the buy button's label shortens instead. */}
        <div className="min-w-[4.5rem] flex-1">
          <p className="whitespace-nowrap font-mono text-base font-semibold">{shownPrice}</p>
          <p className="truncate text-xs text-neutral-400">
            {both ? "Black + White" : COLOR_LABELS[color]}
            <span className="max-[399px]:hidden">{both ? " tees" : " tee"}</span>
            {size ? ` · ${size}` : ""}
          </p>
        </div>
        <SaveButton id={shirt.id} size="lg" />
        <ShareButton id={shirt.id} title={shirt.title} color={color} size="lg" className="max-[399px]:hidden" />
        <BuyButton label={buyLabel} short={shortLabel} phase={phase} onClick={onBuy} disabled={!hydrated} compact />
      </div>
    </div>
  );
}

function BuyButton({
  label,
  short,
  phase,
  onClick,
  disabled,
  compact,
}: {
  label: string;
  /** Narrow phones (< 400 px): a shorter label, so the price keeps its room. */
  short?: string;
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
      // The full label, whichever one is shown.
      aria-label={label}
      aria-live="polite"
      className={`flex h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] ${
        compact ? "px-5 max-[359px]:px-4" : "flex-1"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={phase === "added" ? 3 : 2} />
      {short && short !== label ? (
        <>
          <span className="truncate max-[399px]:hidden">{label}</span>
          <span className="truncate min-[400px]:hidden">{short}</span>
        </>
      ) : (
        <span className="truncate">{label}</span>
      )}
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

