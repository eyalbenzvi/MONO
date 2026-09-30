"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { SIZES } from "@/lib/images";
import { BUTTON_PRIMARY, TEXT_ACTION, useShowMatch } from "@/components/ui";
import { FREE_SHIPPING_TEES, MAX_QTY, cartLines, cartTotals, type CartLine } from "@/lib/cart";
import { STORE_POLICY } from "@/lib/store-policy";
import { useCartStore } from "@/store/cartStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { useDock } from "@/hooks/useDock";
import { apiConfigured, fetchReferral, isEmail } from "@/lib/api";
import { arrivalLine, formatArrival } from "@/lib/delivery";
import { codeOfCountry, countryConflicts, countryFromLanguages, type CountryCode } from "@/lib/checkout";
import { ADULT_SIZES, COLOR_LABELS, KID_SIZES, SIZE_LABELS, type Customer, type Order, type ShirtProduct, type ShirtSize, type UploadRef } from "@/types/shirt";
import { formatPrice } from "@/lib/format";
import { itemOf, track, trackEcommerce } from "@/lib/analytics";
import { productHref } from "@/lib/catalog";
import { customKey, lineKey } from "@/lib/cart";
import { ReviewStatus, useOrderTickets } from "@/components/upload/ReviewStatus";
import { useMakeStore } from "@/store/makeStore";
import { customTitle, encodeMake, type CustomSpec } from "@/lib/custom/spec";

// A made-for-you line's picture draws its own print; its code loads only when the bag holds one.
const CustomLineMockup = lazy(() => import("@/components/custom/CustomLineMockup"));

/** A line's name: a made-for-you print's own title ("Your Moon · 14 March 1991"), else the design's. */
const lineTitle = (l: { shirt: ShirtProduct; custom?: CustomSpec; upload?: UploadRef }) =>
  l.upload ? (useMakeStore.getState().uploads[l.upload.id]?.title ?? "Your file") : l.custom ? customTitle(l.custom) : l.shirt.title;
/** Where a line leads: its product page in the line's colour, a made-for-you one with its print in the address and the line it edits, an upload its editor. */
const lineHref = (l: CartLine) =>
  l.upload ? `/make/yours/?edit=${l.upload.id}` : l.custom ? `${productHref(l.id)}?make=${encodeMake(l.custom)}&edit=${encodeURIComponent(lineKey(l))}` : `${productHref(l.id)}?c=${l.color}`;

const UploadMockup = lazy(() => import("@/components/upload/UploadMockup"));

function LineMockup({ line, className }: { line: CartLine; className?: string }) {
  const label = useMakeStore((s) => (line.upload ? s.uploads[line.upload.id]?.title : undefined));
  if (line.upload)
    return (
      <Suspense fallback={<div className={className} style={{ aspectRatio: "3 / 4" }} />}>
        <UploadMockup shirt={line.shirt} uploadId={line.upload.id} color={line.color} className={className} label={label} />
      </Suspense>
    );
  if (!line.custom) return <TeeMockup shirt={line.shirt} color={line.color} sizes={SIZES.thumb} className={className} />;
  return (
    <Suspense fallback={<TeeMockup shirt={line.shirt} color={line.color} sizes={SIZES.thumb} className={className} />}>
      <CustomLineMockup shirt={line.shirt} color={line.color} spec={line.custom} sizes={SIZES.thumb} className={className} />
    </Suspense>
  );
}

type Step = "bag" | "details" | "done";

/** The uploaded prints of an order and where their review stands. */
function UploadReviews({ order }: { order: string }) {
  const tickets = useOrderTickets(order);
  if (!tickets.length) return null;
  return (
    <div className="mt-5 w-full space-y-2" data-upload-reviews>
      {tickets.map((t) => (
        <ReviewStatus key={t.id} ticket={t} offer={(id) => useUiStore.getState().openOffer(id)} />
      ))}
    </div>
  );
}

/** begin_checkout, from the bag's totals (the Checkout button and "Buy now" alike). */
const beginCheckout = (t: Pick<ReturnType<typeof cartTotals>, "total" | "discount" | "shipping" | "lines" | "pairs">) =>
  trackEcommerce("begin_checkout", { value: t.total, discount: t.discount, shipping: t.shipping, items: ecomItems(t.lines, t.pairs) });

/** The one demo disclosure, under the order button (nowhere else). */
export const PREVIEW_LINE = "Preview store. No payment is taken and nothing ships.";

export function CartView() {
  const hydrated = useHydrated();
  // lineTitle reads the uploads' titles: subscribed, so a rename shows here (and in the form and the confirmation).
  useMakeStore((s) => s.uploads);
  const cart = useCartStore((s) => s.cart);
  const changeCartItem = useCartStore((s) => s.changeCartItem);
  const setCartQty = useCartStore((s) => s.setCartQty);
  const placeOrder = useCartStore((s) => s.placeOrder);
  const [step, setStep] = useState<Step>("bag");
  const [placed, setPlaced] = useState<Order | null>(null);
  // The delivery form lives here, in memory only (never saved): going back
  // to the bag and returning keeps what was typed.
  const [values, setValues] = useState<Record<Field, string>>(EMPTY_DETAILS);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  // A new step puts focus on its heading (never back on the page body).
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [step]);
  // The delivery form is a step in the history (#details), so a phone's Back returns to the bag, keeping what was typed.
  const go = (next: Step) => {
    moved.current = true;
    const here = window.location.hash === "#details";
    if (next === "details" && !here) window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}#details`);
    else if (next === "bag" && here) return window.history.back();
    else if (next === "done" && here) {
      // The form's step is left behind (not kept as a second bag entry): one Back leaves the confirmation.
      setStep(next);
      return window.history.back();
    }
    setStep(next);
  };
  useEffect(() => {
    const on = () => {
      moved.current = true;
      setStep((s) => (s === "done" ? s : window.location.hash === "#details" && useCartStore.getState().cart.length ? "details" : "bag"));
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  // Arriving at #details (a reload, or Forward): the form is memory-only, so it opens at the bag.
  useEffect(() => {
    if (window.location.hash === "#details") window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  const { lines, count, subtotal, discount, pairs, shipping, total } = cartTotals(cart);
  const pairCount = pairs.reduce((n, p) => n + p.pairs, 0);
  const known = useShowMatch();
  const review = lines.some((l) => l.upload);

  // "Buy now" and the add confirmation's Checkout: straight to the delivery form (also when already here).
  const checkoutRequested = useUiStore((s) => s.checkoutRequested);
  useEffect(() => {
    if (!hydrated || !checkoutRequested) return;
    useUiStore.getState().requestCheckout(false);
    const t = cartTotals(useCartStore.getState().cart);
    if (!t.count) return;
    go("details");
    beginCheckout(t);
  }, [hydrated, checkoutRequested]);

  // view_cart once per visit, and only when the bag itself is on screen (not when Buy now opens the form directly).
  const viewedCart = useRef(false);
  useEffect(() => {
    if (!hydrated || viewedCart.current || step !== "bag" || checkoutRequested) return;
    const t = cartTotals(useCartStore.getState().cart);
    if (!t.count) return;
    viewedCart.current = true;
    trackEcommerce("view_cart", { value: t.total - t.shipping, items: ecomItems(t.lines, t.pairs) });
  }, [hydrated, step, checkoutRequested]);

  const bar = useRef<HTMLDivElement>(null);
  useDock(bar, hydrated && step !== "done");

  if (!hydrated) return <div className="flex-1" />;

  if (step === "done" && placed) return <Confirmation order={placed} />;

  const toCheckout = () => {
    track("sticky_checkout_click", { from: "bag" });
    go("details");
    beginCheckout({ total, discount, shipping, lines, pairs });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-1">
          {step === "details" ? (
            <button type="button" onClick={() => go("bag")} className="-ml-1 inline-flex h-11 min-w-11 items-center px-1 text-sm text-muted hover:text-white">
              ← Bag
            </button>
          ) : (
            <Link href="/shop/" className="-ml-1 inline-flex h-11 min-w-11 items-center px-1 text-sm text-muted hover:text-white">
              ← Shop
            </Link>
          )}

          <h1 ref={heading} tabIndex={-1} className="mb-4 mt-1 text-[28px] font-medium leading-tight outline-none">
            {step === "bag" || count === 0 ? "Your bag" : "Checkout"}
          </h1>

          {count === 0 ? (
            <p className="py-12 text-base text-neutral-200">Your bag is empty.</p>
          ) : step === "bag" ? (
            <>
              <ul className="border-t border-white/10">
                <AnimatePresence initial={false}>
                  {lines.map((line) => (
                    <motion.li key={lineKey(line)} layout exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex gap-3 border-b border-white/10 py-3">
                      <Link tabIndex={-1} aria-hidden href={lineHref(line)} className="w-20 shrink-0 self-start max-[339px]:w-14">
                        <LineMockup line={line} className="w-full" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm">{lineTitle(line)}</p>
                            {/* The colour, in words (change it on the product page); the size is the control below. */}
                            <p className="text-xs text-muted">
                              {line.upload ? `Your file · ${COLOR_LABELS[line.color]}` : `${COLOR_LABELS[line.color]} tee`}
                              {(line.custom || line.upload) && (
                                <>
                                  {" · "}
                                  <Link href={lineHref(line)} className="inline-flex min-h-11 items-center text-neutral-300 underline underline-offset-2 hover:text-white">
                                    Edit
                                  </Link>
                                </>
                              )}
                            </p>
                          </div>
                          <span className="text-sm tabular-nums">{formatPrice(line.lineTotal)}</span>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                          <select
                            value={line.size}
                            onChange={(e) => changeCartItem(line, { size: e.target.value as ShirtSize })}
                            aria-label="Size"
                            className="h-11 rounded-control bg-transparent px-2 text-sm text-white ring-1 ring-inset ring-white/25"
                          >
                            {(
                              [
                                ["Adults", ADULT_SIZES],
                                ["Kids", KID_SIZES],
                              ] as const
                            ).map(([label, group]) => (
                              <optgroup key={label} label={label} className="bg-ink-900">
                                {group.map((s) => (
                                  <option key={s} value={s} className="bg-ink-900">
                                    Size {SIZE_LABELS[s]}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {/* Quantity only once there's more than one (add again for another). */}
                          {line.qty > 1 && (
                            <div className="flex h-11 items-center rounded-control ring-1 ring-inset ring-white/25">
                              <button type="button" aria-label="Decrease quantity" onClick={() => setCartQty(line, line.qty - 1)} className="flex h-11 w-11 items-center justify-center text-neutral-300 hover:text-white">
                                <Icon name="minus" className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">
                                {line.qty}
                              </span>
                              <button type="button" aria-label="Increase quantity" disabled={line.qty >= MAX_QTY} onClick={() => setCartQty(line, line.qty + 1)} className="flex h-11 w-11 items-center justify-center text-neutral-300 hover:text-white disabled:opacity-30">
                                <Icon name="plus" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <button type="button" aria-label={`Remove ${lineTitle(line)}`} onClick={() => setCartQty(line, 0)} className="ml-auto flex h-11 min-w-11 items-center justify-center px-2 text-sm text-muted underline-offset-4 hover:text-white hover:underline">
                            Remove
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <Summary subtotal={subtotal} discount={discount} pairCount={pairCount} shipping={shipping} total={total} />
              {/* The delivery window and the returns that apply (lib/delivery, lib/store-policy). */}
              <p className="mt-3 text-xs leading-relaxed text-muted" data-policy>
                {arrivalLine(review)} · {policyLine(lines)}
              </p>
            </>
          ) : (
            <DetailsForm
              values={values}
              setValues={setValues}
              touched={touched}
              setTouched={setTouched}
              lines={lines}
              summaryLine={`${count} ${count === 1 ? "tee" : "tees"} · ${formatPrice(total)} · ${arrivalLine(review)}`}
              onSubmit={(customer) => {
                trackEcommerce("add_shipping_info", { value: total, shipping, items: ecomItems(lines, pairs) });
                const order = placeOrder(customer);
                if (order) {
                  setPlaced(order);
                  go("done");
                  setValues(EMPTY_DETAILS);
                  setTouched({});
                }
              }}
            />
          )}
        </div>
      </div>

      {/* The step's one action, pinned within the thumb (the tab bar gives way to it). */}
      <div ref={bar} className="shrink-0 border-t border-white/10 bg-[#0a0a0a] px-4 pb-[max(calc(env(safe-area-inset-bottom)-var(--tabbar,0px)),12px)] pt-3">
          <div className="mx-auto max-w-3xl">
            {count === 0 ? (
              <Link href={known ? "/shop/" : "/"} className={`w-full ${BUTTON_PRIMARY}`}>
                {known ? "See your edit" : "Start the taste test"}
              </Link>
            ) : step === "bag" ? (
              // Keyed apart from the submit button: the same element changing type under the tap would submit the form.
              <button key="checkout" type="button" onClick={toCheckout} className={`w-full ${BUTTON_PRIMARY}`}>
                <span className="tabular-nums">Checkout · {formatPrice(total)}</span>
              </button>
            ) : (
              <>
                <button key="place" type="submit" form="checkout-form" className={`w-full ${BUTTON_PRIMARY}`}>
                  <span className="tabular-nums">Place order · {formatPrice(total)}</span>
                </button>
                <p className="mt-2 text-center text-xs text-muted">{PREVIEW_LINE}</p>
              </>
            )}
          </div>
        </div>
    </div>
  );
}

/** The returns line for what's in the bag: the one phrase, the made-for-you exception, or both. */
function policyLine(lines: CartLine[]): string {
  const made = lines.filter((l) => l.custom || l.upload).length;
  if (!made) return STORE_POLICY.returns;
  if (made === lines.length) return STORE_POLICY.customReturns;
  return `${STORE_POLICY.returns}. ${STORE_POLICY.customReturns}`;
}

/** Bag lines as GA4 items, each print's pair saving spread over its units (a print: a design and a personalised one's spec, as `purchase` counts them). */
function ecomItems(lines: CartLine[], pairs: { id: string; key?: string; saving: number }[]) {
  const printOf = (l: CartLine) => `${l.id}|${customKey(l.custom, l.upload)}`;
  const saving = new Map(pairs.map((p) => [`${p.id}|${p.key ?? ""}`, p.saving]));
  const units = new Map<string, number>();
  for (const l of lines) units.set(printOf(l), (units.get(printOf(l)) ?? 0) + l.qty);
  return lines.map((l) =>
    itemOf(l.shirt, { color: l.color, size: l.size, quantity: l.qty, custom: l.custom, upload: l.upload, discount: saving.has(printOf(l)) ? saving.get(printOf(l))! / units.get(printOf(l))! : undefined }),
  );
}

/** "$10 · free with 2 tees" for one tee, "Free" from two (the one shipping line, bag and checkout). */
export const shippingValue = (shipping: number) => (shipping === 0 ? "Free" : `${formatPrice(shipping)} · free with ${FREE_SHIPPING_TEES} tees`);

function Summary({ subtotal, discount, pairCount, shipping, total }: { subtotal: number; discount: number; pairCount: number; shipping: number; total: number }) {
  return (
    <div className="mt-4 space-y-2 text-sm">
      <Row label="Subtotal" value={formatPrice(subtotal)} />
      {discount > 0 && <Row label={`The pair${pairCount > 1 ? ` ×${pairCount}` : ""} · black + white`} value={`−${formatPrice(discount)}`} />}
      <Row label="Shipping" value={shippingValue(shipping)} />
      <div className="border-t border-white/10 pt-2">
        <Row label="Total" value={formatPrice(total)} strong />
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-medium text-white" : "text-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

type Field = "email" | "name" | "country" | "address" | "city" | "zip";

type FieldSpec = {
  key: Exclude<Field, "country">;
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: "email" | "text";
  autoCapitalize?: "none" | "words" | "characters";
  extra?: React.InputHTMLAttributes<HTMLInputElement>;
};
/** In the order people fill them: email, name, country (a select), address, city, postcode. */
const FIELDS: FieldSpec[] = [
  { key: "email", label: "Email", type: "email", autoComplete: "email", inputMode: "email", autoCapitalize: "none", extra: { autoCorrect: "off", spellCheck: false } },
  { key: "name", label: "Full name", type: "text", autoComplete: "shipping name", autoCapitalize: "words" },
  { key: "address", label: "Address", type: "text", autoComplete: "shipping address-line1" },
  { key: "city", label: "City", type: "text", autoComplete: "shipping address-level2", autoCapitalize: "words" },
  { key: "zip", label: "Postcode / ZIP", type: "text", autoComplete: "shipping postal-code", autoCapitalize: "characters" },
];
const ORDER: Field[] = ["email", "name", "country", "address", "city", "zip"];

/** Each field's problem, and the rule it broke (analytics names the rule, never the value). */
function validate(v: Record<Field, string>): Record<Field, { message: string; rule: string } | null> {
  const bad = (message: string, rule: string) => ({ message, rule });
  return {
    email: !v.email.trim() ? bad("Enter your email", "required") : isEmail(v.email) ? null : bad("Enter a valid email", "format"),
    name: v.name.trim().length < 2 ? bad("Enter your name", "required") : null,
    country: v.country ? null : bad("Select a country", "required"),
    address: v.address.trim().length < 4 ? bad("Enter an address", "required") : null,
    city: v.city.trim().length < 2 ? bad("Enter a city", "required") : null,
    zip: /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(v.zip.trim()) ? null : bad("Enter a postcode or ZIP", v.zip.trim() ? "format" : "required"),
  };
}

/** Express checkout (Apple Pay / Google Pay…) appears only once a provider is configured. */
const EXPRESS_PAY = process.env.NEXT_PUBLIC_EXPRESS_PAY ?? "";

const EMPTY_DETAILS: Record<Field, string> = { email: "", name: "", country: "", address: "", city: "", zip: "" };

/** The visitor's country among those offered: the time zone's biggest city (the place list Make uses), else the browser's language region; null when neither is offered. */
async function guessCountry(): Promise<string | null> {
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* no zone */
  }
  const places = zone ? await import("@/lib/custom/data").then((m) => m.loadCities()).catch(() => null) : null;
  const city = places?.list.filter((c) => c.tz === zone).sort((a, b) => b.pop - a.pop)[0];
  return codeOfCountry(city?.country) ?? countryFromLanguages(typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);
}

/** The offered countries a typed city is in (the place list; none when it isn't known). */
function useCityCountries(city: string): CountryCode[] {
  const [codes, setCodes] = useState<CountryCode[]>([]);
  useEffect(() => {
    const name = city.trim().toLowerCase();
    if (name.length < 3) return setCodes([]);
    let live = true;
    void import("@/lib/custom/data")
      .then((m) => m.loadCities())
      .then((places) => {
        if (!live) return;
        const found = places.list.filter((c) => c.name.toLowerCase() === name || c.ascii.toLowerCase() === name).map((c) => codeOfCountry(c.country));
        setCodes([...new Set(found.filter((c): c is CountryCode => !!c))]);
      })
      .catch(() => live && setCodes([]));
    return () => {
      live = false;
    };
  }, [city]);
  return codes;
}

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

function DetailsForm({
  values,
  setValues,
  touched,
  setTouched,
  lines,
  summaryLine,
  onSubmit,
}: {
  values: Record<Field, string>;
  setValues: Setter<Record<Field, string>>;
  /** Each field shows its error once it has been left (or on submit). */
  touched: Partial<Record<Field, boolean>>;
  setTouched: Setter<Partial<Record<Field, boolean>>>;
  lines: ReturnType<typeof cartLines>;
  /** The order in one line: "2 tees · $90 · Arrives …". */
  summaryLine: string;
  onSubmit: (c: Customer) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const errors = validate(values);
  const [summary, setSummary] = useState<number | null>(null);
  // The country, guessed until one is chosen; a typed city known in exactly one offered country sets it too.
  const chosen = useRef(false);
  useEffect(() => {
    let live = true;
    void guessCountry().then((code) => live && code && !chosen.current && setValues((v) => (v.country ? v : { ...v, country: code })));
    return () => {
      live = false;
    };
  }, [setValues]);
  const cityCountries = useCityCountries(values.city);
  useEffect(() => {
    if (!chosen.current && cityCountries.length === 1 && values.country !== cityCountries[0]) setValues((v) => ({ ...v, country: cityCountries[0] }));
  }, [cityCountries, values.country, setValues]);
  const conflict = countryConflicts(values.country, values.zip, cityCountries);

  const describe = (k: Field, err: boolean) => [err ? `err-${k}` : "", k === "country" && conflict ? "country-check" : ""].filter(Boolean).join(" ") || undefined;
  const input = (f: FieldSpec, last: boolean) => {
    const err = touched[f.key] ? errors[f.key] : null;
    return (
      <div key={f.key}>
        <label htmlFor={`f-${f.key}`} className="mb-1 block text-xs text-muted">
          {f.label}
        </label>
        <input
          id={`f-${f.key}`}
          name={f.key}
          type={f.type}
          autoComplete={f.autoComplete}
          autoCapitalize={f.autoCapitalize}
          enterKeyHint={last ? "go" : "next"}
          inputMode={f.inputMode}
          {...f.extra}
          value={values[f.key]}
          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
          aria-invalid={!!err}
          aria-describedby={describe(f.key, !!err)}
          className={`h-12 w-full rounded-control bg-transparent px-3 text-base text-white outline-none ring-1 ring-inset transition-shadow duration-150 ${err ? "ring-white" : "ring-white/25 focus:ring-white/60"}`}
        />
        {err && (
          <p id={`err-${f.key}`} className="mt-1 text-xs text-neutral-200">
            {err.message}
          </p>
        )}
      </div>
    );
  };
  const countryErr = touched.country ? errors.country : null;

  return (
    <form
      id="checkout-form"
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ email: true, name: true, country: true, address: true, city: true, zip: true });
        const bad = ORDER.filter((k) => errors[k]);
        if (bad.length) {
          for (const k of bad) track("form_error", { field: k, rule: errors[k]!.rule });
          // One summary, then the first thing to fix.
          setSummary(bad.length);
          form.current?.querySelector<HTMLElement>(`[name="${bad[0]}"]`)?.focus();
          return;
        }
        setSummary(null);
        const t = (k: Field) => values[k].trim();
        onSubmit({ name: t("name"), email: t("email"), address: t("address"), city: t("city"), zip: t("zip").toUpperCase(), country: values.country });
      }}
    >
      {/* The order, in one line. */}
      <p className="mb-5 text-sm text-neutral-300">{summaryLine}</p>
      <p role="alert" className="text-sm text-white empty:hidden">
        {summary ? `${summary} ${summary === 1 ? "field needs" : "fields need"} attention` : ""}
      </p>
      {EXPRESS_PAY && (
        <>
          <button type="button" className={`w-full ${BUTTON_PRIMARY}`}>
            Express checkout · {EXPRESS_PAY}
          </button>
          <p className="my-4 text-center text-xs text-muted">or enter your details</p>
        </>
      )}
      <h2 className="mb-3 text-xs text-muted">Delivery</h2>
      <div className="grid gap-3">
        {input(FIELDS[0], false)}
        {input(FIELDS[1], false)}
        <div>
          <label htmlFor="f-country" className="mb-1 block text-xs text-muted">
            Country
          </label>
          <select
            id="f-country"
            name="country"
            autoComplete="shipping country"
            value={values.country}
            onChange={(e) => {
              chosen.current = true;
              setValues((v) => ({ ...v, country: e.target.value }));
            }}
            onBlur={() => setTouched((t) => ({ ...t, country: true }))}
            aria-invalid={!!countryErr || conflict}
            aria-describedby={describe("country", !!countryErr)}
            className={`h-12 w-full rounded-control bg-transparent px-3 text-base text-white outline-none ring-1 ring-inset ${countryErr || conflict ? "ring-white" : "ring-white/25 focus:ring-white/60"}`}
          >
            <option value="" className="bg-ink-900">
              Select a country
            </option>
            {STORE_POLICY.countries.map(([code, name]) => (
              <option key={code} value={code} className="bg-ink-900">
                {name}
              </option>
            ))}
          </select>
          {countryErr && (
            <p id="err-country" className="mt-1 text-xs text-neutral-200">
              {countryErr.message}
            </p>
          )}
          {/* Never silently at odds with the city or postcode typed. */}
          {conflict && !countryErr && (
            <p id="country-check" className="mt-1 text-xs text-neutral-200">
              Check your country
            </p>
          )}
        </div>
        {input(FIELDS[2], false)}
        {input(FIELDS[3], false)}
        {input(FIELDS[4], true)}
      </div>
      {/* What's being ordered, at a glance. */}
      <ul className="mt-5 flex gap-2 overflow-x-auto pr-1 pt-2" aria-label="Items">
        {lines.map((l) => (
          <li key={lineKey(l)} className="relative w-14 shrink-0">
            <LineMockup line={l} className="w-full" />
            {l.qty > 1 && <span className="absolute -right-1 -top-1 bg-white px-1.5 text-xs tabular-nums text-black">{l.qty}</span>}
            <span className="sr-only">
              {l.qty} × {lineTitle(l)}, {COLOR_LABELS[l.color]}, {SIZE_LABELS[l.size]}
            </span>
          </li>
        ))}
      </ul>
    </form>
  );
}

function Confirmation({ order }: { order: Order }) {
  const lines = cartLines(order.items);
  // Placing the order moves focus to its heading.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const first = lines[0];
  const [referral, setReferral] = useState<{ code: string; url: string } | null>(null);
  // Referral codes need a backend; without one the block isn't shown.
  useEffect(() => {
    if (apiConfigured) void fetchReferral(order.number).then(setReferral);
  }, [order.number]);
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col px-4 pb-16 pt-8">
        <h1 ref={heading} tabIndex={-1} className="break-words text-[28px] font-medium leading-tight outline-none [overflow-wrap:anywhere]">
          Thank you, {order.customer.name.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-base text-neutral-200">
          Order <span className="whitespace-nowrap font-mono text-sm">{order.number}</span> is confirmed.
        </p>
        <p className="mt-1 break-words text-sm text-muted [overflow-wrap:anywhere]">
          Arrives {formatArrival({ from: new Date(order.arrives.from), to: new Date(order.arrives.to) })} in {order.customer.city}
        </p>
        <div className="mt-6 flex w-full gap-2">
          {lines.slice(0, 4).map((l) => (
            <div key={lineKey(l)} className="w-24">
              <LineMockup line={l} className="w-full" />
            </div>
          ))}
        </div>
        <ul className="mt-6 w-full space-y-1 text-sm">
          {lines.map((l) => (
            <li key={lineKey(l)} className="flex justify-between gap-3 text-neutral-300">
              <span>
                {l.qty}× {lineTitle(l)} · {COLOR_LABELS[l.color]} · {SIZE_LABELS[l.size]}
              </span>
              <span className="tabular-nums">{formatPrice(l.lineTotal)}</span>
            </li>
          ))}
          {!!order.discount && (
            <li className="flex justify-between text-neutral-300">
              <span>The pair · black + white</span>
              <span className="tabular-nums">−{formatPrice(order.discount)}</span>
            </li>
          )}
          <li className="flex justify-between text-neutral-300">
            <span>Shipping</span>
            <span className="tabular-nums">{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
          </li>
          <li className="flex justify-between border-t border-white/10 pt-2 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </li>
        </ul>

        <UploadReviews order={order.number} />

        {first && (
          <button
            type="button"
            onClick={() => useUiStore.getState().openShare(first.id, first.color, first.custom ? encodeMake(first.custom) : undefined, first.upload?.id)}
            className={`${TEXT_ACTION} mt-6 justify-start text-neutral-200 underline`}
          >
            Share {new Set(lines.map((l) => l.id)).size > 1 ? "a tee you picked" : "your tee"}
          </button>
        )}

        {referral && (
          <section className="mt-6 w-full border-t border-white/10 pt-4">
            <h2 className="text-sm font-medium">Give $10, get $10</h2>
            <p className="mt-1 text-xs text-muted">Share your code; you both get $10 off.</p>
            <p className="mt-2 font-mono text-sm">{referral.code}</p>
          </section>
        )}

        <Link href="/shop/" className={`mt-8 w-full ${BUTTON_PRIMARY}`}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
