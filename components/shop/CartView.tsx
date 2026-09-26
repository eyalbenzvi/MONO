"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Lock, Minus, Plus, RotateCcw, Share2, ShoppingBag, Trash2, Truck } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { ColorSelector, STAGE_BG, useShowMatch } from "@/components/ui";
import { FREE_SHIPPING_THRESHOLD, MAX_QTY, cartLines, cartTotals, type CartLine } from "@/lib/cart";
import { SHIRTS, dedupeByFamily, familiesOf, getShirtById } from "@/lib/catalog";
import { topPicks } from "@/lib/match";
import { ShirtStrip } from "@/components/ShirtStrip";
import { STORE_POLICY } from "@/lib/store-policy";
import { useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { apiConfigured, fetchReferral, isEmail } from "@/lib/api";
import { arrivalRange, formatArrival } from "@/lib/delivery";
import { COLOR_LABELS, SIZES, type Customer, type Order, type ShirtProduct, type ShirtSize } from "@/types/shirt";
import { formatPrice } from "@/lib/format";
import { itemOf, trackEcommerce, type AddSource } from "@/lib/analytics";
import { productHref } from "@/lib/catalog";

type Step = "bag" | "details" | "done";

export function CartView() {
  const hydrated = useHydrated();
  const cart = useCartStore((s) => s.cart);
  const lastOrder = useCartStore((s) => s.lastOrder);
  const setCartQty = useCartStore((s) => s.setCartQty);
  const changeCartItem = useCartStore((s) => s.changeCartItem);
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
  const go = (next: Step) => {
    moved.current = true;
    setStep(next);
  };

  const { lines, count, subtotal, discount, pairs, shipping, total, toFreeShipping: toFree } = cartTotals(cart);

  // view_cart once per visit to the bag, when it has loaded.
  const viewedCart = useRef(false);
  useEffect(() => {
    if (!hydrated || viewedCart.current) return;
    viewedCart.current = true;
    const t = cartTotals(useCartStore.getState().cart);
    trackEcommerce("view_cart", { value: t.total - t.shipping, items: ecomItems(t.lines, t.pairs) });
  }, [hydrated]);

  if (!hydrated) return <div className="flex-1" />;

  if (step === "done" && placed) return <Confirmation order={placed} />;

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className={`mx-auto px-4 pb-28 pt-1 ${step !== "done" && count > 0 ? "max-w-3xl lg:max-w-5xl" : "max-w-3xl"}`}>
        <div className="mb-4 flex items-center justify-between">
          {step === "details" ? (
            <button type="button" onClick={() => go("bag")} className="inline-flex h-9 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Bag
            </button>
          ) : (
            <Link href="/shop/" className="inline-flex h-9 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Continue shopping
            </Link>
          )}
          {count > 0 && <Steps step={step} />}
        </div>

        <h1 ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold tracking-tight outline-none">
          {step === "bag" ? "Your bag" : "Delivery details"}
        </h1>

        {count === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-neutral-600" />
            <p className="text-sm text-neutral-400">Your bag is empty.</p>
            <Link href="/shop/" className="flex h-11 items-center rounded-full bg-white px-6 text-sm font-bold text-black">
              Browse the shop
            </Link>
            {lastOrder && (
              <p className="mt-4 text-xs text-neutral-400">
                Last order {lastOrder.number} · {formatPrice(lastOrder.total)}
              </p>
            )}
            <Suggestions exclude={[]} title="Picked from your taste" source="empty_bag" savedFirst />
          </div>
        ) : step === "bag" ? (
          <>
            {/* Large screens: lines on the left, summary + checkout on the right (sticky). */}
            <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
              <div>
                <FreeShippingBar toFree={toFree} />
                <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {lines.map((line) => (
                  <motion.li
                    key={`${line.id}-${line.size}-${line.color}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
                    className="flex gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10"
                  >
                    <Link tabIndex={-1} aria-hidden href={productHref(line.id)} className={`w-20 shrink-0 self-start rounded-xl p-1.5 max-[339px]:w-14 ${STAGE_BG}`}>
                      <TeeMockup shirt={line.shirt} color={line.color} shadow={false} className="w-full" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{line.shirt.title}</p>
                          {/* Colour and size are the controls themselves: no meta line repeating them. */}
                          <div className="mt-1.5">
                            <ColorSelector variant="pills" value={line.color} original={line.shirt.baseColor} onChange={(color) => changeCartItem(line, { color })} />
                          </div>
                        </div>
                        <span className="font-mono text-sm">{formatPrice(line.lineTotal)}</span>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                        <select
                          value={line.size}
                          onChange={(e) => changeCartItem(line, { size: e.target.value as ShirtSize })}
                          aria-label="Size"
                          className="h-9 rounded-lg bg-white/[0.06] px-2 text-xs font-semibold text-white ring-1 ring-white/10"
                        >
                          {SIZES.map((s) => (
                            <option key={s} value={s} className="bg-ink-900">
                              Size {s}
                            </option>
                          ))}
                        </select>
                        <div className="flex h-9 items-center rounded-lg ring-1 ring-white/10">
                          <button type="button" aria-label="Decrease quantity" onClick={() => setCartQty(line, line.qty - 1)} className="flex h-9 w-9 items-center justify-center text-neutral-300 hover:text-white">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center font-mono text-sm" aria-live="polite">{line.qty}</span>
                          <button type="button" aria-label="Increase quantity" disabled={line.qty >= MAX_QTY} onClick={() => setCartQty(line, line.qty + 1)} className="flex h-9 w-9 items-center justify-center text-neutral-300 hover:text-white disabled:opacity-30">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button type="button" aria-label={`Remove ${line.shirt.title}`} onClick={() => setCartQty(line, 0)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-white/5 hover:text-white">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
                </ul>
              </div>
              <div className="lg:sticky lg:top-4 lg:[&>*:first-child]:mt-0">
            <Summary subtotal={subtotal} discount={discount} pairCount={pairs.reduce((n, p) => n + p.pairs, 0)} shipping={shipping} total={total} />
            <button
              type="button"
              onClick={() => {
                go("details");
                trackEcommerce("begin_checkout", { value: total, discount, shipping, items: ecomItems(lines, pairs) });
              }}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
            >
              <Lock className="h-4 w-4" /> Checkout · {formatPrice(total)}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden /> {STORE_POLICY.returns}
            </p>
              </div>
            </div>
            <Suggestions exclude={cart.map((l) => l.id)} title="One more from your taste" source="cart_xsell" />
          </>
        ) : (
          <DetailsForm
            values={values}
            setValues={setValues}
            touched={touched}
            setTouched={setTouched}
            total={total}
            lines={lines}
            summary={<Summary subtotal={subtotal} discount={discount} pairCount={pairs.reduce((n, p) => n + p.pairs, 0)} shipping={shipping} total={total} compact itemCount={count} />}
            onSubmit={(customer) => {
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
  );
}


/** Bag lines as GA4 items, each design's pair saving spread over its units. */
function ecomItems(lines: CartLine[], pairs: { id: string; saving: number }[]) {
  const saving = new Map(pairs.map((p) => [p.id, p.saving]));
  const units = new Map<string, number>();
  for (const l of lines) units.set(l.id, (units.get(l.id) ?? 0) + l.qty);
  return lines.map((l) => itemOf(l.shirt, { color: l.color, size: l.size, quantity: l.qty, discount: saving.has(l.id) ? saving.get(l.id)! / units.get(l.id)! : undefined }));
}

function Steps({ step }: { step: Step }) {
  const steps: Step[] = ["bag", "details", "done"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Step ${idx + 1} of 3`}>
      {steps.map((s, i) => (
        <span key={s} className={`h-1.5 rounded-full transition-all ${i <= idx ? "w-6 bg-white" : "w-3 bg-white/20"}`} />
      ))}
    </div>
  );
}

/** Thin black-and-white progress towards free shipping. */
function FreeShippingBar({ toFree }: { toFree: number }) {
  const done = toFree <= 0;
  const pct = Math.round(((FREE_SHIPPING_THRESHOLD - toFree) / FREE_SHIPPING_THRESHOLD) * 100);
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs text-neutral-300">{done ? "Free shipping" : `${formatPrice(toFree)} to free shipping`}</p>
      <div className="h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Towards free shipping">
        <motion.div className="h-full rounded-full bg-white" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
      </div>
    </div>
  );
}

/**
 * Three prints not already chosen (no family already in the bag or just
 * bought): on an empty bag, from Saved first; then the best matches once
 * the taste test is done (topPicks), otherwise from Saved, otherwise the
 * editors' picks. Used in the bag
 * ("One more from your taste"), an empty bag and after an order ("Your
 * next match").
 */
function Suggestions({ exclude, title: heading, source, savedFirst = false }: { exclude: string[]; title: string; source: AddSource; savedFirst?: boolean }) {
  const showMatch = useShowMatch();
  const vector = useTasteStore((s) => s.preferenceVector);
  const likedIds = useTasteStore((s) => s.likedIds);
  const lastOrder = useCartStore((s) => s.lastOrder);
  const key = exclude.join(",");
  const { picks, title } = useMemo(() => {
    const skip = familiesOf([...exclude, ...(lastOrder?.items.map((l) => l.id) ?? [])]);
    const pool = (list: ShirtProduct[]) => dedupeByFamily(list.filter((s) => !skip.has(s.family)).map((shirt) => ({ shirt }))).map((x) => x.shirt);
    // An empty bag starts from what was saved (F05).
    const saved = pool([...likedIds].reverse().map((id) => getShirtById(id)).filter((s): s is ShirtProduct => !!s)).slice(0, 3);
    if (savedFirst && saved.length) return { picks: saved, title: "From your Saved" };
    const fromTaste = showMatch
      ? topPicks(vector, 3, { excludeFamilies: skip })
      : pool([...likedIds].reverse().map((id) => getShirtById(id)).filter((s): s is ShirtProduct => !!s)).slice(0, 3);
    if (fromTaste.length) return { picks: fromTaste, title: heading };
    // No taste yet and nothing saved: the editors' order (the generator's
    // fixed ranking — not usage data), titled as exactly that.
    return { picks: pool([...SHIRTS].sort((a, b) => a.rank - b.rank).slice(0, 60)).slice(0, 3), title: "Editors' picks" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lastOrder, showMatch, vector, likedIds, heading, savedFirst]);
  if (picks.length === 0) return null;
  return (
    <section className="mt-8 w-full text-left">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ShirtStrip shirts={picks} layout="grid" quickAdd label={title} source={source} />
    </section>
  );
}

function Summary({
  subtotal,
  discount,
  pairCount,
  shipping,
  total,
  compact,
  itemCount,
}: {
  subtotal: number;
  discount: number;
  pairCount: number;
  shipping: number;
  total: number;
  compact?: boolean;
  itemCount?: number;
}) {
  return (
    <div className="mt-5 space-y-2 rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-white/10">
      {compact && itemCount !== undefined && (
        <Row label={`${itemCount} item${itemCount === 1 ? "" : "s"}`} value={`${formatPrice(subtotal)}`} />
      )}
      {!compact && <Row label="Subtotal" value={`${formatPrice(subtotal)}`} />}
      {discount > 0 && <Row label={`The pair${pairCount > 1 ? ` ×${pairCount}` : ""} · black + white`} value={`−${formatPrice(discount)}`} />}
      <Row label="Shipping" value={shipping === 0 ? "Free" : `${formatPrice(shipping)}`} />
      <div className="border-t border-white/10 pt-2">
        <Row label="Total" value={`${formatPrice(total)}`} bold />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-white" : "text-neutral-400"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

type Field = "name" | "email" | "address" | "city" | "zip" | "country";

const FIELDS: { key: Field; label: string; type: string; autoComplete: string; enterKeyHint: "next" | "done"; inputMode?: "email" | "text" }[] = [
  { key: "name", label: "Full name", type: "text", autoComplete: "name", enterKeyHint: "next" },
  { key: "email", label: "Email", type: "email", autoComplete: "email", enterKeyHint: "next", inputMode: "email" },
  { key: "address", label: "Street address", type: "text", autoComplete: "street-address", enterKeyHint: "next" },
  { key: "city", label: "City", type: "text", autoComplete: "address-level2", enterKeyHint: "next" },
  { key: "zip", label: "Postcode / ZIP", type: "text", autoComplete: "postal-code", enterKeyHint: "done" },
];

function validate(v: Record<Field, string>): Record<Field, string> {
  return {
    name: v.name.trim().length < 2 ? "Enter your name" : "",
    email: isEmail(v.email) ? "" : "Enter a valid email",
    address: v.address.trim().length < 4 ? "Enter a street address" : "",
    city: v.city.trim().length < 2 ? "Enter a city" : "",
    zip: /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(v.zip.trim()) ? "" : "Enter a postcode",
    country: v.country ? "" : "Choose a country",
  };
}

/** Express checkout (Apple Pay / Google Pay…) appears only once a provider is configured. */
const EXPRESS_PAY = process.env.NEXT_PUBLIC_EXPRESS_PAY ?? "";

const EMPTY_DETAILS: Record<Field, string> = { name: "", email: "", address: "", city: "", zip: "", country: "US" };

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

function DetailsForm({
  values,
  setValues,
  touched,
  setTouched,
  total,
  lines,
  summary,
  onSubmit,
}: {
  values: Record<Field, string>;
  setValues: Setter<Record<Field, string>>;
  /** Each field shows its error once it has been left (or on submit). */
  touched: Partial<Record<Field, boolean>>;
  setTouched: Setter<Partial<Record<Field, boolean>>>;
  total: number;
  lines: ReturnType<typeof cartLines>;
  summary: React.ReactNode;
  onSubmit: (c: Customer) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const errors = validate(values);
  const arrives = formatArrival(arrivalRange());

  const field = (f: (typeof FIELDS)[number]) => {
    const err = touched[f.key] && errors[f.key];
    return (
      <label key={f.key} className="block">
        <span className="mb-1 block text-xs text-neutral-400">{f.label}</span>
        <input
          name={f.key}
          type={f.type}
          autoComplete={f.autoComplete}
          enterKeyHint={f.enterKeyHint}
          inputMode={f.inputMode}
          value={values[f.key]}
          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
          aria-invalid={!!err}
          aria-describedby={err ? `err-${f.key}` : undefined}
          className={`h-12 w-full rounded-xl bg-white/[0.05] px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 ${
            err ? "ring-2 ring-white" : "ring-1 ring-white/10 focus:ring-white/50"
          }`}
        />
        {/* Monochrome errors: a thick white ring plus a marked message, no red. */}
        {err && (
          <span id={`err-${f.key}`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-white">
            <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[11px] font-black text-black">!</span>
            {err}
          </span>
        )}
      </label>
    );
  };

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ name: true, email: true, address: true, city: true, zip: true, country: true });
        const first = (Object.keys(errors) as Field[]).find((k) => errors[k]);
        if (first) {
          // Take the shopper to the first thing to fix.
          form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
          return;
        }
        const t = (k: Field) => values[k].trim();
        onSubmit({ name: t("name"), email: t("email"), address: t("address"), city: t("city"), zip: t("zip").toUpperCase(), country: values.country });
      }}
    >
      {/* Large screens: details on the left, the order + pay button on the right (sticky). */}
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
      <div>
      {EXPRESS_PAY && (
        <>
          <button type="button" className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            Express checkout · {EXPRESS_PAY}
          </button>
          <p className="my-4 text-center text-xs text-neutral-400">or enter your details</p>
        </>
      )}
      <div className="grid gap-3">
        {FIELDS.slice(0, 4).map(field)}
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {field(FIELDS[4])}
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-400">Country</span>
            <select
              name="country"
              autoComplete="country"
              value={values.country}
              onChange={(e) => setValues((v) => ({ ...v, country: e.target.value }))}
              className="h-12 w-full rounded-xl bg-white/[0.05] px-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/50"
            >
              {STORE_POLICY.countries.map(([code, name]) => (
                <option key={code} value={code} className="bg-ink-900">
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      </div>
      <div className="lg:sticky lg:top-4">
      {/* What's being ordered, at a glance. */}
      {/* pt-2: room for the quantity badges, which sit above the thumbnails. */}
      <ul className="mt-3 flex gap-2 overflow-x-auto pr-1 pt-2" aria-label="Items">
        {lines.map((l) => (
          <li key={`${l.id}-${l.size}-${l.color}`} className={`relative w-14 shrink-0 rounded-lg p-1 ${STAGE_BG}`}>
            <TeeMockup shirt={l.shirt} color={l.color} shadow={false} className="w-full" />
            {l.qty > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 font-mono text-xs font-bold text-black">{l.qty}</span>}
            <span className="sr-only">
              {l.qty} × {l.shirt.title}, {COLOR_LABELS[l.color]}, {l.size}
            </span>
          </li>
        ))}
      </ul>
      {summary}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-neutral-300">
        <Truck className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Arrives {arrives}
      </p>
      <p className="mt-2 text-center text-xs text-neutral-400">Demo store — no payment is taken and nothing ships.</p>
      <button type="submit" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]">
        Place demo order · {formatPrice(total)}
      </button>
      </div>
      </div>
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
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-md flex-col items-center px-4 pb-28 pt-8 text-center">
        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
          <CheckCircle2 className="h-14 w-14" />
        </motion.div>
        <h1 ref={heading} tabIndex={-1} className="mt-4 text-2xl font-bold tracking-tight outline-none">
          Order placed
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Thanks, {order.customer.name.split(" ")[0]}. Demo order <span className="whitespace-nowrap font-mono text-white">{order.number}</span> — a confirmation would go to{" "}
          {order.customer.email}.
        </p>
        {/* Icon and text wrap as one centred group; the city never splits. */}
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-neutral-300">
          <Truck className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          <span>Arrives {formatArrival({ from: new Date(order.arrives.from), to: new Date(order.arrives.to) })}</span>
          <span className="whitespace-nowrap">in {order.customer.city}</span>
        </p>
        <div className="mt-6 flex w-full justify-center -space-x-3">
          {lines.slice(0, 4).map((l) => (
            <div key={`${l.id}-${l.size}-${l.color}`} className={`w-24 rounded-2xl p-2 ring-2 ring-ink-950 ${STAGE_BG}`}>
              <TeeMockup shirt={l.shirt} color={l.color} shadow={false} className="w-full" />
            </div>
          ))}
        </div>
        <ul className="mt-6 w-full space-y-1 text-left text-sm">
          {lines.map((l) => (
            <li key={`${l.id}-${l.size}-${l.color}`} className="flex justify-between text-neutral-300">
              <span>
                {l.qty}× {l.shirt.title} · {COLOR_LABELS[l.color]} · {l.size}
              </span>
              <span className="font-mono">{formatPrice(l.lineTotal)}</span>
            </li>
          ))}
          {!!order.discount && (
            <li className="flex justify-between text-neutral-300">
              <span>The pair · black + white</span>
              <span className="font-mono">−{formatPrice(order.discount)}</span>
            </li>
          )}
          <li className="flex justify-between text-neutral-300">
            <span>Shipping</span>
            <span className="font-mono">{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
          </li>
          <li className="flex justify-between border-t border-white/10 pt-2 font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatPrice(order.total)}</span>
          </li>
        </ul>

        {first && (
          <button
            type="button"
            onClick={() => useUiStore.getState().openShare(first.id, first.color)}
            className="mt-6 flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/5"
          >
            <Share2 className="h-4 w-4" /> Share {new Set(lines.map((l) => l.id)).size > 1 ? "a tee you picked" : "your tee"}
          </button>
        )}

        <Suggestions exclude={order.items.map((l) => l.id)} title="Your next match" source="confirm" />

        {referral && (
          <section className="mt-6 w-full rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10">
            <h2 className="text-sm font-semibold">Give $10, get $10</h2>
            <p className="mt-1 text-xs text-neutral-400">Share your code; you both get $10 off.</p>
            <p className="mt-2 font-mono text-sm">{referral.code}</p>
          </section>
        )}

        <Link href="/shop/" className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black">
          Back to the shop
        </Link>
      </motion.div>
    </div>
  );
}
