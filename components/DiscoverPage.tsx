"use client";

import { useEffect, useState } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import { CalibrationComplete } from "@/components/CalibrationComplete";
import { CardStack } from "@/components/CardStack";
import { getShirtById } from "@/lib/catalog";
import { archetypeOf, noteOf } from "@/lib/taste";
import { TasteSheet } from "@/components/TasteSheet";
import { canUndo, needLine, useCalibrationProgress, useTasteStore } from "@/store/tasteStore";
import { useHydrated, useUiStore } from "@/store/useUiStore";
import { useHistorySheet } from "@/hooks/useHistorySheet";

/** How long "Saved · Undo" stays in the strip after a swipe. */
const UNDO_MS = 4000;
/** The card the one stylist note shows on, if the taste leans clearly by then. */
const NOTE_CARD = 6;

/** The first line of the taste test: what the ten cards are for. */
export const TEST_GOAL = "Ten tees. Keep or pass. We’ll edit the shop to your taste.";
/** Once the taste is known: what Discover is from then on. */
export const KNOWN_GOAL = "Discover: every swipe refines your edit.";

/** The top strip keeps one fixed height across phases so the card never jumps. */
const STRIP = "mx-auto flex h-11 w-full max-w-[420px] shrink-0 flex-col justify-center px-4 outline-none";

export function DiscoverPage() {
  const hydrated = useHydrated();
  const { complete } = useCalibrationProgress();
  // The card's details face is a step in the history: Back turns the card back.
  const isFlipped = useUiStore((s) => s.isFlipped);
  useHistorySheet("details-card", isFlipped, () => useUiStore.getState().toggleFlip(false));

  // Keyboard shortcuts (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Any open dialog (zoom, share, taste-test screen) owns the keyboard:
      // Escape there closes only that dialog, never the card flip. Read from
      // state, not the DOM: a closing dialog stays in the DOM while it
      // animates out, and must not swallow the next key.
      if (useUiStore.getState().dialogs > 0) return;
      // Leave browser / OS shortcuts alone (⌘Z, Ctrl+R, Alt+←…).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Keys typed into a field, or pressed on a focused control, belong to
      // that control: Space/Backspace on a button must not swipe or undo.
      // Escape never activates a control, so it closes the details from anywhere.
      if (e.key === "Escape") {
        if (useUiStore.getState().isFlipped) useUiStore.getState().toggleFlip(false);
        return;
      }
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (t instanceof Element && t.closest('button, a, [role="button"], [role="radio"], [role="tab"], [contenteditable=""], [contenteditable="true"]')) return;
      const { requestSwipe, undoLast } = useTasteStore.getState();
      const { toggleFlip } = useUiStore.getState();
      if (e.key === "ArrowRight") requestSwipe("like");
      else if (e.key === "ArrowLeft") requestSwipe("dislike");
      else if (e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Phones held sideways (the `sideways` variant): the strip moves atop the
  // button column beside the card, which keeps the height.
  return (
    <div className="flex min-h-0 flex-1 flex-col sideways:flex-row">
      {/* What the page is, for screen readers and crawlers: the same words as the strip. */}
      <h1 className="sr-only">{hydrated && complete ? KNOWN_GOAL : TEST_GOAL}</h1>
      <div className="sideways:hidden">{hydrated ? <TopStrip /> : <div className={STRIP} />}</div>
      <section className="relative min-h-0 flex-1 px-4 pb-1 pt-1 sideways:py-2">
        {hydrated ? <CardStack /> : <CardSkeleton />}
      </section>
      {/* `contents` in portrait (no box); sideways, a column: status + buttons. */}
      <div className="contents sideways:flex sideways:flex-col sideways:justify-center">
        {hydrated && (
          <div className="hidden w-56 pb-1 pr-[max(env(safe-area-inset-right),16px)] sideways:block">
            <TopStrip />
          </div>
        )}
        <ActionButtons />
      </div>
      {hydrated && <Announcer />}
      <CalibrationComplete />
    </div>
  );
}

/** The last swipe, while its Undo is still offered (UNDO_MS); null after. */
function useRecentSwipe() {
  const swiped = useUiStore((s) => s.swiped);
  const undoable = useTasteStore(canUndo);
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => {
    if (!swiped) return setLive(null);
    setLive(swiped.nonce);
    const t = setTimeout(() => setLive(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [swiped]);
  return swiped && live === swiped.nonce && undoable ? swiped : null;
}

/**
 * The one line above the card, never empty during the taste test. It
 * replaces its own words: the goal on the first card, "Learning your taste ·
 * N/10", "Last one."; one stylist note if the answers lean clearly; what's
 * still missing; then "Your taste · The …". For a moment after each swipe it
 * says what happened, with Undo.
 */
function TopStrip() {
  const { done, total, complete, phase, likesNeeded, passesNeeded } = useCalibrationProgress();
  const onboardingSeen = useTasteStore((s) => s.onboardingSeen);
  const vector = useTasteStore((s) => s.preferenceVector);
  const friend = useUiStore((s) => s.friendTaste);
  const recent = useRecentSwipe();
  const [sheet, setSheet] = useState(false);
  const line = "block truncate text-center text-[13px] leading-5";

  let body: React.ReactNode;
  if (recent)
    body = (
      <p className={`${line} text-neutral-200`}>
        {recent.action === "like" ? "Saved" : "Passed"} ·{" "}
        <button type="button" onClick={() => useTasteStore.getState().undoLast()} className="-my-3 inline-flex h-11 min-w-11 items-center justify-center px-1 font-medium text-white underline underline-offset-4">
          Undo
        </button>
      </p>
    );
  else if (complete) {
    const { name } = archetypeOf(vector);
    body = (
      <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" className={`${line} mx-auto flex h-11 min-w-11 items-center justify-center px-2 text-neutral-400 hover:text-white`}>
        Your taste · <span className="ml-1 text-white">{name}</span>
        <span aria-hidden className="ml-1">
          ›
        </span>
      </button>
    );
  } else if (phase === "more") body = <p className={`${line} text-neutral-200`}>{needLine({ likesNeeded, passesNeeded })}</p>;
  else {
    const current = Math.min(done + 1, total);
    const note = current === NOTE_CARD ? noteOf(vector) : null;
    const words =
      done === 0
        ? friend && !onboardingSeen
          ? `Your friend is ${archetypeOf(friend).name}. Swipe ten to compare.`
          : <SharedSeedLine />
        : note ?? (current === total ? "Last one." : `Learning your taste · ${current}/${total}`);
    body = (
      <>
        <p className={`${line} text-neutral-200`}>{words}</p>
        {/* The one progress indicator: a thin line, as long as the answers so far. */}
        <div
          className="mt-1.5 h-0.5 w-full bg-white/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={`Card ${current} of ${total}`}
          aria-label="Taste test progress"
        >
          <div className="h-full bg-white transition-[width] duration-150 ease-out" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </>
    );
  }

  return (
    <div className={STRIP} data-strip tabIndex={-1}>
      {body}
      <TasteSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

/**
 * The first card's line. Arriving from a friend's shared tee that was saved
 * (lib/share, the product page): that tee is where the taste starts.
 */
function SharedSeedLine() {
  const likedIds = useTasteStore((s) => s.likedIds);
  const [seed, setSeed] = useState<string | null>(null);
  useEffect(() => {
    try {
      setSeed(sessionStorage.getItem(SHARED_SEED_KEY));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const shirt = seed && likedIds.includes(seed) ? getShirtById(seed) : undefined;
  // The saved tee isn't one of the ten test cards, so ten are still to come.
  return <>{shirt ? `Saved ${shirt.title}. Ten more and your edit is ready.` : TEST_GOAL}</>;
}

/** The tee a shared link opened (this session): set by the product page. */
export const SHARED_SEED_KEY = "mono-shared-seed";

/** One polite live region: what each swipe did, and what's next. */
function Announcer() {
  const swiped = useUiStore((s) => s.swiped);
  const topId = useTasteStore((s) => s.deck[0]?.id);
  const { done, total, phase } = useCalibrationProgress();
  const [text, setText] = useState("");
  useEffect(() => {
    if (!swiped) return;
    const was = getShirtById(swiped.id);
    const next = topId ? getShirtById(topId) : undefined;
    const count = phase === "test" ? ` ${Math.min(done, total)} of ${total}.` : "";
    setText(swiped.action === "like" ? `Saved ${was?.title ?? ""}.${count}` : `Passed.${next ? ` Next: ${next.title}.` : ""}${count}`);
    // Once per swipe: the deck and counts it reads settle in the same update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swiped]);
  return (
    <p role="status" className="sr-only">
      {text}
    </p>
  );
}

function CardSkeleton() {
  return (
    <div className="relative mx-auto h-full w-full max-w-[420px]">
      <div className="absolute inset-0 bg-white/[0.04]" />
    </div>
  );
}
