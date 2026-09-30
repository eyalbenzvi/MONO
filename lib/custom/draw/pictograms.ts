/**
 * Twelve pictograms for a warning sign, drawn in code as line work in a
 * 100 × 100 box (heavy strokes, as a sign's are; no filled ground): a mug, a
 * bed, a phone, an iron, a grill, a ball, a book, a wheel, headphones, a pram,
 * a dog, a keyboard. `pictogram` scales one into place.
 */
import { INK, f1 } from "../kit";

export const PICTOGRAMS = ["mug", "bed", "phone", "iron", "grill", "ball", "book", "wheel", "headphones", "pram", "dog", "keyboard"] as const;
export type Pictogram = (typeof PICTOGRAMS)[number];

/** The pictograms' names as the editor and the caption say them. */
export const PICTOGRAM_NAMES: Record<Pictogram, string> = {
  mug: "Mug", bed: "Bed", phone: "Phone", iron: "Iron", grill: "Grill", ball: "Ball",
  book: "Book", wheel: "Steering wheel", headphones: "Headphones", pram: "Pram", dog: "Dog", keyboard: "Keyboard",
};

/** Circles in the box, as path data (two arcs each). */
const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Each pictogram's path data in the 100 box. */
const PATHS: Record<Pictogram, string> = {
  mug: "M24 38V72Q24 84 36 84H54Q66 84 66 72V38ZM66 46Q82 46 82 58Q82 70 66 70M34 30Q30 23 34 16Q38 9 34 2M46 30Q42 23 46 16Q50 9 46 2M58 30Q54 23 58 16Q62 9 58 2",
  bed: "M10 26V82M10 62H90V82M10 72H90M18 54Q18 44 28 44H36Q44 44 44 52V62M50 62V52Q50 46 58 46H84Q90 46 90 54V62",
  phone: `M40 10H60Q68 10 68 18V82Q68 90 60 90H40Q32 90 32 82V18Q32 10 40 10ZM37 20H63V72H37ZM45 15H55${ring(50, 81, 3.5)}`,
  iron: "M12 74H88Q88 50 64 46H40Q20 50 12 74ZM40 46Q40 28 56 28H72Q80 28 80 36V46M30 84V90M50 84V94M70 84V90M24 64H80",
  grill: "M18 48H82Q82 78 50 78Q18 78 18 48ZM22 48Q22 26 50 26Q78 26 78 48M44 22H56M50 26V22M36 78L26 96M64 78L74 96M50 78V96M30 58H70M34 66H66",
  ball: `${ring(50, 50, 34)}M50 36L63 45L58 60H42L37 45ZM50 36V16M63 45L82 39M58 60L70 77M42 60L30 77M37 45L18 39`,
  book: "M50 26Q34 18 10 22V78Q34 74 50 82Q66 74 90 78V22Q66 18 50 26ZM50 26V82M18 34Q30 32 42 36M18 46Q30 44 42 48M18 58Q30 56 42 60M58 36Q70 32 82 34M58 48Q70 44 82 46M58 60Q70 56 82 58",
  wheel: `${ring(50, 50, 36)}${ring(50, 50, 28)}${ring(50, 52, 9)}M22 44Q36 40 42 48M78 44Q64 40 58 48M50 61V78`,
  headphones: "M22 62Q22 18 50 18Q78 18 78 62M14 54H28V86H14ZM72 54H86V86H72ZM18 60V80M82 60V80",
  pram: `M18 48H74Q74 72 50 72H40Q18 72 18 48ZM18 48Q18 24 44 24V48M74 48L84 32H94M30 72L36 80M62 72L56 80${ring(34, 86, 8)}${ring(62, 86, 8)}`,
  dog: "M20 46H62Q70 46 70 54V62H20ZM20 46Q14 40 10 32M26 62V88M36 62V88M56 62V88M66 62V88M62 46L66 30L72 22H82L90 30L84 38H74L70 46M74 22L72 12L80 20",
  keyboard: "M8 32H92V72H8ZM16 40H22M28 40H34M40 40H46M52 40H58M64 40H70M76 40H84M16 50H22M28 50H34M40 50H46M52 50H58M64 50H70M76 50H84M30 62H70M16 62H22M78 62H84",
};

/** A pictogram, `size` wide, centred at (cx, cy), in strokes `weight` (in the 100 box's units) wide. */
export function pictogram(name: Pictogram, cx: number, cy: number, size: number, weight = 5): string {
  const k = size / 100;
  const d = PATHS[name].replace(/([MLHVQAZa-z])([^MLHVQAZa-z]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    // Absolute commands move into place; relative arcs (the rings) only scale.
    if (cmd === "H") return `H${f1(cx + (nums[0] - 50) * k)}`;
    if (cmd === "V") return `V${f1(cy + (nums[0] - 50) * k)}`;
    if (cmd === "a") return `a${nums.map((v, i) => (i >= 2 && i <= 4 ? String(v) : f1(v * k))).join(" ")}`;
    if (cmd === "Z") return "Z";
    return cmd + nums.map((v, i) => f1(i % 2 ? cy + (v - 50) * k : cx + (v - 50) * k)).join(" ");
  });
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f1(weight * k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
