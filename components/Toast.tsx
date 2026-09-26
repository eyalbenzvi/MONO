"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";

export function Toast() {
  const toast = useUiStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    // Give actionable toasts ("Removed · Undo") time to be used.
    const t = setTimeout(() => {
      if (useUiStore.getState().toast?.nonce === toast.nonce) useUiStore.setState({ toast: null });
    }, toast.action ? 4000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    // At the bottom, above the safe area and the bottom bars (Discover's
    // buttons, the product page's buy bar), over drawers and sheets too.
    // The live region is always in the DOM so screen readers hear each toast.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] z-[60] flex justify-center px-4"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.nonce}
            initial={{ y: 24, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="flex max-w-full items-center gap-2 whitespace-nowrap rounded-full bg-white py-2 pl-4 pr-2 text-sm font-semibold text-black shadow-2xl shadow-black"
          >
            {!toast.action && <Check className="h-4 w-4" />}
            <span className="truncate pr-2">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  useUiStore.setState({ toast: null });
                }}
                className="pointer-events-auto h-8 rounded-full bg-black px-3 text-xs font-bold text-white"
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
