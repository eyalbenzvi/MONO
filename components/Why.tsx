"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { productHref } from "@/lib/catalog";
import type { WhyMatch } from "@/lib/why";
import { FEATURE_LABELS } from "@/types/shirt";

const LABEL = "text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500";

/** A personalised line that is its own "why?": tap it (dotted underline) to see the reasons. */
export function WhyToggle({
  text,
  open,
  onToggle,
  controls,
  className = "",
}: {
  text: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  controls: string;
  className?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  // Esc closes the reasons and returns focus to the line.
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onToggle(false);
      btn.current?.focus();
    };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [open, onToggle]);
  return (
    <button
      ref={btn}
      type="button"
      onClick={() => onToggle(!open)}
      aria-expanded={open}
      aria-controls={controls}
      className={`relative text-left text-sm text-neutral-400 underline decoration-neutral-600 decoration-dotted underline-offset-4 before:absolute before:-inset-2 hover:text-white ${open ? "text-white" : ""} ${className}`}
    >
      {text}
    </button>
  );
}

/** The panel under a WhyToggle: height eases open (a fade with reduced motion). */
export function WhyPanel({ id, open, children }: { id: string; open: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          role="region"
          aria-label="Why it's for you"
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.25 }}
          className="overflow-hidden"
        >
          <div className="mt-3 border-y border-white/15">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function WhyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2.5 last:border-b-0">
      <dt className={`shrink-0 ${LABEL}`}>{label}</dt>
      <dd className="text-right text-sm text-neutral-200">{children}</dd>
    </div>
  );
}

export function YourTasteLink() {
  return (
    <Link href="/me/" className="block py-3 text-xs text-neutral-400 hover:text-white">
      Your taste →
    </Link>
  );
}

/** The reasons behind a match (lib/why): shared traits, rank, the saved design it's like. */
export function WhyMatchRows({ why }: { why: WhyMatch }) {
  return (
    <>
      <dl>
        <WhyRow label="Shared">{why.shared.map((k) => FEATURE_LABELS[k]).join(" · ")}</WhyRow>
        <WhyRow label="Rank">
          <span className="font-mono tabular-nums">
            Top {why.rankPct}% of {why.total.toLocaleString("en-US")}
          </span>
        </WhyRow>
        {why.saved ? (
          <WhyRow label="Saved">You saved this</WhyRow>
        ) : (
          why.like && (
            <WhyRow label="Like">
              <Link href={productHref(why.like.id)} className="underline decoration-neutral-600 underline-offset-4 hover:text-white">
                {why.like.title}
              </Link>
            </WhyRow>
          )
        )}
      </dl>
      <YourTasteLink />
    </>
  );
}

/** A stable id for a panel (aria-controls). */
export function useWhyId() {
  return `why-${useId().replace(/:/g, "")}`;
}
