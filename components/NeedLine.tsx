"use client";

import { needLine, useCalibrationProgress } from "@/store/tasteStore";

/** What the taste still needs, in words: "Almost there. Keep 2 you’d wear." (the Discover strip says the same). */
export function NeedLine({ className = "" }: { className?: string }) {
  const progress = useCalibrationProgress();
  return <p className={`text-sm text-neutral-200 ${className}`}>{needLine(progress)}</p>;
}
