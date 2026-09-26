"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * While `active`: keeps Tab focus inside `ref`, closes on Escape, moves focus
 * in on open and returns it to the previously focused element on close —
 * or to `returnTo()` when nothing was focused (e.g. opened by a gesture).
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, onClose: () => void, returnTo?: () => HTMLElement | null | undefined) {
  // Keep the latest onClose without re-running the effect (which would bounce focus).
  const close = useRef(onClose);
  close.current = onClose;
  const fallback = useRef(returnTo);
  fallback.current = returnTo;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // Prefer an explicit [data-autofocus] target (e.g. the primary CTA).
    const first = () => el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    // Wait a frame so enter animations have mounted their content.
    const raf = requestAnimationFrame(() => first()?.focus({ preventScroll: true }));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      const back = previous && previous !== document.body && previous.isConnected ? previous : fallback.current?.();
      back?.focus?.({ preventScroll: true });
    };
  }, [active, ref]);
}
