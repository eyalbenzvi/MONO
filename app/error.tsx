"use client";

import { BUTTON_PRIMARY } from "@/components/buttons";

/** A page that threw while showing: the brand's error line and a way back in, never a blank screen. */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-page-error>
      <p className="text-base text-neutral-200">Something went wrong.</p>
      <button type="button" onClick={reset} className={BUTTON_PRIMARY}>
        Try again
      </button>
    </div>
  );
}
