"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ShirtStrip } from "@/components/ShirtStrip";
import { Sheet, useSheet } from "@/components/Sheet";
import { BUTTON_PRIMARY, TEXT_ACTION } from "@/components/ui";
import { archetypeOf, sharedTraits, tasteSentence, traitWords } from "@/lib/taste";
import { topPicks } from "@/lib/match";
import { useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

/** The reveal's one handoff line (and its accessible description). */
export const HANDOFF = "Your shop is now edited around this.";

/**
 * Shown once, when the taste test is finished: the hand-off into the shop.
 * The result in words (the archetype and one sentence), three tees, one way
 * on ("See your edit") and a quiet "Keep swiping" (also Back). Sharing your
 * taste is in Your taste.
 */
export function CalibrationComplete() {
  const hydrated = useUiStore((s) => s.hydrated);
  const acknowledged = useTasteStore((s) => s.calibrationAcknowledged);
  const acknowledge = useTasteStore((s) => s.acknowledgeCalibration);
  const { complete } = useCalibrationProgress();
  const open = hydrated && complete && !acknowledged;
  // "Keep swiping" (or Back) hands focus to the new top card; otherwise the strip.
  const keepSwiping = useRef(false);
  const returnTo = useCallback(
    () =>
      (keepSwiping.current ? document.querySelector<HTMLElement>('[aria-roledescription="card"]') : null) ??
      document.querySelector<HTMLElement>("[data-strip]"),
    [],
  );
  const close = useCallback(() => {
    keepSwiping.current = true;
    acknowledge();
  }, [acknowledge]);

  return (
    <Sheet open={open} onClose={close} historyKey="reveal" labelledBy="reveal-title" describedBy="reveal-handoff" returnTo={returnTo} footer={<Actions />}>
      <Reveal />
    </Sheet>
  );
}

function Reveal() {
  const vector = useTasteStore((s) => s.preferenceVector);
  const friend = useUiStore((s) => s.friendTaste);
  const acknowledge = useTasteStore((s) => s.acknowledgeCalibration);
  const sheet = useSheet();
  // Picked once, when the result appears (the same three however it re-renders).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const picks = useMemo(() => topPicks(vector, 3), []);
  const shared = friend ? sharedTraits(vector, friend) : [];
  return (
    <div>
      <p className="text-xs text-muted">Your taste</p>
      <h2 id="reveal-title" className="mt-1 text-[28px] font-medium leading-tight">
        {archetypeOf(vector).name}
      </h2>
      <p className="mt-2 text-base text-neutral-200">{tasteSentence(vector)}</p>
      {friend && (
        <p className="mt-2 text-sm text-neutral-300">
          {shared.length ? `You and your friend share: ${traitWords(shared)}.` : "You and your friend see it differently."}
        </p>
      )}
      <div className="mt-4">
        <ShirtStrip
          shirts={picks}
          layout="grid"
          names={false}
          label="Your edit"
          onOpen={() => acknowledge()}
          onNavigate={(href) => sheet?.navigate(href)}
        />
      </div>
      <p id="reveal-handoff" className="mt-4 text-sm text-neutral-200">
        {HANDOFF}
      </p>
    </div>
  );
}

function Actions() {
  const sheet = useSheet();
  const acknowledge = useTasteStore((s) => s.acknowledgeCalibration);
  // Phones sideways: the two side by side, so both stay in reach.
  return (
    <div className="grid gap-1 [@media(max-height:500px)]:grid-cols-2">
      <Link
        href="/shop/"
        data-autofocus
        onClick={(e) => {
          e.preventDefault();
          acknowledge();
          sheet?.navigate("/shop/");
        }}
        className={BUTTON_PRIMARY}
      >
        See your edit
      </Link>
      <button type="button" onClick={() => sheet?.close()} className={`${TEXT_ACTION} mx-auto`}>
        Keep swiping
      </button>
    </div>
  );
}
