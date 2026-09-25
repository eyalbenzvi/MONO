"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useHydrated } from "@/components/AppShell";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG } from "@/components/ui";
import { FREE_SHIPPING_THRESHOLD, MAX_QTY, cartLines, cartTotals } from "@/lib/cart";
import { useShirtStore } from "@/store/useShirtStore";
import { COLOR_LABELS, SIZES, skuFor, type BaseColor, type Order, type ShirtSize } from "@/types/shirt";

type Step = "bag" | "details" | "done";

export function CartView() {
  const hydrated = useHydrated();
  const cart = useShirtStore((s) => s.cart);
  const lastOrder = useShirtStore((s) => s.lastOrder);
  const setCartQty = useShirtStore((s) => s.setCartQty);
  const changeCartItem = useShirtStore((s) => s.changeCartItem);
  const placeOrder = useShirtStore((s) => s.placeOrder);
  const [step, setStep] = useState<Step>("bag");
  const [placed, setPlaced] = useState<Order | null>(null);

  const { lines, count, subtotal, shipping, total } = cartTotals(cart);
  const toFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

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
              <p className="mt-4 text-xs text-neutral-500">
                Last order {lastOrder.number} · ${lastOrder.total.toFixed(2)}
              </p>
            )}
          </div>
        ) : step === "bag" ? (
          <>
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
                    <Link href={`/shop/${line.id}/`} className={`w-20 shrink-0 rounded-xl p-1.5 ${STAGE_BG}`}>
                      <TeeMockup shirt={line.shirt} color={line.color} shadow={false} className="w-full" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{line.shirt.title}</p>
                          <p className="text-xs text-neutral-500">
                            {COLOR_LABELS[line.color]} tee · {skuFor(line.shirt.sku, line.color)}
                          </p>
                          <ColorSwatches
                            value={line.color}
                            original={line.shirt.baseColor}
                            onChange={(color) => changeCartItem(line, { color })}
                          />
                        </div>
                        <span className="font-mono text-sm">${line.lineTotal}</span>
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
                        <button type="button" aria-label={`Remove ${line.shirt.title}`} onClick={() => setCartQty(line, 0)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-white/5 hover:text-rose-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <Summary subtotal={subtotal} shipping={shipping} total={total} toFree={toFree} />
            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
            >
              <Lock className="h-4 w-4" /> Checkout · ${total.toFixed(2)}
            </button>
          </>
        ) : (
          <DetailsForm
            total={total}
            summary={<Summary subtotal={subtotal} shipping={shipping} total={total} toFree={toFree} compact itemCount={count} />}
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

/** Compact black/white toggle for a bag line. */
function ColorSwatches({ value, original, onChange }: { value: BaseColor; original: BaseColor; onChange: (c: BaseColor) => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5" role="radiogroup" aria-label="Tee colour">
      {(["black", "white"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`${COLOR_LABELS[c]} tee${c === original ? " (original)" : ""}`}
          onClick={() => onChange(c)}
          className={`flex h-7 items-center gap-1.5 rounded-full pl-1 pr-2 text-[11px] font-medium transition ${
            value === c ? "bg-white/10 text-white ring-1 ring-white" : "text-neutral-500 ring-1 ring-white/10 hover:text-neutral-300"
          }`}
        >
          <span className={`h-5 w-5 rounded-full ring-1 ${c === "black" ? "bg-black ring-white/40" : "bg-white ring-black/20"}`} aria-hidden />
          {COLOR_LABELS[c]}
        </button>
      ))}
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

function Summary({
  subtotal,
  shipping,
  total,
  toFree,
  compact,
  itemCount,
}: {
  subtotal: number;
  shipping: number;
  total: number;
  toFree: number;
  compact?: boolean;
  itemCount?: number;
}) {
  return (
    <div className="mt-5 space-y-2 rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-white/10">
      {compact && itemCount !== undefined && (
        <Row label={`${itemCount} item${itemCount === 1 ? "" : "s"}`} value={`$${subtotal.toFixed(2)}`} />
      )}
      {!compact && <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />}
      <Row label="Shipping" value={shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`} />
      {toFree > 0 && !compact && (
        <p className="text-xs text-neutral-500">Add ${toFree.toFixed(2)} more for free shipping.</p>
      )}
      <div className="border-t border-white/10 pt-2">
        <Row label="Total" value={`$${total.toFixed(2)}`} bold />
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

function DetailsForm({
  total,
  summary,
  onSubmit,
}: {
  total: number;
  summary: React.ReactNode;
  onSubmit: (c: { name: string; email: string }) => void;
}) {
  const [values, setValues] = useState({ name: "", email: "", address: "", city: "" });
  const [touched, setTouched] = useState(false);
  const errors = {
    name: values.name.trim().length < 2 ? "Enter your name" : "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ? "" : "Enter a valid email",
    address: values.address.trim().length < 4 ? "Enter a street address" : "",
    city: values.city.trim().length < 2 ? "Enter a city" : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (valid) onSubmit({ name: values.name.trim(), email: values.email.trim() });
      }}
    >
      <div className="grid gap-3">
        {(
          [
            ["name", "Full name", "text", "name"],
            ["email", "Email", "email", "email"],
            ["address", "Street address", "text", "street-address"],
            ["city", "City", "text", "address-level2"],
          ] as const
        ).map(([key, label, type, autoComplete]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs text-neutral-400">{label}</span>
            <input
              type={type}
              autoComplete={autoComplete}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              aria-invalid={touched && !!errors[key]}
              className={`h-12 w-full rounded-xl bg-white/[0.05] px-3 text-sm text-white outline-none ring-1 transition placeholder:text-neutral-600 focus:ring-white/50 ${
                touched && errors[key] ? "ring-rose-500/70" : "ring-white/10"
              }`}
            />
            {touched && errors[key] && <span className="mt-1 block text-xs text-rose-400">{errors[key]}</span>}
          </label>
        ))}
      </div>
      {summary}
      <p className="mt-3 text-center text-xs text-neutral-500">
        Demo store — no payment is taken and nothing ships.
      </p>
      <button
        type="submit"
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]"
      >
        Place demo order · ${total.toFixed(2)}
      </button>
    </form>
  );
}

function Confirmation({ order }: { order: Order }) {
  const lines = cartLines(order.items);
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-md flex-col items-center px-4 pb-28 pt-8 text-center"
      >
        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
          <CheckCircle2 className="h-14 w-14" />
        </motion.div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Order placed</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Thanks, {order.name.split(" ")[0]}. Demo order <span className="font-mono text-white">{order.number}</span> — a
          confirmation would go to {order.email}.
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
              <span className="font-mono">${l.lineTotal}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-white/10 pt-2 font-semibold">
            <span>Total</span>
            <span className="font-mono">${order.total.toFixed(2)}</span>
          </li>
        </ul>
        <Link href="/shop/" className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black">
          Back to the shop
        </Link>
      </motion.div>
    </div>
  );
}
