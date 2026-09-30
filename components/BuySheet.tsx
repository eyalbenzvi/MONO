"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet, useSheet } from "@/components/Sheet";
import { TeeMockup } from "@/components/TeeMockup";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, SizeSelector, radioKeys, useSizeRequired } from "@/components/ui";
import { productHref } from "@/lib/catalog";
import { PAIR_PRICE, ctaLabel, pairStatus } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { SIZES } from "@/lib/images";
import { track } from "@/lib/analytics";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useUiStore } from "@/store/useUiStore";
import { COLOR_LABELS, teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

type Choice = BaseColor | "both";

/**
 * Buy from Discover without leaving it: the tee on the card, its colour (or
 * both, the pair) and size (the remembered size already picked), and "Buy
 * now", which puts it in the bag and opens checkout; "Add to bag" keeps you
 * swiping. The deck and the card are untouched. Back closes it (#buy).
 */
export function BuySheet({ shirt, onClose }: { shirt: ShirtProduct | null; onClose: () => void }) {
  // The last tee stays rendered while the sheet animates away.
  const [last, setLast] = useState(shirt);
  if (shirt && shirt !== last) setLast(shirt);
  useEffect(() => {
    if (shirt) track("buy_sheet_open", { id: shirt.id });
  }, [shirt]);
  const dismiss = () => {
    if (shirt) track("buy_sheet_dismiss", { id: shirt.id });
    onClose();
  };
  return (
    <Sheet open={!!shirt} onClose={dismiss} historyKey="buy" label={last ? `Buy ${last.title}` : "Buy"}>
      {last && <BuyForm key={last.id} shirt={last} onDone={onClose} />}
    </Sheet>
  );
}

function BuyForm({ shirt, onDone }: { shirt: ShirtProduct; onDone: () => void }) {
  const sheet = useSheet();
  const cart = useCartStore.getState();
  const [choice, setChoice] = useState<Choice>(teeColor(shirt, cart.selectedColors[shirt.id]));
  const [size, setSize] = useState(sizeFor(cart, shirt.id));
  const { nudge, groupRef, require, status } = useSizeRequired("buy_sheet");
  const bag = useCartStore((s) => s.cart);
  const both = choice === "both";
  const color = both ? shirt.baseColor : choice;
  const pair = both && size ? pairStatus(bag, shirt.id, size) : null;

  const add = (silent: boolean) => {
    if (!size) {
      require();
      return false;
    }
    const store = useCartStore.getState();
    return both ? store.addPair(shirt.id, size, { source: "discover_card", silent }) : store.addToCart(shirt.id, size, color, 1, { source: "discover_card", silent });
  };
  const buyNow = () => {
    if (!add(true) && !(pair && pair.missing.length === 0)) return;
    useUiStore.getState().requestCheckout();
    sheet?.navigate("/cart/");
  };
  const addToBag = () => {
    if (add(false)) onDone();
  };

  const options: Choice[] = shirt.colors.length > 1 ? ["black", "white", "both"] : [shirt.baseColor];
  const keys = radioKeys(options, choice, setChoice);

  return (
    <div className="pb-2">
      <div className="flex items-start gap-3">
        <div className="w-20 shrink-0">
          <TeeMockup shirt={shirt} color={color} sizes={SIZES.thumb} className="w-full" />
        </div>
        <h2 className="min-w-0 flex-1 pt-1 text-base font-medium leading-snug">{shirt.title}</h2>
      </div>

      {/* The tee colour, or both: the pair is itself a buying choice, so its price is here. */}
      {options.length > 1 && (
        <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tee colour">
          {options.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={choice === c}
              onClick={() => {
                setChoice(c);
                if (c === "both") track("pair_select", { id: shirt.id, source: "buy_sheet" });
              }}
              {...keys(i)}
              className={`h-11 min-w-11 whitespace-nowrap rounded-control px-2 text-sm font-medium transition-colors duration-150 ${choice === c ? "bg-white text-black" : "text-neutral-200 ring-1 ring-inset ring-white/20 hover:bg-white/5"}`}
            >
              {c === "both" ? `Both · ${formatPrice(PAIR_PRICE)}` : COLOR_LABELS[c]}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3">
        <SizeSelector key={nudge} value={size} onChange={setSize} highlight={nudge > 0 && !size} groupRef={groupRef} />
        {status}
      </div>

      <button type="button" data-autofocus onClick={buyNow} className={`mt-4 w-full ${BUTTON_PRIMARY}`}>
        {pair?.missing.length === 0 ? "In your bag · Checkout" : ctaLabel({ verb: "Buy now", size, price: shirt.price, both, status: pair })}
      </button>
      <button type="button" onClick={addToBag} className={`mt-2 w-full ${BUTTON_SECONDARY}`}>
        Add to bag
      </button>
      <Link
        href={productHref(shirt.id)}
        onClick={(e) => {
          e.preventDefault();
          sheet?.navigate(productHref(shirt.id));
        }}
        className="mt-2 flex h-11 items-center justify-between border-t border-white/10 text-sm text-neutral-200 hover:text-white"
      >
        View tee <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
