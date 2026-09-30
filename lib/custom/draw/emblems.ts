/**
 * Ten emblems for a mission patch, drawn in code as line work in a 100 × 100
 * box (draw/pictograms boxPath): a rocket, an orbit, a mountain, a wave, a
 * tent, a plane, a house, a star, a compass, a boat.
 */
import { boxPath } from "./pictograms";

export const EMBLEMS = ["rocket", "orbit", "mountain", "wave", "tent", "plane", "house", "star", "compass", "boat"] as const;
export type Emblem = (typeof EMBLEMS)[number];
export const EMBLEM_NAMES: Record<Emblem, string> = { rocket: "Rocket", orbit: "Orbit", mountain: "Mountain", wave: "Wave", tent: "Tent", plane: "Plane", house: "House", star: "Star", compass: "Compass", boat: "Boat" };

const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PATHS: Record<Emblem, string> = {
  rocket: `M50 6Q68 24 68 52V74H32V52Q32 24 50 6Z${ring(50, 38, 8)}M32 56L18 76V86L32 76M68 56L82 76V86L68 76M50 74V90M42 74Q43 88 50 96Q57 88 58 74M32 64H68`,
  orbit: `${ring(50, 50, 15)}M8 50A42 16 0 1 0 92 50A42 16 0 1 0 8 50M36 44H64M38 56H62${ring(86, 44, 3.5)}M16 16L20 20M20 16L16 20M82 82L86 86M86 82L82 86`,
  mountain: `M6 84L38 30L50 50L64 34L94 84ZM30 44L38 30L46 44L42 48L38 44L34 48ZM58 42L64 34L70 42${ring(80, 18, 7)}M6 90H94`,
  wave: "M6 56Q18 40 30 56Q42 72 54 56Q66 40 78 56Q86 66 94 58M6 72Q18 56 30 72Q42 88 54 72Q66 56 78 72Q86 82 94 74M54 56Q52 30 72 26Q84 26 84 38Q84 46 74 46Q68 46 68 40",
  tent: `M50 16L12 84H88ZM50 16V84M40 84L50 58L60 84M6 84H94${ring(80, 22, 4)}M22 20L26 24M26 20L22 24`,
  plane: "M50 8Q56 8 56 18V40L92 56V64L56 54V78L68 86V92L50 88L32 92V86L44 78V54L8 64V56L44 40V18Q44 8 50 8Z",
  house: "M14 48L50 16L86 48M24 40V86H76V40M44 86V62H56V86M30 50H40V60H30ZM60 50H70V60H60ZM64 26V18H72V32M8 86H92",
  star: "M50 8L60 38H92L66 56L76 88L50 68L24 88L34 56L8 38H40ZM50 24L55 42H72L58 52L63 70L50 60L37 70L42 52L28 42H45Z",
  compass: `${ring(50, 50, 38)}${ring(50, 50, 30)}M50 18L58 50L50 82L42 50ZM18 50L50 44L82 50L50 56ZM50 12V18M50 82V88M12 50H18M82 50H88`,
  boat: "M14 66H86L74 82H26ZM50 66V12M52 14L80 60H52ZM48 22L22 60H48ZM6 88Q14 82 22 88Q30 94 38 88Q46 82 54 88Q62 94 70 88Q78 82 86 88Q90 91 94 88",
};

/** An emblem, `size` wide, centred at (cx, cy). */
export const emblem = (name: Emblem, cx: number, cy: number, size: number, weight = 4) => boxPath(PATHS[name], cx, cy, size, weight);
