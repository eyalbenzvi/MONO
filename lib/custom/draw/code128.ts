/**
 * Code 128, our own encoder: the symbol set's bar and space widths (each
 * symbol eleven modules, the stop thirteen), code set C for an even run of
 * figures (two to a symbol) and code set B for everything else printable, the
 * weighted modulo-103 check, and the bars as rectangles.
 */
import { INK, f1 } from "../kit";

/** Each symbol's widths: bar, space, bar, space, bar, space (the stop has a last bar). */
export const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;
export const START_B = 104, START_C = 105, STOP = 106;

/** The symbol values for a text: all figures (an even count) in code set C, else code set B (printable ASCII only); null when it can't be encoded. */
export function code128Values(s: string): number[] | null {
  if (!s) return null;
  let vals: number[];
  if (/^(\d\d)+$/.test(s)) vals = [START_C, ...(s.match(/\d\d/g) as string[]).map(Number)];
  else if (/^[\x20-\x7e]+$/.test(s)) vals = [START_B, ...[...s].map((c) => c.charCodeAt(0) - 32)];
  else return null;
  const check = vals.reduce((a, v, i) => a + v * (i || 1), 0) % 103;
  return [...vals, check, STOP];
}

/** The widths in modules, bar first, alternating: the whole symbol. */
export const code128Modules = (vals: number[]) => vals.flatMap((v) => [...PATTERNS[v]].map(Number));

/** The barcode as filled bars: x, y, the module width and the height. */
export function code128Bars(s: string, x: number, y: number, module: number, h: number): { svg: string; width: number } | null {
  const vals = code128Values(s);
  if (!vals) return null;
  let d = "";
  let at = x;
  code128Modules(vals).forEach((m, i) => {
    if (i % 2 === 0) d += `M${f1(at)} ${f1(y)}h${f1(m * module)}v${f1(h)}h${f1(-m * module)}z`;
    at += m * module;
  });
  return { svg: `<path d="${d}" fill="${INK}"/>`, width: at - x };
}
