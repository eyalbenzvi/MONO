"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { track } from "@/lib/analytics";
import { OFFER_LINE, OFFER_MS, offerState, parseOfferForce, shopId } from "@/lib/upload/openCall";
import { useMakeStore, FORCE_KEY } from "@/store/makeStore";
import { useUiStore } from "@/store/useUiStore";
import { CATEGORY_LABELS, SHIRT_CATEGORIES, type ShirtCategory } from "@/types/shirt";

const INPUT =
  "h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white [color-scheme:dark]";

/** Offer a cleared upload to the catalogue (the Open Call, simulated): opened from a review status's quiet link. */
export function OfferSheet() {
  const id = useUiStore((s) => s.offer);
  const close = () => useUiStore.getState().openOffer(null);
  return <AnimatePresence>{id && <Sheet key={id} uploadId={id} onClose={close} />}</AnimatePresence>;
}

function Sheet({ uploadId, onClose }: { uploadId: string; onClose: () => void }) {
  const meta = useMakeStore((s) => s.uploads[uploadId]);
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  const [title, setTitle] = useState(meta?.title ?? "");
  const [category, setCategory] = useState<ShirtCategory>(meta?.category ?? "pattern");
  const [credit, setCredit] = useState("");
  const [own, setOwn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!meta) return null;

  const offer = async () => {
    const t = title.trim();
    const lex = await import("@/lib/custom/lexicon");
    const problem = t.length < 3 || t.length > 40 ? "A title of 3 to 40 characters." : lex.wordsProblem(t) ?? (credit.trim() ? lex.wordsProblem(credit) : null);
    if (problem) return setError(problem);
    let force: ReturnType<typeof parseOfferForce>;
    try {
      force = parseOfferForce(new URLSearchParams(window.location.search).get("review") ?? sessionStorage.getItem(FORCE_KEY));
    } catch {
      force = undefined;
    }
    const now = Date.now();
    const o = {
      uploadId,
      id: shopId(now),
      title: t,
      category,
      credit: credit.trim().slice(0, 28) || "Anonymous",
      submittedAt: now,
      quality: meta.quality,
      distance: meta.distance,
      features: meta.features,
      colors: meta.tees,
      ...(force ? { force } : {}),
    };
    useMakeStore.getState().putOffer(o);
    track("offer_submit");
    // The result, once the (simulated) curation is in: accepted or not, never what it was.
    setTimeout(() => {
      const cur = useMakeStore.getState().offers[uploadId];
      if (cur && !cur.withdrawn) track("offer_result", { accepted: offerState(cur, Date.now()) === "accepted" });
    }, OFFER_MS + 100);
    onClose();
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Offer it to the catalogue"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="no-scrollbar fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-ink-900 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 ring-1 ring-white/10"
      >
        <div className="flex items-start justify-between">
          <h2 className="pt-2 text-base font-bold">Offer it to the catalogue</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-neutral-300 hover:text-white">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <label className="block text-xs font-medium text-neutral-400">
          Title
          <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} mt-1`} data-autofocus />
        </label>
        <label className="block text-xs font-medium text-neutral-400">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as ShirtCategory)} className={`${INPUT} mt-1`}>
            {SHIRT_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-ink-900">
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-400">
          Credit <span className="text-neutral-500">optional</span>
          <input value={credit} maxLength={28} placeholder="Anonymous" onChange={(e) => setCredit(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <p className="text-sm text-neutral-300">{OFFER_LINE}</p>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-200">
          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-white" />
          It&rsquo;s my own work, and I allow MONO to sell it.
        </label>
        {error && <p className="text-xs text-neutral-300">{error}</p>}
        <button type="button" disabled={!own} onClick={offer} className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black disabled:opacity-40">
          Offer it
        </button>
      </motion.div>
    </>
  );
}
