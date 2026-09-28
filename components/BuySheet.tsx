"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { TeeMockup } from "@/components/TeeMockup";
import { ColorSelector, SizeSelector, STAGE_BG } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { SIZES } from "@/lib/images";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useUiStore } from "@/store/useUiStore";
import { SIZE_LABELS, teeColor, type BaseColor, type ShirtProduct } from "@/types/shirt";

/**
 * Buy from Discover without leaving it: the tee on the card, its colour and
 * size (the remembered size already picked), and "Buy now", which puts it in
 * the bag and opens checkout. "Add to bag" keeps you swiping. The deck and
 * the card are untouched.
 */
export function BuySheet({ shirt, onClose }: { shirt: ShirtProduct | null; onClose: () => void }) {
  return <AnimatePresence>{shirt && <Sheet key={shirt.id} shirt={shirt} onClose={onClose} />}</AnimatePresence>;
}

function Sheet({ shirt, onClose }: { shirt: ShirtProduct; onClose: () => void }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  const cart = useCartStore.getState();
  const [color, setColor] = useState<BaseColor>(teeColor(shirt, cart.selectedColors[shirt.id]));
  const [size, setSize] = useState(sizeFor(cart, shirt.id));
  const [nudge, setNudge] = useState(0);

  const add = (silent: boolean) => {
    if (!size) {
      setNudge((n) => n + 1);
      return false;
    }
    return useCartStore.getState().addToCart(shirt.id, size, color, 1, { source: "discover_card", silent });
  };
  const buyNow = () => {
    if (!add(true)) return;
    useUiStore.getState().requestCheckout();
    onClose();
    router.push("/cart/");
  };
  const addToBag = () => {
    if (add(false)) onClose();
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Buy ${shirt.title}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="no-scrollbar fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-ink-900 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 ring-1 ring-white/10"
      >
        <div className="flex items-start gap-3">
          <div className={`w-20 shrink-0 rounded-xl p-1 ${STAGE_BG}`}>
            <TeeMockup shirt={shirt} color={color} sizes={SIZES.thumb} className="w-full" />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="line-clamp-2 text-base font-bold leading-snug">{shirt.title}</h2>
            <p className="mt-0.5 font-mono text-sm text-neutral-300">{formatPrice(shirt.price)}</p>
            <Link href={productHref(shirt.id)} onClick={onClose} className="mt-1 inline-block text-xs text-neutral-400 underline underline-offset-2 hover:text-white">
              Details
            </Link>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {shirt.colors.length > 1 && (
          <div className="mt-4">
            <ColorSelector value={color} original={shirt.baseColor} onChange={setColor} variant="pills" />
          </div>
        )}
        <div className="mt-4">
          <SizeSelector key={nudge} value={size} onChange={setSize} compact highlight={nudge > 0 && !size} />
        </div>

        <button type="button" data-autofocus onClick={buyNow} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98]">
          <Icon name="lock" className="h-4 w-4" />
          {size ? `Buy now · ${SIZE_LABELS[size]} · ${formatPrice(shirt.price)}` : "Choose size"}
        </button>
        <button type="button" onClick={addToBag} className="mt-1 h-11 w-full text-sm font-semibold text-neutral-300 hover:text-white">
          Add to bag, keep swiping
        </button>
      </motion.div>
    </>
  );
}
