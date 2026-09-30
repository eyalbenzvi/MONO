/**
 * What the page needs to judge a converted print, worked out where it was
 * converted (the upload worker, off the main thread): the ink for each tee
 * ("Bolder" applied to line work), its measures on each tee, the design hash
 * for the near-copy check, and the features on each tee. Pure: typed arrays
 * in, plain data out.
 */
import { OUT_H, OUT_W, inkFor, meshMasses, type Converted, type Tee } from "./convert";
import { features } from "./features";
import { designHash, measure, type Measures } from "./measure";
import type { FeatureVector } from "@/types/shirt";

export interface Analysis {
  inks: Record<Tee, Uint8Array>;
  measures: Record<Tee, Measures>;
  /** The white tee's ink, hashed (lib/upload/measure designHash). */
  hash: string;
  features: Record<Tee, FeatureVector>;
}

/** "Bolder": line work one pixel thicker all round (about 0.2 mm each side). */
export function bolden(ink: Uint8Array, w = OUT_W, h = OUT_H): Uint8Array {
  const out = new Uint8Array(ink.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
        }
    }
  return out;
}

export function analyse(conv: Converted, { bolder }: { bolder: boolean }): Analysis {
  const inks: Record<Tee, Uint8Array> = { black: inkFor(conv, "black"), white: inkFor(conv, "white") };
  if (bolder && conv.mode !== "dots") {
    const same = inks.black === inks.white;
    inks.black = bolden(inks.black, conv.w, conv.h);
    inks.white = same ? inks.black : bolden(inks.white, conv.w, conv.h);
  }
  // Line work's solid areas print as a mesh (never a slab); its strokes and gaps are measured on the shapes as drawn.
  let shapes: Uint8Array | undefined;
  if (conv.mode !== "dots") {
    const meshed = meshMasses(inks.white);
    if (meshed !== inks.white) (shapes = inks.white), (inks.white = inks.black = meshed);
  }
  const on = (t: Tee) => measure(inks[t], conv.w, conv.h, t, { screened: conv.mode === "dots", size: conv.size, shapes });
  const measures = { black: on("black"), white: on("white") };
  return {
    inks,
    measures,
    hash: designHash(inks.white, conv.w, conv.h),
    features: { black: features(conv, measures.black), white: features(conv, measures.white) },
  };
}
