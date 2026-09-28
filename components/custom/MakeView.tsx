"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { SizeSelector, STAGE_BG } from "@/components/ui";
import { TeeChoice } from "@/components/shop/ProductView";
import { ZoomViewer } from "@/components/ZoomViewer";
import { CityField, cityLabel } from "@/components/custom/CityField";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { CustomPrint } from "@/components/custom/CustomPrint";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { pairPrice, pairStatus, unitPrice } from "@/lib/cart";
import { renderCustomSvg } from "@/lib/custom";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { loadCities, loadSky, type Places } from "@/lib/custom/data";
import { FALLBACK_CITY, madeBySlug, type MadeProduct } from "@/lib/custom/products";
import { WEAK_QUALITY, assessPrint, solidBlock } from "@/lib/custom/quality";
import { inkFromCanvas } from "@/lib/custom/raster";
import { FIRST_YEAR, LAST_YEAR, PLANETS_LAST_YEAR, WORDS_MAX, cleanWords, decodeMake, encodeMake, parseDate, parseTime, type City, type CustomSpec } from "@/lib/custom/spec";
import type { SkyData } from "@/lib/custom/templates/sky";
import { formatPrice } from "@/lib/format";
import { SIZES } from "@/lib/images";
import { STORE_POLICY } from "@/lib/store-policy";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { SIZE_LABELS, teeColor, type BaseColor } from "@/types/shirt";

/** The preview waits this long after a change (longer on a device where a render is slow). */
const DEBOUNCE = 150;
const SLOW_DEBOUNCE = 300;
const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The visitor's place, from their time zone: its biggest city (London when the zone has none in the list). */
export function autoCity(places: Places): City | undefined {
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* no zone: the fallback */
  }
  const inZone = places.list.filter((c) => c.tz === zone).sort((a, b) => b.pop - a.pop)[0];
  return inZone ?? places.byId(FALLBACK_CITY);
}

/** Whether a print will print: not a solid block, and not weak by the catalogue's own line (lib/custom/quality). */
function printable(svg: string, color: BaseColor) {
  const ink = inkFromCanvas(svg, color);
  const a = assessPrint(ink);
  return !solidBlock(ink).reject && a.quality >= WEAK_QUALITY && a.flags.length === 0;
}

const input = "h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white [color-scheme:dark]";

/**
 * A made-for-you tee's page: the editor is the page. Your words, your day
 * (and your place, from your time zone, for a sky), the picture redrawn as
 * you go, then size and bag. The address carries the print (`?make=`), so a
 * reload or a shared link opens it as it was.
 */
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

  // Data: the place list (a sky's place; the hemisphere's default elsewhere) and the sky.
  const [places, setPlaces] = useState<Places | null>(null);
  const [sky, setSky] = useState<SkyData | null>(null);
  useEffect(() => {
    let live = true;
    loadCanvasFonts();
    loadCities()
      .then((p) => live && setPlaces(p))
      .catch(() => {});
    if (made.template === "sky")
      loadSky()
        .then((s) => live && setSky(s))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [made.template]);

  // Fields. From the address when it carries a print for this product, else today and your place.
  const [words, setWords] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [cityId, setCityId] = useState<number | null>(null);
  const [south, setSouth] = useState<boolean | null>(null);
  const [changingPlace, setChangingPlace] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const arrived = useRef(false);
  useEffect(() => {
    if (!places || arrived.current) return;
    arrived.current = true;
    const spec = decodeMake(new URLSearchParams(window.location.search).get("make"), places.byId);
    if (spec && spec.t === made.template) {
      setWords(spec.p.w ?? "");
      if (spec.t === "moon") setYear(String(spec.p.y));
      else setDate(spec.p.d);
      if (spec.t === "sky") (setCityId(spec.p.c), setTime(spec.p.t ?? ""));
      if (spec.t === "moon" || spec.t === "night") setSouth(spec.p.s === 1);
    }
    track("customize_open", { template: made.template });
  }, [places, made.template]);
  const here = useMemo(() => (places ? autoCity(places) : undefined), [places]);
  const city = cityId && places ? places.byId(cityId) : here;
  const southNow = south ?? (here ? here.lat < 0 : false);

  const lastYear = made.template === "planets" ? PLANETS_LAST_YEAR : LAST_YEAR;
  const w = words.trim() ? cleanWords(words) : undefined;
  const dateOk = !!parseDate(date) && Number(date.slice(0, 4)) <= lastYear;
  const spec: CustomSpec | null = useMemo(() => {
    if (w === null) return null;
    const words = w ? { w } : {};
    const s = southNow ? { s: 1 as const } : {};
    if (made.template === "moon") {
      const y = Number(year);
      return /^\d{4}$/.test(year) && y >= FIRST_YEAR && y <= LAST_YEAR ? { t: "moon", v: 1, p: { y, ...s, ...words } } : null;
    }
    if (!dateOk) return null;
    if (made.template === "night") return { t: "night", v: 1, p: { d: date, ...s, ...words } };
    if (made.template === "planets") return { t: "planets", v: 1, p: { d: date, ...words } };
    if (!city || (time && !parseTime(time))) return null;
    return { t: "sky", v: 1, p: { c: city.id, d: date, ...(time ? { t: time } : {}), ...words } };
  }, [w, southNow, made.template, year, dateOk, date, city, time]);

  // The picture: debounced, checked (a print that won't print well isn't offered), and the address kept in step.
  const [shown, setShown] = useState<{ spec: CustomSpec; svg: string; color: BaseColor } | null>(null);
  const [bad, setBad] = useState(false);
  const slow = useRef(false);
  /** Draws and checks the print now (fonts loaded); whether it may be sold. */
  const draw = (spec: CustomSpec) => {
    const start = performance.now();
    const svg = renderCustomSvg(spec, color, { sky: sky ?? undefined, city });
    const ok = printable(svg, color);
    if (performance.now() - start > 100) slow.current = true;
    setBad(!ok);
    if (ok) {
      setShown({ spec, svg, color });
      const q = new URLSearchParams(window.location.search);
      q.set("make", encodeMake(spec));
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}${window.location.hash}`);
    }
    return ok;
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const canDraw = !!spec && (spec.t !== "sky" || !!sky);
  useEffect(() => {
    if (!spec || !canDraw) return;
    const t = setTimeout(() => loadCanvasFonts().then(() => drawRef.current(spec)), slow.current ? SLOW_DEBOUNCE : DEBOUNCE);
    return () => clearTimeout(t);
  }, [spec, canDraw, city, color]);
  const ready = !!spec && !bad && shown?.spec === spec;

  // The bag.
  const addToCart = useCartStore((s) => s.addToCart);
  const addPair = useCartStore((s) => s.addPair);
  const [added, setAdded] = useState(false);
  const [nudge, setNudge] = useState(0);
  const unit = shirt ? unitPrice({ custom: true }, shirt) : 0;
  const pairTotal = pairPrice(spec ?? undefined);
  const pair = both && size && spec ? pairStatus(cart, made.id, size, spec) : null;
  const onBuy = () => {
    if (!spec) return setTouched({ words: true, date: true, time: true, year: true, place: true });
    // A tap right after a change doesn't wait for the preview: the print is drawn and checked now.
    if (!ready && !(canDraw && draw(spec))) return;
    if (!size) return setNudge((n) => n + 1);
    if (added) return router.push("/cart/");
    const ok = both ? addPair(made.id, size, { source: "product", custom: spec }) : addToCart(made.id, size, color, 1, { source: "product", custom: spec });
    if (!ok) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    // A third of a like of the design it's drawn like (its taste, never the inputs).
    const base = SHIRTS.find((s) => s.variant === made.base);
    if (base) useTasteStore.getState().likeCustom(base.id);
    track("customize_apply", { template: made.template });
  };
  const priceLabel = both ? (pair && pair.missing.length === 1 ? `Complete the pair · +${formatPrice(pairTotal - unit)}` : `Add both · ${formatPrice(pairTotal)}`) : `Add to bag · ${formatPrice(unit)}`;
  const buyLabel = !size ? "Choose size" : added ? "Added · View bag" : `${priceLabel.replace("Add to bag", `Add to bag · ${SIZE_LABELS[size]}`)}`;

  const [zoom, setZoom] = useState(false);
  const [view, setView] = useState<"tee" | "print">("tee");
  const errors = {
    words: touched.words && w === null ? `Up to ${WORDS_MAX} letters, numbers and simple punctuation` : "",
    date: touched.date && !dateOk ? `Pick a date between ${FIRST_YEAR} and ${lastYear}` : "",
    time: touched.time && time && !parseTime(time) ? "Pick a time, or leave it empty" : "",
    year: touched.year && made.template === "moon" && !spec ? `Pick a year between ${FIRST_YEAR} and ${LAST_YEAR}` : "",
  };

  if (!shirt) return null;
  const svg = shown && shown.color === color ? shown.svg : null;

  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-1 2xl:max-w-6xl">
        <div className="mb-2 flex items-center justify-between">
          <Link href="/make/" className="inline-flex h-10 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
            <Icon name="arrow-left" className="h-4 w-4" /> Make
          </Link>
          <button
            type="button"
            onClick={() => shown && useUiStore.getState().openShare(made.id, color, encodeMake(shown.spec))}
            aria-label="Share"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <Icon name="share-2" className="h-5 w-5" />
          </button>
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
            <div className="absolute bottom-3 left-3">
              <TeeChoice
                value={both ? "both" : color}
                original={shirt.baseColor}
                colors={shirt.colors}
                onChange={(c) => {
                  setBoth(c === "both");
                  if (c !== "both") setColor(made.id, c);
                }}
              />
            </div>
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
              <Field label="Your words" hint="optional" error={errors.words} htmlFor="make-words">
                <input
                  id="make-words"
                  value={words}
                  maxLength={WORDS_MAX}
                  placeholder={made.wordsHint}
                  autoComplete="off"
                  onChange={(e) => setWords(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, words: true }))}
                  aria-invalid={!!errors.words}
                  className={input}
                />
              </Field>
              {made.template === "moon" ? (
                <Field label="Year" error={errors.year} htmlFor="make-year">
                  <input
                    id="make-year"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onBlur={() => setTouched((t) => ({ ...t, year: true }))}
                    aria-invalid={!!errors.year}
                    className={`${input} font-mono`}
                  />
                </Field>
              ) : (
                <div className={made.template === "sky" ? "grid grid-cols-[1fr_8rem] gap-3" : ""}>
                  <Field label={made.template === "planets" ? "Day" : "Night"} error={errors.date} htmlFor="make-date">
                    <input
                      id="make-date"
                      type="date"
                      min={`${FIRST_YEAR}-01-01`}
                      max={`${lastYear}-12-31`}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                      aria-invalid={!!errors.date}
                      className={input}
                    />
                  </Field>
                  {made.template === "sky" && (
                    <Field label="Time" hint="optional" error={errors.time} htmlFor="make-time">
                      <input id="make-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, time: true }))} aria-invalid={!!errors.time} className={input} />
                    </Field>
                  )}
                </div>
              )}
              {made.template === "sky" &&
                (changingPlace ? (
                  <CityField
                    places={places}
                    value={cityId ? city : undefined}
                    onChange={(c) => {
                      setCityId(c?.id ?? null);
                      if (c) setChangingPlace(false);
                    }}
                    error=""
                    onBlur={() => setTouched((t) => ({ ...t, place: true }))}
                  />
                ) : (
                  <p className="flex min-h-10 flex-wrap items-center gap-x-2 text-sm text-neutral-400" data-place>
                    <span>
                      Seen from <span className="text-neutral-200">{city ? cityLabel(city) : "…"}</span>
                      {!cityId && city ? " (your time zone)" : ""}
                    </span>
                    <button type="button" onClick={() => setChangingPlace(true)} className="-my-2 h-10 text-neutral-300 underline underline-offset-4 hover:text-white">
                      Change
                    </button>
                  </p>
                ))}
              {(made.template === "moon" || made.template === "night") && (
                <label className="flex h-11 cursor-pointer items-center justify-between text-sm text-neutral-300">
                  Seen from the south
                  <input type="checkbox" role="switch" checked={southNow} onChange={(e) => setSouth(e.target.checked)} className="peer sr-only" />
                  <span aria-hidden className="relative h-6 w-10 rounded-full bg-white/15 transition peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 peer-checked:after:bg-black" />
                </label>
              )}
              {bad && spec && <p className="text-xs text-neutral-300">This one won&apos;t print well. Try another date</p>}

              <div className="mt-1">
                <SizeSelector key={nudge} value={size} onChange={(s) => setSize(made.id, s)} highlight={nudge > 0 && !size} />
              </div>
              <button type="submit" disabled={!hydrated} className="hidden h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-40 md:flex" aria-live="polite">
                <Icon name={added ? "check" : "shopping-bag"} className="h-4 w-4" />
                {buyLabel}
              </button>
              <p className="text-xs text-neutral-500">{STORE_POLICY.customReturns}. Printed to order in one ink, up to 28 × 37 cm.</p>
            </form>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:hidden">
        <button type="button" onClick={onBuy} disabled={!hydrated} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-40">
          <Icon name={added ? "check" : "shopping-bag"} className="h-4 w-4 shrink-0" />
          <span className="truncate">{buyLabel}</span>
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline gap-2 text-xs font-medium text-neutral-400">
        {label}
        {hint && <span className="text-neutral-500">{hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-neutral-300">{error}</p>}
    </div>
  );
}
