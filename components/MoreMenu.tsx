"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { IconName } from "@/lib/icons";

export interface MoreItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  /** A destructive action (reset…): shown last, in a quieter colour. */
  danger?: boolean;
}

/**
 * The one "⋯" menu: secondary actions (share, zoom, view the print, reset…)
 * live here instead of on the page. A bottom sheet on phones, a small panel
 * under the button on larger screens. Choosing an item closes the menu first.
 */
export function MoreMenu({ items, label = "More", className = "", tone = "dark" }: { items: MoreItem[]; label?: string; className?: string; tone?: "dark" | "glass" }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  useFocusTrap(panel, open, close);
  if (!items.length) return null;
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-neutral-200 transition hover:text-white ${tone === "glass" ? "bg-black/55 ring-1 ring-white/15 backdrop-blur-md" : "hover:bg-white/10"} ${className}`}
      >
        <Icon name="ellipsis" className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-ink-900 px-3 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 ring-1 ring-white/10 md:bottom-auto md:left-auto md:right-6 md:top-24 md:w-72 md:rounded-2xl md:pb-2 md:shadow-2xl md:shadow-black"
            >
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden />
              <ul className="grid">
                {[...items.filter((i) => !i.danger), ...items.filter((i) => i.danger)].map((item, k) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      {...(k === 0 ? { "data-autofocus": true } : {})}
                      onClick={() => {
                        close();
                        // After the menu's focus trap has released (it restores focus on close).
                        setTimeout(item.onSelect, 0);
                      }}
                      className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-white/5 ${item.danger ? "text-neutral-400" : "text-white"}`}
                    >
                      <Icon name={item.icon} className="h-4 w-4" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
