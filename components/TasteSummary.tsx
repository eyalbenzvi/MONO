"use client";

import { useState } from "react";
import { archetypeOf, tasteSentence, traitWords } from "@/lib/taste";
import { topTraits } from "@/lib/recommendation";
import { shareTaste } from "@/lib/shareTaste";
import { TEXT_ACTION } from "@/components/ui";
import type { UserProfileVector } from "@/types/shirt";

/**
 * Your taste, in words: the archetype, one sentence, up to five traits, and
 * "Share your taste" as a text link. The same in the sheet opened from the
 * Discover strip and on You; each host adds its own actions.
 */
export function TasteSummary({ vector, heading = "h2", eyebrow = true, children }: { vector: UserProfileVector; heading?: "h1" | "h2" | "h3"; eyebrow?: boolean; children?: React.ReactNode }) {
  const [sharing, setSharing] = useState(false);
  const H = heading;
  const traits = topTraits(vector, 5);
  return (
    <div>
      {eyebrow && <p className="text-xs text-muted">Your taste</p>}
      <H className="mt-1 text-[28px] font-medium leading-tight">{archetypeOf(vector).name}</H>
      <p className="mt-2 text-base text-neutral-200">{tasteSentence(vector)}</p>
      {traits.length > 0 && <p className="mt-2 text-sm text-muted">{traitWords(traits, " · ")}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-6">
        <button
          type="button"
          disabled={sharing}
          onClick={async () => {
            setSharing(true);
            try {
              await shareTaste(vector);
            } finally {
              setSharing(false);
            }
          }}
          className={`${TEXT_ACTION} -ml-0 justify-start text-white underline disabled:opacity-60`}
        >
          {sharing ? "Making your card…" : "Share your taste"}
        </button>
        {children}
      </div>
    </div>
  );
}
