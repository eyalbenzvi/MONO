/**
 * Garment geometry shared by the on-screen mockup (TeeMockup), the share
 * image drawn in the browser (lib/shareImage) and the link-preview images
 * rendered at build time (scripts/generateOgImages).
 *
 * Coordinates live in a 400×460 design space; VIEW crops the empty margins.
 * The 3:4 print rectangle sits centred in the upper body.
 */
export const TEE_VIEW = { x: 30, y: 10, w: 340, h: 440 };
// A real back print is about half the chest wide, just below the collar (not a panel).
export const TEE_PRINT = { x: 150, y: 76, w: 100, h: (100 * 4) / 3 };
export const TEE_BODY =
  "M150 24 Q200 36 250 24 L302 38 Q338 52 378 118 L336 164 L306 146 L308 432 Q200 442 92 432 L94 146 L64 164 L22 118 Q62 52 98 38 Z";
export const TEE_SEAMS = "M98 38 Q113 92 94 146 M302 38 Q287 92 306 146";
export const TEE_HEMS = "M28 126 L68 158 M372 126 L332 158 M94 422 Q200 432 306 422";
export const TEE_COLLAR = "M150 24 Q200 36 250 24";

/** Fabric, seam and collar colours per tee colour. */
export const TEE_COLORS = {
  black: { fabric: "#161616", seam: "rgba(255,255,255,0.09)", collar: "#0d0d0d" },
  white: { fabric: "#f3f3f1", seam: "rgba(0,0,0,0.12)", collar: "#e6e6e3" },
} as const;
