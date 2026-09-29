"use client";

/** A page that threw while showing: the brand's error line and a way back in, never a blank screen. */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-page-error>
      <p className="text-base text-neutral-200">That didn&rsquo;t load. Try again.</p>
      <button type="button" onClick={reset} className="h-11 rounded-full bg-white px-6 text-sm font-bold text-black">
        Try again
      </button>
    </div>
  );
}
