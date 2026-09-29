/**
 * The moon on one night, large: its lit part as a field of halftone dots (so
 * even a full moon prints as a mesh of ink, never a solid disc), the dark part
 * as the same screen in fine dots, and the phase named under it. Seen
 * from the north the waxing moon is lit on the right; from the south the
 * lit side is the other one.
 */
import { moonPhase } from "../astro";
import { caption, circle, dot } from "../kit";

export interface NightInput {
  /** The moment, as a Julian date (UT). */
  jd: number;
  south?: boolean;
  caption: { title?: string; sub?: string; sub2?: string };
}

/** The phase's everyday name ("Waxing gibbous"), from its illuminated fraction and direction. */
export function phaseName(k: number, waxing: boolean): string {
  if (k < 0.03) return "New moon";
  if (k > 0.97) return "Full moon";
  if (Math.abs(k - 0.5) < 0.04) return waxing ? "First quarter" : "Last quarter";
  return `${waxing ? "Waxing" : "Waning"} ${k < 0.5 ? "crescent" : "gibbous"}`;
}

const CX = 150, CY = 150, R = 104;
/** The dot screen: spacing and dot radius (a quarter of the lit area in ink). */
const STEP = 4.6, DOT = 1.25, DUST = 0.85;

/** The phase, and whether a point (relative to the centre, y down) is on the lit part. */
export function litTest(k: number, waxing: boolean, south: boolean) {
  const rx = Math.abs(1 - 2 * k) * R;
  // Lit on the right when waxing seen from the north; mirrored otherwise.
  const right = waxing !== south;
  return (x: number, y: number) => {
    if (x * x + y * y > R * R) return false;
    const sx = right ? x : -x;
    const t = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (R * R)));
    // A crescent is lit beyond the terminator; a gibbous moon from the terminator on the far side.
    return k < 0.5 ? sx > t : sx > -t;
  };
}

export function nightBody({ jd, south = false, caption: c }: NightInput): string {
  const { k, waxing } = moonPhase(jd);
  const lit = litTest(k, waxing, south);
  let body = circle(CX, CY, R, 1.1);
  // One hexagonal screen over the disc: full dots on the lit part, fine ones on the dark part (a new moon still reads as the moon).
  for (let row = 0, y = -R; y <= R; row++, y += STEP * 0.866) {
    for (let x = -R + (row % 2 ? STEP / 2 : 0); x <= R; x += STEP) {
      if (x * x + y * y > (R - 1.6) * (R - 1.6)) continue;
      if (lit(x, y)) body += dot(CX + x, CY + y, DOT);
      else body += dot(CX + x, CY + y, DUST);
    }
  }
  return body + caption(318, c.title, c.sub, c.sub2);
}
