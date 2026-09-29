"use client";

import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { SizeSelector, STAGE_BG } from "@/components/ui";
import { TeeChoice } from "@/components/shop/ProductView";
import { ZoomViewer } from "@/components/ZoomViewer";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { CustomPrint } from "@/components/custom/CustomPrint";
import type { EditorProps, EditorState } from "@/components/custom/editors/types";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { pairPrice, pairStatus, unitPrice } from "@/lib/cart";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { checkPrint, type PrintCheck } from "@/lib/custom/printCheck";
import { MADE, MAKE_GROUPS, madeBySlug, type MadeProduct } from "@/lib/custom/products";
import { carry } from "@/lib/custom/carry";
import { FROM_KEY, markFrom } from "@/lib/custom/makeFrom";
import { inkFromCanvas } from "@/lib/custom/raster";
import { loadRenderer, type Renderer } from "@/lib/custom/renderers";
import { decodeMake, encodeMake, type CustomSpec, type TemplateId } from "@/lib/custom/spec";
import { formatPrice } from "@/lib/format";
import { SIZES } from "@/lib/images";
import { STORE_POLICY } from "@/lib/store-policy";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { SIZE_LABELS, otherColor, teeColor, type BaseColor } from "@/types/shirt";

/** The preview waits this long after a change (longer on a device where a render is slow). */
const DEBOUNCE = 150;
const SLOW_DEBOUNCE = 300;

/** Each product's fields, a chunk of its own (a product's page loads only its editor). */
const DateEditor = lazy(() => import("@/components/custom/editors/DateEditor"));
const EDITORS: Partial<Record<TemplateId, ComponentType<EditorProps>>> = {
  sky: DateEditor,
  moon: DateEditor,
  night: DateEditor,
  planets: DateEditor,
  taste: lazy(() => import("@/components/custom/editors/TasteEditor")),
  code: lazy(() => import("@/components/custom/editors/CodeEditor")),
  line: lazy(() => import("@/components/custom/editors/LineEditor")),
  voice: lazy(() => import("@/components/custom/editors/VoiceEditor")),
  house: lazy(() => import("@/components/custom/editors/HouseEditor")),
  number: lazy(() => import("@/components/custom/editors/NumberEditor")),
  place: lazy(() => import("@/components/custom/editors/PlaceEditor")),
  ascii: lazy(() => import("@/components/custom/editors/AsciiEditor")),
  weeks: lazy(() => import("@/components/custom/editors/WeeksEditor")),
  elements: lazy(() => import("@/components/custom/editors/ElementsEditor")),
  crossword: lazy(() => import("@/components/custom/editors/CrosswordEditor")),
  journey: lazy(() => import("@/components/custom/editors/JourneyEditor")),
  snowflake: lazy(() => import("@/components/custom/editors/SnowflakeEditor")),
  maze: lazy(() => import("@/components/custom/editors/MazeEditor")),
  automaton: lazy(() => import("@/components/custom/editors/AutomatonEditor")),
  julia: lazy(() => import("@/components/custom/editors/JuliaEditor")),
  rings: lazy(() => import("@/components/custom/editors/RingsEditor")),
  family: lazy(() => import("@/components/custom/editors/FamilyEditor")),
  orbits: lazy(() => import("@/components/custom/editors/OrbitsEditor")),
  tartan: lazy(() => import("@/components/custom/editors/TartanEditor")),
  musicbox: lazy(() => import("@/components/custom/editors/MusicboxEditor")),
  monogram: lazy(() => import("@/components/custom/editors/MonogramEditor")),
  chess: lazy(() => import("@/components/custom/editors/ChessEditor")),
  metro: lazy(() => import("@/components/custom/editors/MetroEditor")),
  route: lazy(() => import("@/components/custom/editors/RouteEditor")),
  island: lazy(() => import("@/components/custom/editors/IslandEditor")),
  ridge: lazy(() => import("@/components/custom/editors/RidgeEditor")),
  streets: lazy(() => import("@/components/custom/editors/StreetsEditor")),
  qr: lazy(() => import("@/components/custom/editors/QrEditor")),
};

/** The data a print is drawn from, credited where it's used (the place list's licence asks for it). */
const CREDITS: Partial<Record<TemplateId, string>> = {
  sky: "Places: GeoNames (CC BY 4.0).",
  place: "Places: GeoNames (CC BY 4.0).",
  journey: "Places: GeoNames (CC BY 4.0).",
};

interface Shown {
  spec: CustomSpec;
  svg: string;
  color: BaseColor;
  check: PrintCheck;
  /** Whether the other tee prints this spec too (the pair is offered only then); null until checked. */
  other: boolean | null;
}

/**
 * A Make product's page: the editor is the page. Its own fields (a name, a
 * line, a night), the picture redrawn as you go, then size and bag. The
 * address carries the print (`?make=`), so a reload or a shared link opens
 * it as it was. Every print passes the catalogue's gate before it can be
 * bought; a pair only when both tees pass.
 */
/**
 * "Also from a date: Your Moon · Your Planets": the other products of this one's group, each link carrying
 * what's typed here that it can use (the date, the city, the words, the name), so it needn't be typed again.
 */
function Siblings({ made, spec }: { made: MadeProduct; spec: CustomSpec | null }) {
  const group = MAKE_GROUPS.find((g) => g.id === made.group)!;
  const others = MADE.filter((m) => m.group === made.group && m.slug !== made.slug);
  if (!others.length) return null;
  return (
    <p className="text-xs text-neutral-500" data-siblings>
      Also {group.label.toLowerCase()}:{" "}
      {others.map((m, i) => {
        const carried = spec ? carry(spec, m) : null;
        return (
          <span key={m.slug}>
            {i > 0 && " · "}
            <Link href={`/make/${m.slug}/${carried ? `?make=${encodeMake(carried)}` : ""}`} onClick={() => markFrom("sibling")} className="text-neutral-300 underline underline-offset-2 hover:text-white">
              {m.name}
            </Link>
          </span>
        );
      })}
    </p>
  );
}

export function MakeView({ slug }: { slug: string }) {
  const made = madeBySlug(slug) as MadeProduct;
  const router = useRouter();
  const hydrated = useHydrated();
  const shirt = getShirtById(made.id);
  const pickedColor = useCartStore((s) => s.selectedColors[made.id]);
  const setColor = useCartStore((s) => s.setColor);
  const size = useCartStore((s) => (hydrated ? sizeFor(s, made.id) : undefined));
  const setSize = useCartStore((s) => s.setSize);
  const cart = useCartStore((s) => s.cart);
  const [both, setBoth] = useState(false);
  const color: BaseColor = shirt ? teeColor(shirt, hydrated ? pickedColor : null) : "black";

  // The print the address arrived with, if it's this product's (read once, after hydration).
  const [arrival, setArrival] = useState<CustomSpec | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated || arrival !== undefined) return;
    const spec = decodeMake(new URLSearchParams(window.location.search).get("make"));
    setArrival(spec && spec.t === made.template ? spec : null);
    // Where this visit came from (the index card or a sibling link set it on the way here), for Back and analytics.
    let from = "";
    try {
      from = sessionStorage.getItem(FROM_KEY) ?? "";
      sessionStorage.removeItem(FROM_KEY);
    } catch {
      /* storage unavailable */
    }
    const source = from === "index" || from === "sibling" || from === "two" ? from : "design";
    setCameFrom(source);
    track("make_open", { product: made.slug, group: made.group, source });
  }, [hydrated, arrival, made]);

  const [cameFrom, setCameFrom] = useState<"index" | "sibling" | "two" | "design">("design");
  // What the editor makes of its fields.
  const [state, setState] = useState<EditorState>({ spec: null });
  const onEditor = useCallback((s: EditorState) => setState(s), []);
  const spec = state.blocked ? made.example : state.spec;

  // The picture: debounced, checked (a print that won't print well isn't offered), and the address kept in step.
  const [shown, setShown] = useState<Shown | null>(null);
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  useEffect(() => {
    let live = true;
    loadCanvasFonts();
    loadRenderer(made.template).then((r) => live && setRenderer(() => r));
    return () => {
      live = false;
    };
  }, [made.template]);
  const slow = useRef(false);
  /** Draws and checks the print now (fonts loaded). */
  const draw = useCallback(
    (spec: CustomSpec, color: BaseColor): Shown | null => {
      if (!renderer) return null;
      const start = performance.now();
      const svg = renderer(spec, color, state.data ?? {});
      const check = checkPrint(inkFromCanvas(svg, color), made.hints);
      if (performance.now() - start > 100) slow.current = true;
      const next = { spec, svg, color, check, other: null };
      setShown(next);
      if (check.ok && !state.blocked) {
        const q = new URLSearchParams(window.location.search);
        q.set("make", encodeMake(spec));
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}${window.location.hash}`);
      }
      return next;
    },
    [renderer, state.data, state.blocked, made.hints],
  );
  useEffect(() => {
    if (!spec || !renderer) return;
    const t = setTimeout(() => loadCanvasFonts().then(() => draw(spec, color)), slow.current ? SLOW_DEBOUNCE : DEBOUNCE);
    return () => clearTimeout(t);
  }, [spec, renderer, color, draw]);
  // Then, quietly, the other tee: the pair is offered only when both print.
  useEffect(() => {
    if (!shown || shown.other !== null || !shown.check.ok || !renderer || !shirt || shirt.colors.length < 2) return;
    const t = setTimeout(() => {
      const c = otherColor(shown.color);
      const ok = checkPrint(inkFromCanvas(renderer(shown.spec, c, state.data ?? {}), c), made.hints).ok;
      setShown((s) => (s === shown ? { ...s, other: ok } : s));
    }, 250);
    return () => clearTimeout(t);
  }, [shown, renderer, shirt, state.data, made.hints]);
  const current = shown && shown.spec === spec && shown.color === color ? shown : null;
  const ready = !!current?.check.ok && !state.blocked;
  const pairOk = current?.other === true;
  useEffect(() => {
    if (both && current && current.other === false) setBoth(false);
  }, [both, current]);

  // The bag.
  const addToCart = useCartStore((s) => s.addToCart);
  const addPair = useCartStore((s) => s.addPair);
  const [added, setAdded] = useState(false);
  const [nudge, setNudge] = useState(0);
  const [tried, setTried] = useState(false);
  const unit = shirt ? unitPrice({ custom: true }, shirt) : 0;
  const pairTotal = pairPrice(spec ?? undefined);
  const pair = both && size && spec ? pairStatus(cart, made.id, size, spec) : null;
  const onBuy = () => {
    if (!state.spec) return setTried(true);
    // A tap right after a change doesn't wait for the preview: the print is drawn and checked now.
    const now = ready ? current : draw(state.spec, color);
    if (!now?.check.ok) return;
    if (!size) return setNudge((n) => n + 1);
    if (added) return router.push("/cart/");
    const ok = both && pairOk ? addPair(made.id, size, { source: "product", custom: state.spec }) : addToCart(made.id, size, color, 1, { source: "product", custom: state.spec });
    if (!ok) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    // A small like of the design it's drawn like (its taste, never the inputs; once per design).
    const base = SHIRTS.find((s) => s.variant === made.base);
    if (base) useTasteStore.getState().likeCustom(base.id);
    track("customize_apply", { template: made.template });
  };
  const priceLabel = both ? (pair && pair.missing.length === 1 ? `Complete the pair · +${formatPrice(pairTotal - unit)}` : `Add both · ${formatPrice(pairTotal)}`) : `Add to bag · ${formatPrice(unit)}`;
  const buyLabel = !size ? "Choose size" : added ? "Added · View bag" : `${priceLabel.replace("Add to bag", `Add to bag · ${SIZE_LABELS[size]}`)}`;

  const [zoom, setZoom] = useState(false);
  const [view, setView] = useState<"tee" | "print">("tee");

  if (!shirt) return null;
  const Editor = EDITORS[made.template];
  const svg = shown && shown.color === color ? shown.svg : null;
  const problem = current && !current.check.ok && !state.blocked ? current.check.reason : null;

  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-1 2xl:max-w-6xl">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href={`/make/#${made.group}`}
            onClick={(e) => {
              // From the index: back in history, so its scroll is kept.
              if (cameFrom === "index" && window.history.length > 1) {
                e.preventDefault();
                router.back();
              }
            }}
            className="inline-flex h-10 items-center gap-1.5 text-sm text-neutral-400 hover:text-white"
          >
            <Icon name="arrow-left" className="h-4 w-4" /> Make
          </Link>
          {!state.blocked && (
            <button
              type="button"
              onClick={() => ready && current && useUiStore.getState().openShare(made.id, color, encodeMake(current.spec))}
              aria-label="Share"
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white"
            >
              <Icon name="share-2" className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className={`relative flex aspect-square max-h-[56dvh] w-full items-center justify-center overflow-hidden rounded-[28px] ring-1 ring-white/10 md:sticky md:top-4 md:aspect-[4/5] md:max-h-none ${STAGE_BG}`}>
            <button type="button" onClick={() => setZoom(true)} aria-label="Zoom in on the print" className="flex h-full w-full cursor-zoom-in items-center justify-center p-5 pb-14">
              {view === "print" && svg ? (
                <div className="aspect-[3/4] h-[88%] overflow-hidden rounded-[3px] shadow-2xl shadow-black/60">
                  <CustomPrint svg={svg} />
                </div>
              ) : svg ? (
                <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.product} className="h-full max-h-full" />
              ) : (
                <div className="aspect-[512/704] h-full animate-pulse rounded-2xl bg-white/[0.03]" aria-hidden />
              )}
            </button>
            {!state.blocked && (
              <div className="absolute bottom-3 left-3">
                <TeeChoice
                  value={both ? "both" : color}
                  original={shirt.baseColor}
                  colors={shirt.colors}
                  noBoth={!pairOk}
                  onChange={(c) => {
                    setBoth(c === "both");
                    if (c !== "both") setColor(made.id, c);
                  }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setView((v) => (v === "tee" ? "print" : "tee"))}
              className="absolute bottom-3 right-3 flex h-10 items-center rounded-full bg-black/55 px-3 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur-md"
            >
              {view === "tee" ? "The print" : "On the tee"}
            </button>
            <AnimatePresence>{zoom && svg && <ZoomViewer shirt={shirt} color={color} initialView={view} customSvg={svg} onClose={() => setZoom(false)} />}</AnimatePresence>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{made.name}</h1>
            <p className="mt-1 text-sm text-neutral-400">{made.line}</p>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onBuy();
              }}
              noValidate
            >
              {Editor && arrival !== undefined && (
                <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" aria-hidden />}>
                  <Editor made={made} arrival={arrival} touched={tried} onChange={onEditor} />
                </Suspense>
              )}
              {problem && (
                <p className="text-xs text-neutral-300" role="status" data-print-problem>
                  {problem}
                </p>
              )}
              {!state.blocked && (
                <>
                  <div className="mt-1">
                    <SizeSelector key={nudge} value={size} onChange={(s) => setSize(made.id, s)} highlight={nudge > 0 && !size} />
                  </div>
                  <button type="submit" disabled={!hydrated} className="hidden h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-40 md:flex" aria-live="polite">
                    <Icon name={added ? "check" : "shopping-bag"} className="h-4 w-4" />
                    {buyLabel}
                  </button>
                  <p className="text-xs text-neutral-500">
                    {STORE_POLICY.customReturns}. Printed to order in one ink, up to 28 × 37 cm.{CREDITS[made.template] ? ` ${CREDITS[made.template]}` : ""}
                  </p>
                  <Siblings made={made} spec={current?.spec ?? state.spec} />
                </>
              )}
            </form>
          </div>
        </div>
      </div>
      {!state.blocked && (
        <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:hidden">
          <button type="button" onClick={onBuy} disabled={!hydrated} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-40">
            <Icon name={added ? "check" : "shopping-bag"} className="h-4 w-4 shrink-0" />
            <span className="truncate">{buyLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
