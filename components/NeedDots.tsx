"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { MIN_LIKES, MIN_PASSES, useCalibrationProgress } from "@/store/tasteStore";

/**
 * What the taste still needs, without words: ♥ and ✕ with a dot per like
 * and pass (filled = have it). A tap says it in one line.
 */
export function NeedDots({ className = "" }: { className?: string }) {
  const { likes, passes, likesNeeded, passesNeeded } = useCalibrationProgress();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);
  const need = [likesNeeded && `${likesNeeded} more like${likesNeeded === 1 ? "" : "s"}`, passesNeeded && `${passesNeeded} more pass${passesNeeded === 1 ? "" : "es"}`].filter(Boolean).join(" and ");
  const line = `Not enough to know your taste yet: ${need}.`;
  return (
    <div ref={root} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={line} className="flex h-10 items-center gap-4 rounded-full px-1 text-neutral-400 hover:text-white">
        <Dots icon="heart" have={likes} of={MIN_LIKES} />
        <Dots icon="x" have={passes} of={MIN_PASSES} />
      </button>
      {open && (
        <p role="status" className="absolute left-0 top-full z-30 mt-1 w-max max-w-[80vw] rounded-xl bg-white px-3 py-2 text-xs font-medium text-black shadow-lg">
          {line}
        </p>
      )}
    </div>
  );
}

function Dots({ icon, have, of }: { icon: "heart" | "x"; have: number; of: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <Icon name={icon} className={`h-3.5 w-3.5 ${icon === "heart" ? "fill-current" : ""}`} strokeWidth={icon === "x" ? 3 : 2} />
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < have ? "bg-white" : "bg-white/20"}`} />
      ))}
    </span>
  );
}
