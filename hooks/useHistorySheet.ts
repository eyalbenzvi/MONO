"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * An overlay as a step in the history, so a phone's Back closes it (as the
 * bag's #details step does): opening pushes `#key` (never twice), Back pops
 * it and closes, and closing from inside (X, the backdrop, an action) takes
 * the entry back out. Navigating away from inside uses `navigate`, which
 * replaces the overlay's entry instead of stacking one on it.
 */
export function useHistorySheet(key: string | undefined, open: boolean, onClose: () => void) {
  const router = useRouter();
  const pushed = useRef(false);
  const leaving = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !key) return;
    const hash = `#${key}`;
    if (window.location.hash !== hash) {
      // The router's own state is kept on the entry (it restores the page from it on Back).
      window.history.pushState({ ...(window.history.state ?? {}), sheet: key }, "", `${window.location.pathname}${window.location.search}${hash}`);
      pushed.current = true;
    }
    const onPop = () => {
      if (window.location.hash === hash) return;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from inside, staying on the page: the overlay's entry goes too.
      if (pushed.current && !leaving.current && window.location.hash === hash) window.history.back();
      pushed.current = false;
      leaving.current = false;
    };
  }, [open, key]);

  /** X, the backdrop, Escape: through the history when the overlay is on it. */
  const close = useCallback(() => {
    if (pushed.current && key && window.location.hash === `#${key}`) window.history.back();
    else closeRef.current();
  }, [key]);

  /** Leave for another page from inside the overlay: its entry becomes that page. */
  const navigate = useCallback(
    (href: string) => {
      const replace = pushed.current;
      leaving.current = true;
      closeRef.current();
      if (replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );

  return { close, navigate };
}
