"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sheet, useSheet } from "@/components/Sheet";
import { TasteSummary } from "@/components/TasteSummary";
import { BUTTON_PRIMARY } from "@/components/ui";
import { track } from "@/lib/analytics";
import { useTasteStore } from "@/store/tasteStore";

/**
 * "Your taste", opened from the Discover strip: the same summary as on You
 * (archetype, one sentence, traits, Share your taste), and one way on: your
 * edit. Resetting lives on You only.
 */
export function TasteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vector = useTasteStore((s) => s.preferenceVector);
  useEffect(() => {
    if (open) track("taste_sheet_open");
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} historyKey="taste" label="Your taste" footer={<SeeYourEdit />}>
      <TasteSummary vector={vector} />
    </Sheet>
  );
}

function SeeYourEdit() {
  const sheet = useSheet();
  return (
    <Link
      href="/shop/"
      data-autofocus
      onClick={(e) => {
        e.preventDefault();
        sheet?.navigate("/shop/");
      }}
      className={`w-full ${BUTTON_PRIMARY}`}
    >
      See your edit
    </Link>
  );
}
