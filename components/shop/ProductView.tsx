"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PrintImage } from "@/components/PrintImage";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShirtStrip } from "@/components/ShirtStrip";
import { TeeMockup } from "@/components/TeeMockup";
import { TasteSheet } from "@/components/TasteSheet";
import { SIZES } from "@/lib/images";
import { ZoomViewer } from "@/components/ZoomViewer";
import { BUTTON_PRIMARY, SaveButton, SizeSelector, Spec, TeeChoice, TrustLine, useShowMatch, useSizeRequired } from "@/components/ui";
import { useDock } from "@/hooks/useDock";
import { familyMembers, getShirtById } from "@/lib/catalog";
import { useShirtDetails } from "@/lib/details";
import { whyMatch } from "@/lib/why";
import { traitWords } from "@/lib/taste";
import { SHARE_PARAMS, parseShareParams } from "@/lib/share";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore, useHydrated } from "@/store/useUiStore";
import { ADULT_SIZES, CATEGORY_LABELS, COLOR_LABELS, KID_SIZES, SIZE_GUIDE, SIZE_SHORT, printSizeLabel, skuFor, teeColor, type BaseColor, type ShirtDetails, type ShirtProduct } from "@/types/shirt";
import { ctaLabel, pairStatus } from "@/lib/cart";
import { STORE_POLICY } from "@/lib/store-policy";
import { itemOf, track, trackEcommerce } from "@/lib/analytics";
import { madeAllFor } from "@/lib/custom/products";
import { acceptedDesigns, creditLine } from "@/lib/upload/designs";
import { updateQuery } from "@/lib/url";
import { isUploadDesign } from "@/lib/upload/keys";
import { SHARED_SEED_KEY } from "@/components/DiscoverPage";
import { PRODUCT_FALLBACK_TITLE } from "@/lib/seo";

type View = "tee" | "print";
type RelatedLink = { href: string; title: string };


/**
 * `details` come as props from the pre-rendered page (/shop/<id>/); the
 * client route (/shop/p/?id=) leaves them out and they are fetched.
 */
export function ProductView({
  id,
  details: initialDetails,
  related,
}: {
  id: string;
  details?: ShirtDetails | null;
  /** Build-time links (pre-rendered pages): shown until the page is running, then the visual rows replace them. */
  related?: { variations: RelatedLink[]; similar: RelatedLink[] };
}) {
  const shirt = getShirtById(id);
  // An Open Call design (this device only) has no shard of details: its credit is its story.
  const openCall = isUploadDesign(id) ? acceptedDesigns().find((d) => d.id === id) : undefined;
  const details = useShirtDetails(shirt && !openCall ? id : null, initialDetails);
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
  // What was just added (size and colour, or both): the buy button then leads to the bag, until either changes.
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const productOrigin = useUiStore((s) => s.productOrigin);
  const setProductOrigin = useUiStore((s) => s.setProductOrigin);
  const clearOrigin = useCallback(() => setProductOrigin(null), [setProductOrigin]);
  const [view, setView] = useState<View>("tee");
  const zoom = useUiStore((s) => s.zoomId === id);
  const setZoom = (open: boolean) => useUiStore.getState().setZoom(open ? id : null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tasteOpen, setTasteOpen] = useState(false);
  const { nudge, groupRef, require: requireSize, status: sizeStatus } = useSizeRequired("product");

  // Arriving via ".../#variations" (e.g. from a Discover card): jump to them.
  const variationsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hydrated && window.location.hash === "#variations") requestAnimationFrame(() => variationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [hydrated]);

  // Opened from a shared link (?c=white&ref=whatsapp): show the tee in the
  // colour it was shared in, and say so in one line. If it's then saved and
  // the taste test follows, the test starts from it (Discover's first line).
  const [sharedVia, setSharedVia] = useState<string | null>(null);
  useEffect(() => {
    if (!hydrated || !shirt) return;
    const { color: c, ref } = parseShareParams(window.location.search);
    if (c) setColor(shirt.id, c);
    if (ref) {
      setSharedVia(ref);
      try {
        sessionStorage.setItem(SHARED_SEED_KEY, shirt.id);
      } catch {
        /* storage unavailable */
      }
    }
    // Clean the URL so a reload or a re-share doesn't carry the tag along.
    if (c || ref) updateQuery((q) => SHARE_PARAMS.forEach((k) => q.delete(k)));
  }, [hydrated, shirt, setColor]);

  useEffect(() => {
    if (shirt) trackEcommerce("view_item", { item_list_id: productOrigin?.id === shirt.id ? "shop" : undefined, items: [itemOf(shirt)] });
    // Once per product shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shirt]);

  // The client route (/shop/p/?id=) starts with a stand-in title: the design's own, once known.
  useEffect(() => {
    if (shirt && document.title === PRODUCT_FALLBACK_TITLE) document.title = `${shirt.title} | MONO`;
  }, [shirt]);

  // Details start closed (everywhere).
  const [detailsOpen, setDetailsOpen] = useState(false);
  const likedIds = useTasteStore((s) => s.likedIds);
  // "Both": the black + white pair, picked in the same picker as the colour.
  const [pickBoth, setBoth] = useState(false);

  if (!shirt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted">
        This tee doesn&rsquo;t exist.
        <Link href="/shop/" className="text-white underline underline-offset-4">
          Back to the shop
        </Link>
      </div>
    );
  }

  // Before hydration render the original colourway so SSR and client agree.
  // Only colours it's sold in (T3).
  const color = teeColor(shirt, hydrated ? pickedColor : null);
  const both = pickBoth && shirt.colors.length > 1;
  const black = color === "black";
  const size = hydrated ? selected : undefined;
  const why = showMatch ? whyMatch(vector, shirt, likedIds) : null;
  const makes = madeAllFor(shirt.variant);
  const members = familyMembers(shirt);
  // "Similar" = related but *different* designs: never this family (those are
  // the variations above) and at most one per algorithm. Precomputed by the
  // generator, closest first.
  const similar = (details?.similar ?? [])
    .map(getShirtById)
    .filter((s): s is ShirtProduct => !!s)
    .slice(0, 4);
  const alt = details?.description ? `${shirt.title}: ${shortDescription(details.description)}, printed on the back of a ${COLOR_LABELS[color].toLowerCase()} tee` : undefined;

  // What "Both" would add now, given the bag (this size): only what's missing.
  const pair = both && size ? pairStatus(cart, shirt.id, size) : null;
  const choiceKey = `${size}-${both ? "both" : color}`;
  // In the bag already (just added, or the whole pair there): the button leads to checkout and never adds again silently.
  const inBag = (addedKey === choiceKey && !!size) || (!!pair && pair.missing.length === 0);
  const onBuy = () => {
    if (inBag) {
      track("sticky_checkout_click", { id: shirt.id });
      useUiStore.getState().requestCheckout();
      return router.push("/cart/");
    }
    if (!size) return requireSize();
    if (both ? addPair(shirt.id, size, { source: "product" }) : addToCart(shirt.id, size, color, 1, { source: "product" })) setAddedKey(choiceKey);
  };
  // One pattern everywhere: "[verb] · [size] · [price]", the price always in it.
  const buyLabel = inBag ? "In your bag · Checkout" : ctaLabel({ size, price: shirt.price, both, status: pair });

  return (
    // Reaches up under the floating header (see ShopView).
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
        <div className="mx-auto max-w-6xl pb-8 md:grid md:grid-cols-[58%_42%] md:gap-8 md:px-6">
          {/* The picture, full-bleed: swipe from the tee to the flat print. */}
          <Gallery shirt={shirt} color={color} view={view} setView={setView} onZoom={() => setZoom(true)} alt={alt} />
          <AnimatePresence>{zoom && <ZoomViewer shirt={shirt} color={color} initialView={view} printCm={details?.printCm} onClose={() => setZoom(false)} />}</AnimatePresence>

          {/* Info (desktop: sticky beside the pictures). */}
          <div className="px-4 pt-3 md:sticky md:top-[calc(var(--header-h)+16px)] md:self-start md:px-0">
            {sharedVia && (
              <div className="-mt-1 flex items-center justify-between text-xs text-muted">
                <span>Shared with you</span>
                <button
                  type="button"
                  onClick={() => {
                    track("share_banner_action", { action: "dismiss", ref: sharedVia });
                    setSharedVia(null);
                  }}
                  aria-label="Dismiss"
                  className="-mr-3 flex h-11 w-11 items-center justify-center text-muted hover:text-white"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <h1 className="pt-2 text-xl font-medium leading-snug md:text-[28px]">{shirt.title}</h1>
              <button
                type="button"
                onClick={() => useUiStore.getState().openShare(shirt.id, color)}
                aria-label={`Share ${shirt.title}`}
                className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-neutral-300 hover:text-white"
              >
                <Icon name="share-2" className="h-5 w-5" />
              </button>
            </div>
            {openCall && (
              <p className="text-sm text-muted" data-credit>
                {creditLine(openCall)}
              </p>
            )}
            {/* The learning, felt: one line, only when it's true; the whole line opens Your taste. */}
            {why && (
              <button type="button" onClick={() => setTasteOpen(true)} aria-haspopup="dialog" className="-ml-1 flex min-h-11 items-center px-1 text-left text-sm text-muted hover:text-white">
                {why.tier === "top" ? "Top pick" : "For you"} · {traitWords(why.shared.slice(0, 2))}
              </button>
            )}
            {/* The computed skies lead to their made-for-you tee; a design several products are drawn like names each. */}
            {makes.length > 0 && (
              <p className="flex flex-wrap items-center text-sm text-muted" data-make-your-own-list={makes.length > 1 ? "" : undefined}>
                {makes.length === 1 ? (
                  <Link href={`/make/${makes[0].slug}/`} className="-ml-1 inline-flex min-h-11 items-center px-1 hover:text-white" data-make-your-own>
                    Make your own →
                  </Link>
                ) : (
                  <>
                    <span className="mr-1">Make your own:</span>
                    {makes.map((m, i) => (
                      <span key={m.slug} className="inline-flex items-center">
                        {i > 0 && <span aria-hidden>·</span>}
                        <Link href={`/make/${m.slug}/`} className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:text-white hover:underline" data-make-your-own={i === 0 ? "" : undefined}>
                          {m.name}
                        </Link>
                      </span>
                    ))}
                  </>
                )}
              </p>
            )}

            <div className="mt-3">
              <TeeChoice
                value={both ? "both" : color}
                original={shirt.baseColor}
                colors={shirt.colors}
                onChange={(c) => {
                  setBoth(c === "both");
                  if (c === "both") track("pair_select", { id: shirt.id, source: "product" });
                  else setColor(shirt.id, c);
                }}
              />
            </div>

            <div className="mt-2">
              <SizeSelector
                key={nudge}
                value={size}
                onChange={(s) => setSize(shirt.id, s)}
                highlight={nudge > 0 && !size}
                groupRef={groupRef}
                aside={
                  <button
                    type="button"
                    onClick={() => {
                      if (!guideOpen) track("size_guide_open", { id: shirt.id });
                      setGuideOpen((o) => !o);
                    }}
                    aria-expanded={guideOpen}
                    className="-mr-1 flex h-11 min-w-11 items-center px-1 text-sm text-muted underline-offset-4 hover:text-white hover:underline"
                  >
                    Size guide
                  </button>
                }
              />
              {sizeStatus}
              <AnimatePresence initial={false}>
                {guideOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <p className="mt-3 text-xs text-neutral-300">{STORE_POLICY.fit}</p>
                    {(
                      [
                        ["Adults", ADULT_SIZES],
                        ["Kids (print 20 × 26 cm)", KID_SIZES],
                      ] as const
                    ).map(([label, group]) => (
                      <table key={label} className="mt-2 w-full text-left font-mono text-xs text-neutral-300">
                        <caption className="py-1 text-left font-sans text-muted">{label}</caption>
                        <thead className="text-muted">
                          <tr>
                            <th className="py-1 font-normal">cm</th>
                            {group.map((s) => (
                              <th key={s} className="py-1 font-normal">
                                {SIZE_SHORT[s]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1 text-muted">Chest ½</td>
                            {group.map((s) => (
                              <td key={s}>{SIZE_GUIDE[s].chest}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-1 text-muted">Length</td>
                            {group.map((s) => (
                              <td key={s}>{SIZE_GUIDE[s].length}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* One quiet line of what's promised: delivery, returns, fabric (lib/store-policy, lib/delivery). */}
            <TrustLine className="mt-3" />

            {/* Everything about the design, one tap away. */}
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              className="mt-2 flex h-11 w-full items-center justify-between border-t border-white/10 text-sm text-neutral-200 hover:text-white"
            >
              Details
              <Icon name="chevron-down" className={`h-4 w-4 transition-transform duration-150 ${detailsOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {detailsOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                  <p className="text-sm text-muted">{CATEGORY_LABELS[shirt.category]}</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-300">{details?.description}</p>
                  <dl className="mt-2 border-t border-white/10 pb-2">
                    <Spec label="Tee" value={both ? "Black + White" : COLOR_LABELS[color]} />
                    <Spec label="Ink" value={`${black ? "White" : "Black"}, 1 colour${shirt.medium === "photo" ? " · halftone photo" : shirt.medium === "ink" ? " · from the original" : ""}`} />
                    <Spec label="Print" value={printSizeLabel(details?.printCm)} mono />
                    <Spec label="Fabric" value={STORE_POLICY.fabric} />
                    <Spec label="Fit" value="Regular" />
                    <Spec label="SKU" value={skuFor(shirt.sku, color)} mono />
                    {details?.photo && (
                      <p className="py-2 text-xs text-muted">
                        {shirt.medium === "photo" ? "Photo" : "Original"}: {details.photo.credit} · {details.photo.source ?? "Smithsonian Open Access"}, {details.photo.license ?? "CC0"} ·{" "}
                        <a href={details.photo.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                          Source record
                        </a>
                      </p>
                    )}
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desktop: the buy row inline (phones use the sticky bar below). */}
            <div className="mt-4 hidden gap-2 md:flex">
              <SaveButton id={shirt.id} title={shirt.title} size="lg" />
              <BuyButton label={buyLabel} onClick={onBuy} disabled={!hydrated} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 md:px-6">
          {/* Before the page runs (and in the static HTML crawlers read):
              plain links onward. Replaced by the visual rows below. */}
          {!hydrated && related && (related.variations.length > 0 || related.similar.length > 0) && (
            <nav aria-label="More like this" className="mt-10 space-y-3 text-sm">
              {[
                ["Variations", related.variations],
                ["More like this", related.similar],
              ].map(([label, links]) =>
                (links as RelatedLink[]).length ? (
                  <div key={label as string}>
                    <h2 className="mb-1 text-base font-medium">{label as string}</h2>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-300">
                      {(links as RelatedLink[]).map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} className="underline underline-offset-4 hover:text-white">
                            {l.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </nav>
          )}

          {/* Client-only: keeps the pre-rendered product pages small. */}
          {hydrated && members.length > 1 && (
            <section ref={variationsRef} id="variations" className="mt-10 scroll-mt-4">
              <h2 className="mb-3 text-base font-medium">Variations</h2>
              {/* Variations replace this page in history, so Back still reaches the grid. */}
              <ShirtStrip
                shirts={members}
                label="Variations"
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
            <section className="mt-10 pb-8">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-base font-medium">Similar prints</h2>
                {/* The whole shop, ordered by closeness to this one (a "Like this" search). */}
                <Link href={`/shop/?like=${shirt.id}`} className="-my-3 inline-flex h-11 items-center text-sm text-neutral-300 underline underline-offset-4 hover:text-white">
                  See all
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-4">
                {similar.map((s) => (
                  <ProductCard key={s.id} shirt={s} onOpen={clearOrigin} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Phones: the sticky buy bar (it replaces the tab bar here), always visible, never disabled. */}
      <StickyBar>
        <SaveButton id={shirt.id} title={shirt.title} size="lg" />
        <BuyButton label={buyLabel} onClick={onBuy} disabled={!hydrated} />
      </StickyBar>
      <TasteSheet open={tasteOpen} onClose={() => setTasteOpen(false)} />
    </div>
  );
}

/** The first sentence of a description, for alt text (the rest is in Details). */
function shortDescription(text: string) {
  const first = text.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, "");
  return first.charAt(0).toLowerCase() + first.slice(1);
}

/**
 * The product page's pictures, full-bleed and square-cornered: the tee
 * worn, then the flat print, side by side to swipe, with thin dots. A tap
 * opens the zoom in the one on screen. On a phone, never taller than leaves
 * the title, colour and sizes above the fold.
 */
function Gallery({ shirt, color, view, setView, onZoom, alt }: { shirt: ShirtProduct; color: BaseColor; view: View; setView: (v: View) => void; onZoom: () => void; alt?: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const views: View[] = ["tee", "print"];
  const go = (v: View) => {
    const el = strip.current;
    if (el) el.scrollTo({ left: views.indexOf(v) * el.clientWidth, behavior: "smooth" });
    setView(v);
  };
  return (
    <div className="relative mx-auto aspect-[4/5] max-h-[min(125vw,calc(100dvh-300px))] w-full max-w-[calc(min(125vw,calc(100dvh-300px))*0.8)] md:max-h-none md:max-w-none">
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          const v = views[Math.round(el.scrollLeft / Math.max(1, el.clientWidth))];
          if (v && v !== view) setView(v);
        }}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
      >
        {views.map((v) => (
          <div
            key={v}
            role="button"
            tabIndex={0}
            aria-label={v === "tee" ? "Zoom in on the tee" : "Zoom in on the print"}
            onClick={onZoom}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onZoom())}
            className="relative h-full w-full shrink-0 cursor-zoom-in snap-center overflow-hidden"
          >
            {v === "tee" ? (
              <TeeMockup shirt={shirt} color={color} priority sizes={SIZES.product} alt={alt} className="absolute left-0 top-1/2 w-full -translate-y-1/2" />
            ) : (
              <div className={`flex h-full w-full items-center justify-center ${color === "black" ? "bg-black" : "bg-white"}`}>
                <div className="aspect-[3/4] h-[82%]">
                  <PrintImage shirt={shirt} color={color} sizes={SIZES.product} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Thin dots: which of the two is on screen (each a 44px target). */}
      <div className="absolute inset-x-0 bottom-1 flex justify-center">
        {views.map((v) => (
          <button key={v} type="button" onClick={() => go(v)} aria-label={v === "tee" ? "On the tee" : "Print"} aria-pressed={view === v} className="flex h-11 w-11 items-center justify-center">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${view === v ? "bg-white" : "bg-white/40"} ring-1 ring-black/20`} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Phones: the page's own bottom bar (the tab bar gives way to it), counted in the dock so a toast sits above it. */
function StickyBar({ children }: { children: React.ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  useDock(bar, true, true);
  return (
    <div ref={bar} className="z-header flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#0a0a0a] px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:hidden">
      {children}
    </div>
  );
}

function BuyButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-live="polite" className={`min-w-0 flex-1 whitespace-nowrap ${BUTTON_PRIMARY}`}>
      <span className="truncate tabular-nums">{label}</span>
    </button>
  );
}
