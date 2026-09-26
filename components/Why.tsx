"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WhyMatch } from "@/lib/why";
import { FEATURE_LABELS } from "@/types/shirt";

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
          <div>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The reasons behind a match (lib/why), in one quiet line: the traits in common and the rank. */
export function WhyMatchRows({ why }: { why: WhyMatch }) {
  return (
    <WhyLine>
      {why.shared.map((k) => FEATURE_LABELS[k]).join(" · ")} · <span className="tabular-nums">Top {why.rankPct}%</span>
    </WhyLine>
  );
}

/** One line of reasons, and a small arrow to the whole taste. */
export function WhyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-3 pt-2 text-xs text-neutral-400">
      <span>{children}</span>
      <Link href="/me/" aria-label="Your taste" className="-m-2 shrink-0 p-2 text-neutral-500 hover:text-white">
        →
      </Link>
    </p>
  );
}

/** A stable id for a panel (aria-controls). */
export function useWhyId() {
  return `why-${useId().replace(/:/g, "")}`;
}
