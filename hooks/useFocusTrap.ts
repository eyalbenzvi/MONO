"use client";

import { useEffect, useRef, type RefObject } from "react";
import { openDialog } from "@/store/useUiStore";

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * What Tab actually reaches, in order: focusable, not taken out of the tab
 * order (tabindex -1 — e.g. the unchecked options of a radiogroup, which
 * are reached with the arrow keys) and rendered.
 */
const tabbable = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.tabIndex >= 0 && n.getClientRects().length > 0 && !n.closest("[inert]"));

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
    // Counted in state while open: the page's keyboard shortcuts stand down
    // until it closes (not until its exit animation leaves the DOM).
    const closeDialog = openDialog();
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // Prefer an explicit [data-autofocus] target (e.g. the primary CTA).
    const first = () => el?.querySelector<HTMLElement>("[data-autofocus]") ?? (el ? tabbable(el)[0] : undefined);
    // Wait a frame so enter animations have mounted their content.
    const raf = requestAnimationFrame(() => first()?.focus({ preventScroll: true }));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = tabbable(el);
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      // Focus somehow outside (or on something Tab can't reach): back inside.
      if (!items.includes(document.activeElement as HTMLElement)) {
        e.preventDefault();
        (e.shiftKey ? tail : head).focus();
        return;
      }
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
      closeDialog();
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      const back = previous && previous !== document.body && previous.isConnected ? previous : fallback.current?.();
      // Nothing to return to: don't leave focus on a control inside the
      // dialog while it animates out (it would take the next key press).
      if (!back && el?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      back?.focus?.({ preventScroll: true });
    };
  }, [active, ref]);
}
