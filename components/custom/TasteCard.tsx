"use client";

import { useMemo } from "react";
import { MakeCard } from "@/components/custom/MakeIndex";
import type { MadeProduct } from "@/lib/custom/products";
import type { CustomSpec } from "@/lib/custom/spec";
import { tasteQ } from "@/lib/custom/tasteCode";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useHydrated } from "@/store/useUiStore";

/** Your Taste on the Make index: the visitor's own plant once the taste is known, else the example and a nudge to swipe. */
export default function TasteCard({ made }: { made: MadeProduct }) {
  const hydrated = useHydrated();
  const { complete } = useCalibrationProgress();
  const vector = useTasteStore((s) => s.preferenceVector);
  const own = hydrated && complete;
  const spec: CustomSpec = useMemo(() => (own ? { t: "taste", v: 1, p: { q: tasteQ(vector) } } : made.example), [own, vector, made.example]);
  return <MakeCard made={made} spec={spec} from={hydrated ? (complete ? "Your swipes, as they stand" : "Your swipes. Swipe a few first.") : made.from} />;
}
