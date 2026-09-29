/**
 * What one Make product's print carries over to another (the product
 * page's "Also from a date: …" links): the date (or its year), the city,
 * the words, a name. The target keeps its own example for everything else,
 * and the result is validated as any link is; null when nothing fits.
 */
import type { MadeProduct } from "./products";
import { ASCII_MAX, asciiProblem, validate, type City, type CustomSpec } from "./spec";

const dateOf = (s: CustomSpec): string | undefined => ("d" in s.p && typeof s.p.d === "string" ? s.p.d : undefined);
const yearOf = (s: CustomSpec): number | undefined => (s.t === "moon" ? s.p.y : dateOf(s) ? Number(dateOf(s)!.slice(0, 4)) : undefined);
const wordsOf = (s: CustomSpec): string | undefined => ("w" in s.p && typeof s.p.w === "string" ? s.p.w : undefined);
/** A name as the ASCII product's lines (up to ASCII_MAX a line, two lines), or null. */
function asciiOf(x: string): string[] | null {
  const t = x.toUpperCase().trim();
  if (t.length <= ASCII_MAX) return [t];
  const i = t.lastIndexOf(" ", ASCII_MAX);
  const lines = i > 0 ? [t.slice(0, i), t.slice(i + 1)] : null;
  return lines && lines.every((l) => l.length <= ASCII_MAX) ? lines : null;
}

export function carry(from: CustomSpec, to: MadeProduct, city?: City): CustomSpec | null {
  const target = JSON.parse(JSON.stringify(to.example)) as { t: string; v: 1; p: Record<string, unknown> };
  const p = target.p;
  const d = dateOf(from), y = yearOf(from), w = wordsOf(from);
  if (d && (to.template === "sky" || to.template === "night" || to.template === "planets" || to.template === "place")) p.d = d;
  else if (y !== undefined && "d" in p && typeof p.d === "string") p.d = `${y}${(p.d as string).slice(4)}`;
  if (to.template === "moon" && y !== undefined) p.y = y;
  if (w && to.template !== "code" && to.template !== "number" && to.template !== "taste") p.w = w;
  // The place: a city goes to the sky and the globe.
  const c = (from.t === "sky" ? from.p.c : from.t === "place" ? from.p.c : undefined) ?? city?.id;
  if (to.template === "sky" && c !== undefined) p.c = c;
  if (to.template === "place" && city) Object.assign(p, { la: Math.round(city.lat * 100) / 100, lo: Math.round(city.lon * 100) / 100, c: city.id });
  // A name: the code's letters as big ASCII letters, and back.
  if (from.t === "code" && to.template === "ascii") {
    const lines = asciiOf(from.p.x);
    if (lines && lines.every((l) => !asciiProblem(l))) p.x = lines;
  }
  if (from.t === "ascii" && to.template === "code") p.x = from.p.x.join(" ");
  if (JSON.stringify(target) === JSON.stringify(to.example)) return null;
  return validate(target);
}
