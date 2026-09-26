"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Lock, Minus, Plus, RotateCcw, Share2, ShoppingBag, Trash2, Truck } from "lucide-react";
import { DropSignup } from "@/components/DropSignup";
import { QuickAdd } from "@/components/QuickAdd";
import { TeeMockup } from "@/components/TeeMockup";
import { ColorSelector, STAGE_BG, useShowMatch } from "@/components/ui";
import { FREE_SHIPPING_THRESHOLD, MAX_QTY, cartLines, cartTotals } from "@/lib/cart";
import { SHIRTS, dedupeByFamily, familiesOf, getShirtById } from "@/lib/catalog";
import { rankShirts } from "@/lib/recommendation";
import { STORE_POLICY } from "@/lib/store-policy";
import { useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { apiConfigured, fetchReferral, isEmail } from "@/lib/api";
import { arrivalRange, formatArrival } from "@/lib/delivery";
import { COLOR_LABELS, SIZES, type Customer, type Order, type ShirtProduct, type ShirtSize } from "@/types/shirt";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";
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

  const { lines, count, subtotal, discount, pairs, shipping, total, toFreeShipping: toFree } = cartTotals(cart);

  if (!hydrated) return <div className="flex-1" />;

  if (step === "done" && placed) return <Confirmation order={placed} />;

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-1">
        <div className="mb-4 flex items-center justify-between">
          {step === "details" ? (
            <button type="button" onClick={() => setStep("bag")} className="inline-flex h-9 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Bag
            </button>
          ) : (
            <Link href="/shop/" className="inline-flex h-9 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Continue shopping
            </Link>
          )}
          <Steps step={step} />
        </div>

        <h1 className="mb-4 text-2xl font-bold tracking-tight">{step === "bag" ? "Your bag" : "Delivery details"}</h1>

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
          </div>
        ) : step === "bag" ? (
          <>
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
                    <Link href={productHref(line.id)} className={`w-20 shrink-0 rounded-xl p-1.5 ${STAGE_BG}`}>
                      <TeeMockup shirt={line.shirt} color={line.color} shadow={false} className="w-full" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{line.shirt.title}</p>
                          <p className="text-xs text-neutral-400">
                            {COLOR_LABELS[line.color]} · {line.size}
                          </p>
                          <div className="mt-1.5">
                            <ColorSelector variant="pills" value={line.color} original={line.shirt.baseColor} onChange={(color) => changeCartItem(line, { color })} />
                          </div>
                        </div>
                        <span className="font-mono text-sm">{formatPrice(line.lineTotal)}</span>
                      </div>
                      <div className="mt-auto flex items-center gap-2 pt-2">
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
            <Summary subtotal={subtotal} discount={discount} pairCount={pairs.reduce((n, p) => n + p.pairs, 0)} shipping={shipping} total={total} />
            <button
              type="button"
              onClick={() => {
                setStep("details");
                track("begin_checkout", { value: total, items: cart.reduce((n, l) => n + l.qty, 0), currency: "USD" });
              }}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
            >
              <Lock className="h-4 w-4" /> Checkout · {formatPrice(total)}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden /> {STORE_POLICY.returns}
            </p>
            <Suggestions exclude={cart.map((l) => l.id)} title="One more from your taste" />
          </>
        ) : (
          <DetailsForm
            total={total}
            lines={lines}
            summary={<Summary subtotal={subtotal} discount={discount} pairCount={pairs.reduce((n, p) => n + p.pairs, 0)} shipping={shipping} total={total} compact itemCount={count} />}
            onSubmit={(customer) => {
              const order = placeOrder(customer);
              if (order) {
                setPlaced(order);
                setStep("done");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}


function Steps({ step }: { step: Step }) {
  const steps: Step[] = ["bag", "details", "done"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${idx + 1} of 3`}>
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
 * Three prints not already chosen: the best matches once the taste test is
 * done, otherwise from Saved. Nothing honest to suggest → nothing shown.
 * Used in the bag ("One more from your taste") and after an order ("Your
 * next match").
 */
function Suggestions({ exclude, title }: { exclude: string[]; title: string }) {
  const showMatch = useShowMatch();
  const vector = useTasteStore((s) => s.preferenceVector);
  const likedIds = useTasteStore((s) => s.likedIds);
  const skip = familiesOf(exclude);
  const pool = (list: ShirtProduct[]) => dedupeByFamily(list.filter((s) => !skip.has(s.family)).map((shirt) => ({ shirt }))).map((x) => x.shirt);
  const picks = showMatch
    ? pool(rankShirts(vector, SHIRTS).map((r) => r.shirt)).slice(0, 3)
    : pool([...likedIds].reverse().map((id) => getShirtById(id)).filter((s): s is ShirtProduct => !!s)).slice(0, 3);
  if (picks.length === 0) return null;
  return (
    <section className="mt-8 w-full text-left">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="grid grid-cols-3 gap-3">
        {picks.map((p) => (
          <li key={p.id} className="flex min-w-0 flex-col gap-1.5">
            <Link href={productHref(p.id)} className={`rounded-xl p-1.5 ${STAGE_BG}`} aria-label={`${p.title}, ${formatPrice(p.price)}`}>
              <TeeMockup shirt={p} shadow={false} className="w-full" />
            </Link>
            <p className="truncate text-xs text-neutral-300">{p.title}</p>
            <QuickAdd shirt={p} />
          </li>
        ))}
      </ul>
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

function DetailsForm({
  total,
  lines,
  summary,
  onSubmit,
}: {
  total: number;
  lines: ReturnType<typeof cartLines>;
  summary: React.ReactNode;
  onSubmit: (c: Customer) => void;
}) {
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", address: "", city: "", zip: "", country: "US" });
  // Each field shows its error once it has been left (or on submit).
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoNote, setPromoNote] = useState("");
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
        <div className="grid grid-cols-2 gap-3">
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

      {/* Promo code: tucked away, one tap to open. */}
      <div className="mt-4">
        {promoOpen ? (
          <div className="flex gap-2">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              aria-label="Promo code"
              placeholder="Promo code"
              autoComplete="off"
              enterKeyHint="done"
              className="h-11 min-w-0 flex-1 rounded-xl bg-white/[0.05] px-3 text-sm uppercase text-white outline-none ring-1 ring-white/10 placeholder:normal-case placeholder:text-neutral-600 focus:ring-white/50"
            />
            <button
              type="button"
              onClick={() => setPromoNote(promo.trim() ? "Promo codes aren't active in this demo store." : "")}
              className="h-11 rounded-xl px-4 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/5"
            >
              Apply
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setPromoOpen(true)} aria-expanded={false} className="text-xs font-medium text-neutral-300 underline underline-offset-4 hover:text-white">
            Have a promo code?
          </button>
        )}
        {promoNote && (
          <p role="status" className="mt-1.5 text-xs text-neutral-400">
            {promoNote}
          </p>
        )}
      </div>

      {/* What's being ordered, at a glance. */}
      <ul className="mt-5 flex gap-2 overflow-x-auto" aria-label="Items">
        {lines.map((l) => (
          <li key={`${l.id}-${l.size}-${l.color}`} className={`relative w-14 shrink-0 rounded-lg p-1 ${STAGE_BG}`}>
            <TeeMockup shirt={l.shirt} color={l.color} shadow={false} className="w-full" />
            {l.qty > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 font-mono text-[11px] font-bold text-black">{l.qty}</span>}
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
    </form>
  );
}

function Confirmation({ order }: { order: Order }) {
  const lines = cartLines(order.items);
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
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Order placed</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Thanks, {order.customer.name.split(" ")[0]}. Demo order <span className="font-mono text-white">{order.number}</span> — a confirmation would go to{" "}
          {order.customer.email}.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-300">
          <Truck className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Arrives {formatArrival({ from: new Date(order.arrives.from), to: new Date(order.arrives.to) })} · {order.customer.city}
        </p>
        <div className="mt-6 flex w-full justify-center -space-x-6">
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

        <Suggestions exclude={order.items.map((l) => l.id)} title="Your next match" />

        <DropSignup source="order" />

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
