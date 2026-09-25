/**
 * Landmark silhouettes in a 100×100 box (baseline y≈96), drawn from scratch.
 * Same conventions as art.ts OBJECTS / drawPrims: the first closed shape is
 * the silhouette (filled in "solid" style); later closed shapes are detail
 * lines (cut out of the silhouette in "solid", inked in "line"/"woodcut").
 */
import type { Prim } from "../art";

const sil = (d: string): Prim => ({ d, closed: true });
/** Detail line: closed so it shows as a cut-out on solid silhouettes. */
const cut = (d: string): Prim => ({ d: d.includes("Z") ? d : `${d} Z`, closed: true });
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;

function arches(x0: number, y: number, w: number, n: number, h: number) {
  let d = "";
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step + step * 0.2;
    const aw = step * 0.6;
    d += `M${x.toFixed(1)} ${y} V${(y - h + aw / 2).toFixed(1)} Q${(x + aw / 2).toFixed(1)} ${(y - h - aw * 0.3).toFixed(1)} ${(x + aw).toFixed(1)} ${(y - h + aw / 2).toFixed(1)} V${y} Z `;
  }
  return d;
}

function moaiHead(ox: number, s: number) {
  const p = (x: number, y: number) => `${(ox + x * s).toFixed(1)} ${(96 - (96 - y) * s).toFixed(1)}`;
  return `M${p(2, 96)} L${p(4, 42)} Q${p(4, 22)} ${p(16, 20)} L${p(23, 22)} Q${p(27, 28)} ${p(25, 33)} L${p(30, 47)} L${p(24, 49)} L${p(25, 55)} L${p(29, 58)} L${p(24, 61)} L${p(25, 67)} Q${p(23, 71)} ${p(18, 71)} L${p(18, 96)} Z`;
}

export const LANDMARKS: Record<string, { prims: Prim[]; tilt?: number }> = {
  eiffel: {
    prims: [
      sil("M14 96 Q34 70 41 46 L46 18 L48.5 4 L51.5 4 L54 18 L59 46 Q66 70 86 96 L70 96 Q50 72 30 96 Z M27 68 H73 V72 H27 Z M38 44 H62 V47.5 H38 Z M46.5 18 H53.5 V20 H46.5 Z"),
      cut("M33 82 L58 50 M67 82 L42 50"),
      cut("M42 44 L52 21 M58 44 L48 21"),
      cut("M29 72 H71"),
    ],
  },
  liberty: {
    prims: [
      sil(
        "M32 96 H68 V90 H64 V72 H66 V68 H34 V72 H36 V90 H32 Z M40 68 L42 44 Q44 36 48 34 L54 34 Q58 36 59 44 L61 68 Z " +
          circ(50.5, 29, 4.6) +
          " M44.5 26 L40.5 21 L46.5 24 L47.5 18 L50 24 L52 17 L53 24 L56 18.5 L55.8 25 L60.5 22 L56.5 27 Z M55 37 L58.5 14 L61.5 14 L60 38 Z M56.5 14 H63.5 L62.5 10 H57.5 Z M60 10 Q56.5 6 60 1 Q63.5 6 60 10 Z M36 46 L42 44 L44 54 L38 56 Z",
      ),
      cut("M46 44 L45 66 M51 40 L51 66 M56 44 L57 66"),
      cut("M36 76 H64 M38 84 H62"),
      cut("M41 80 H46 V88 H41 Z M54 80 H59 V88 H54 Z"),
    ],
  },
  pisa: {
    tilt: -5,
    prims: [
      sil("M36 94 H64 V20 H36 Z M33 96 H67 V90 H33 Z M38 20 H62 V9 H38 Z M40 9 H60 V5 H40 Z M34.5 82 H65.5 V80 H34.5 Z M34.5 70 H65.5 V68 H34.5 Z M34.5 58 H65.5 V56 H34.5 Z M34.5 46 H65.5 V44 H34.5 Z M34.5 34 H65.5 V32 H34.5 Z M34.5 22 H65.5 V20 H34.5 Z"),
      cut(arches(36, 90, 28, 5, 6)),
      cut(arches(36, 79, 28, 6, 6) + arches(36, 67, 28, 6, 6) + arches(36, 55, 28, 6, 6) + arches(36, 43, 28, 6, 6) + arches(36, 31, 28, 6, 6)),
      cut(arches(38, 19, 24, 4, 5)),
    ],
  },
  bigben: {
    prims: [
      sil("M42 96 V30 H58 V96 Z M38 96 H62 V90 H38 Z M40 42 H60 V26 H40 Z M42 26 H58 V18 H42 Z M41 18 L50 2 L59 18 Z M39.5 26 L41 19 L42.5 26 Z M57.5 26 L59 19 L60.5 26 Z"),
      cut(circ(50, 34, 6.5)),
      cut("M50 34 L50 29.5 M50 34 L53.5 35.5"),
      cut("M46 46 V86 M50 46 V86 M54 46 V86"),
      cut("M42 60 H58 M42 74 H58 M45 22 V18 M50 22 V18 M55 22 V18"),
    ],
  },
  taj: {
    prims: [
      sil(
        "M6 96 H94 V90 H6 Z M26 90 V58 H74 V90 Z M36 58 Q30 44 42 36 Q48 32 50 24 Q52 32 58 36 Q70 44 64 58 Z M49.3 24 V17 H50.7 V24 Z M28 58 Q28 50 32 50 Q36 50 36 58 Z M64 58 Q64 50 68 50 Q72 50 72 58 Z M10 90 V44 H14 V90 Z M86 90 V44 H90 V90 Z M9 44 L12 37 L15 44 Z M85 44 L88 37 L91 44 Z",
      ),
      cut("M44 90 V72 Q50 62 56 72 V90"),
      cut("M29 88 V76 Q32 71 35 76 V88 M65 88 V76 Q68 71 71 76 V88"),
      cut("M29 70 V64 Q32 60 35 64 V70 M65 70 V64 Q68 60 71 64 V70"),
      cut("M10 60 H14 M10 75 H14 M86 60 H90 M86 75 H90"),
    ],
  },
  pyramids: {
    prims: [
      sil("M2 96 L32 48 L62 96 Z M44 96 L68 60 L92 96 Z M76 96 L87 79 L98 96 Z"),
      cut("M32 48 L40 96"),
      cut("M68 60 L74 96"),
      cut("M87 79 L90 96"),
      cut("M20 78 H44 M14 86 H50"),
    ],
  },
  moai: {
    prims: [
      sil(`${moaiHead(4, 1)} ${moaiHead(38, 0.86)} ${moaiHead(68, 0.74)}`),
      cut("M14 36 Q17 44 12 52 M47 43 Q50 50 46 57 M75 49 Q78 55 74 61"),
      cut("M18 32 L26 33 M50 39 L57 40 M78 46 L84 47"),
    ],
  },
  stonehenge: {
    prims: [
      sil("M6 96 V56 H18 V96 Z M22 96 V56 H34 V96 Z M4 56 V48 H36 V56 Z M46 96 V50 H56 V96 Z M60 96 V50 H70 V96 Z M44 50 V43 H72 V50 Z M80 96 V64 H92 V96 Z M38 96 V82 H44 V96 Z M1 96 H99 V98 H1 Z"),
      cut("M10 60 V92 M28 62 V90 M50 56 V92 M65 56 V90 M86 68 V92"),
      cut("M8 52 H32 M48 46.5 H68"),
    ],
  },
  colosseum: {
    prims: [
      sil("M4 92 V36 Q40 26 70 30 L73 42 L80 42 L82 54 L96 54 V92 Z"),
      cut("M4 50 Q50 42 96 56 M4 66 Q50 60 96 68 M4 80 H96"),
      cut(arches(6, 79, 88, 9, 9)),
      cut(arches(6, 65, 88, 9, 8)),
      cut(arches(6, 49, 64, 7, 7)),
    ],
  },
  lighthouse: {
    prims: [
      sil("M40 92 L44 40 H56 L60 92 Z M39 40 H61 V36.5 H39 Z M44 36.5 V27 H56 V36.5 Z M42 27 L50 19 L58 27 Z M49 19 V15.5 H51 V19 Z M26 96 Q34 86 42 89 L58 89 Q66 86 74 96 Z"),
      cut("M43.2 52 H56.8 M42.4 64 H57.6 M41.6 76 H58.4"),
      cut("M47 36.5 V27 M53 36.5 V27"),
      cut("M47 92 V82 Q50 79 53 82 V92"),
    ],
  },
};

export const LANDMARK_KEYS = Object.keys(LANDMARKS);
