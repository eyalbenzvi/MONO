type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { box: string; text: string }> = {
  sm: { box: "h-10 w-10 rounded-md", text: "text-[9px]" },
  md: { box: "h-16 w-16 rounded-lg", text: "text-sm" },
  lg: { box: "h-28 w-28 rounded-xl", text: "text-2xl" },
};

/** MONO brand mark: a black square with "MONO" in bold white caps. */
export function MonoLogo({ size = "md", className = "" }: { size?: LogoSize; className?: string }) {
  const s = SIZES[size];
  return (
    <span
      role="img"
      aria-label="MONO"
      className={`inline-flex shrink-0 select-none items-center justify-center bg-black ring-1 ring-white/20 ${s.box} ${className}`}
    >
      {/* tracking adds trailing space after the last letter; pad the left to keep it optically centred */}
      <span className={`pl-[0.1em] font-black uppercase leading-none tracking-widest text-white ${s.text}`} aria-hidden>
        MONO
      </span>
    </span>
  );
}
