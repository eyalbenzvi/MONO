"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CustomSpec } from "@/lib/custom/spec";
import { tasteQ } from "@/lib/custom/tasteCode";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import type { EditorProps } from "./types";

type Source = "yours" | "friend" | "link";

/**
 * Your Taste: nothing to type. The plant is grown from your taste; before
 * the taste test there's nothing to grow yet (the example, and a way to
 * Discover). A friend's taste that came with this visit (a ?taste= link) can
 * be grown instead: the gift. A shared plant's link shows that plant.
 */
export default function TasteEditor({ arrival, onChange }: EditorProps) {
  const vector = useTasteStore((s) => s.preferenceVector);
  const { complete } = useCalibrationProgress();
  const friend = useUiStore((s) => s.friendTaste);
  const linked = arrival?.t === "taste" ? arrival.p.q : null;
  const [source, setSource] = useState<Source>(linked ? "link" : "yours");
  const q = source === "link" && linked ? linked : source === "friend" && friend ? tasteQ(friend) : complete ? tasteQ(vector) : null;
  const blocked = !q;

  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => {
    report.current(q ? { spec: { t: "taste", v: 1, p: { q } } as CustomSpec } : { spec: null, blocked: true });
  }, [q]);

  if (blocked)
    return (
      <p className="text-sm text-neutral-300">
        <Link href="/" className="underline underline-offset-4 hover:text-white">
          Ten swipes first →
        </Link>
      </p>
    );
  return (
    <div className="grid gap-1 text-sm text-neutral-400">
      {source !== "yours" && <p>{source === "friend" ? "Grown from your friend’s taste." : "Grown from the taste this link carries."}</p>}
      {source !== "friend" && friend && (
        <button type="button" onClick={() => setSource("friend")} className="h-10 w-fit text-neutral-300 underline underline-offset-4 hover:text-white">
          Grow your friend’s instead
        </button>
      )}
      {source !== "yours" && complete && (
        <button type="button" onClick={() => setSource("yours")} className="h-10 w-fit text-neutral-300 underline underline-offset-4 hover:text-white">
          Grow yours instead
        </button>
      )}
    </div>
  );
}
