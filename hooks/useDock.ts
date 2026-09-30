"use client";

import { useEffect, useId, type RefObject } from "react";
import { setDock } from "@/lib/dock";

/** While `active`, the element counts as part of the bottom dock (lib/dock): its top edge, measured from the bottom of the screen. */
export function useDock(ref: RefObject<HTMLElement>, active = true) {
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return setDock(id, null);
    const measure = () => setDock(id, window.innerHeight - el.getBoundingClientRect().top);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      setDock(id, null);
    };
  }, [ref, active, id]);
}
