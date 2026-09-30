/** The MONO wordmark: the brand face, capitals, wide tracking; no box, no ring. */
export function MonoLogo({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="MONO" className={`select-none font-medium uppercase leading-none tracking-[0.3em] text-white ${className}`}>
      {/* The tracking trails the last letter; the same space before the first keeps it centred. */}
      <span aria-hidden className="pl-[0.3em] text-[17px]">
        MONO
      </span>
    </span>
  );
}
