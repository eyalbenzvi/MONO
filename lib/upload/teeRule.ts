/**
 * Which tee an upload goes on, whether the other is offered, and the one
 * line that says why (brief 6.3).
 * - Line work (line, vector, words, a photograph as Lines) keeps its
 *   polarity: dark marks on light go on white in black ink; on a black tee
 *   the same shapes print in white ink ("Black swaps the inks"). The other
 *   tee is offered when the print passes there too (a black tee asks for
 *   thicker lines).
 * - A photograph as Dots is never inverted: a black tee's white ink draws
 *   its lights, a white tee's black ink its darks, two different screens.
 *   Each is scored with assessPrint; the higher goes first, and the other
 *   is offered only if it scores at least WEAK_QUALITY, has no flags and
 *   is within OTHER_WITHIN points.
 */
import { WEAK_QUALITY } from "@/lib/custom/quality";
import type { Converted, Tee } from "./convert";
import { tier, type Measures } from "./measure";

/** The other tee of a photograph is offered within this many points of the first. */
export const OTHER_WITHIN = 12;

export const TEE_LINES = {
  photoBlack: "A light picture, so black: the ink draws its lights.",
  photoWhite: "A dark picture, so white: the ink draws its darks.",
  darkOnLight: "Drawn in dark on light, so white. Black swaps the inks.",
  lightOnDark: "Drawn in light on dark, so black. White swaps the inks.",
} as const;

const flip = (t: Tee): Tee => (t === "black" ? "white" : "black");

export function chooseTee(conv: Converted, scoreOn: (tee: Tee) => Measures): { tee: Tee; other: boolean; line: string } {
  if (conv.tone) {
    const [b, w] = [scoreOn("black"), scoreOn("white")];
    // A tie goes to the picture's own side: a dark picture on white.
    const tee: Tee = b.quality > w.quality || (b.quality === w.quality && !conv.darkOnLight) ? "black" : "white";
    const [first, second] = tee === "black" ? [b, w] : [w, b];
    const other = second.quality >= WEAK_QUALITY && second.flags.length === 0 && first.quality - second.quality <= OTHER_WITHIN;
    return { tee, other, line: tee === "black" ? TEE_LINES.photoBlack : TEE_LINES.photoWhite };
  }
  const tee: Tee = conv.darkOnLight ? "white" : "black";
  const other = tier(scoreOn(flip(tee)), flip(tee)).tier !== "refuse";
  return { tee, other, line: conv.darkOnLight ? TEE_LINES.darkOnLight : TEE_LINES.lightOnDark };
}
