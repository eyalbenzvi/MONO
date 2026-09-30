"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUiStore } from "@/store/useUiStore";

/** A toast with an action ("Removed from Saved · Undo") stays this long; a plain one shorter. */
const ACTION_MS = 5000;
const PLAIN_MS = 2500;

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  // Held while the pointer or focus is on it, so its action can still be used.
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!toast || held) return;
    const t = setTimeout(() => {
      if (useUiStore.getState().toast?.nonce === toast.nonce) useUiStore.setState({ toast: null });
    }, toast.action ? ACTION_MS : PLAIN_MS);
    return () => clearTimeout(t);
  }, [toast, held]);

  return (
    // At the bottom, just above the tab bar or the page's sticky button
    // (--dock): one line, within the thumb. The live region is always in the
    // DOM so screen readers hear each toast.
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--dock,0px)+8px)] z-toast flex justify-center px-3">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.nonce}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
            className="pointer-events-auto flex h-14 w-full max-w-lg items-center justify-between gap-3 rounded-control bg-white pl-4 pr-1.5 text-sm font-medium text-black shadow-2xl shadow-black"
          >
            <span className="truncate">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  useUiStore.setState({ toast: null });
                }}
                className="flex h-11 min-w-11 shrink-0 items-center justify-center px-3 underline underline-offset-4"
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
