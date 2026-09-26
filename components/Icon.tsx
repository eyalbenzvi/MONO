import type { SVGProps } from "react";
import type { IconName } from "@/lib/icons";

const SPRITE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons.svg`;

/**
 * An icon from the sprite (public/icons.svg): a short <use> reference, the
 * same size and stroke as lucide's components. Stroke width and fill (e.g.
 * `fill-current` for a solid heart) are inherited by the symbol's paths.
 */
export function Icon({ name, className = "", strokeWidth = 2, ...rest }: { name: IconName; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  // Decorative unless given a label.
  const labelled = !!rest["aria-label"];
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      className={`lucide shrink-0 ${className}`}
      {...rest}
    >
      <use href={`${SPRITE}#${name}`} />
    </svg>
  );
}
