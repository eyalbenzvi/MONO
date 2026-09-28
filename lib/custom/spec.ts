/**
 * A personalised print's spec ("Make it yours"): which template, and the
 * customer's inputs. Small, strict and versioned: it travels in a shared link
 * (`?make=`) and in the bag line, and nowhere else. This module is what the
 * bag and the product page need on every load (validation, hashing, links);
 * drawing the print lives in lib/custom (index), loaded when one is shown.
 */
import type { ShirtProduct } from "@/types/shirt";

export type TemplateId = "sky" | "moon" | "night" | "planets";
/** The customer's own words, the print's first line (optional, WORDS_MAX characters of the print font's script). */
interface Words {
  w?: string;
}
/** Your Night Sky: stable city id, "YYYY-MM-DD", optional "HH:MM" (local). */
export interface SkyParams extends Words {
  c: number;
  d: string;
  t?: string;
}
/** Your Year of Moons: the year, and `s: 1` for the view from the south. */
export interface MoonParams extends Words {
  y: number;
  s?: 1;
}
/** Your Moon: the night ("YYYY-MM-DD"), and `s: 1` for the view from the south. */
export interface NightParams extends Words {
  d: string;
  s?: 1;
}
/** Your Planets: the day ("YYYY-MM-DD", within the planets' elements: to 2050). */
export interface PlanetsParams extends Words {
  d: string;
}
export type CustomSpec =
  | { t: "sky"; v: 1; p: SkyParams }
  | { t: "moon"; v: 1; p: MoonParams }
  | { t: "night"; v: 1; p: NightParams }
  | { t: "planets"; v: 1; p: PlanetsParams };

/** A city of the place list (data/cities). */
export interface City {
  id: number;
  name: string;
  ascii: string;
  country: string;
  lat: number;
  lon: number;
  pop: number;
  tz: string;
}

/**
 * The made-for-you products (lib/custom/products): each is one template, and
 * its variant names it. Regular designs aren't personalised; the ones a
 * template comes from link to it (madeFor).
 */
const TEMPLATES: Record<string, TemplateId> = { "make-sky": "sky", "make-moon": "night", "make-year": "moon", "make-planets": "planets" };
/** The template a product is made with (by its variant), or null. */
export const templateFor = (shirt: Pick<ShirtProduct, "variant">): TemplateId | null => TEMPLATES[shirt.variant] ?? null;

export const FIRST_YEAR = 1900;
export const LAST_YEAR = 2100;
/** The planets' orbital elements hold to 2050 (JPL, Standish). */
export const PLANETS_LAST_YEAR = 2050;
export const WORDS_MAX = 28;
/** Letters of the print font's script, digits, and a few marks. */
const WORDS = /^[\p{Script=Latin}0-9 .,'’&:!?·()-]+$/u;
/** The words as they print: spaces collapsed, trimmed; null when there's nothing, too much, or a character the print can't set. */
export function cleanWords(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const w = s.replace(/\s+/g, " ").trim();
  return w && w.length <= WORDS_MAX && WORDS.test(w) ? w : null;
}
/** No time given: the evening of that day. */
export const DEFAULT_TIME = "22:00";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A real calendar date in range, as [y, mo, d]. */
export function parseDate(s: unknown): [number, number, number] | null {
  const m = typeof s === "string" ? DATE.exec(s) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < FIRST_YEAR || y > LAST_YEAR || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return [y, mo, d];
}
export const parseTime = (s: unknown): [number, number] | null => {
  const m = typeof s === "string" ? TIME.exec(s) : null;
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/**
 * A spec, strictly: known template and version, every field's type and range,
 * a real date, and (when the city list is given) a known city. Unknown keys
 * are dropped. Anything else is null.
 */
export function validate(spec: unknown, cityById?: (id: number) => City | undefined): CustomSpec | null {
  if (!isObj(spec) || spec.v !== 1 || !isObj(spec.p)) return null;
  const p = spec.p;
  let words: Words = {};
  if (p.w !== undefined) {
    const w = cleanWords(p.w);
    if (!w) return null;
    words = { w };
  }
  const south = p.s === undefined ? {} : p.s === 1 ? { s: 1 as const } : null;
  if (spec.t === "sky") {
    if (typeof p.c !== "number" || !Number.isInteger(p.c) || p.c <= 0 || p.c > 0xffffffff) return null;
    if (cityById && !cityById(p.c)) return null;
    if (!parseDate(p.d)) return null;
    if (p.t !== undefined && !parseTime(p.t)) return null;
    return { t: "sky", v: 1, p: { c: p.c, d: p.d as string, ...(p.t !== undefined ? { t: p.t as string } : {}), ...words } };
  }
  if (spec.t === "moon") {
    if (typeof p.y !== "number" || !Number.isInteger(p.y) || p.y < FIRST_YEAR || p.y > LAST_YEAR || !south) return null;
    return { t: "moon", v: 1, p: { y: p.y, ...south, ...words } };
  }
  if (spec.t === "night") {
    if (!parseDate(p.d) || !south) return null;
    return { t: "night", v: 1, p: { d: p.d as string, ...south, ...words } };
  }
  if (spec.t === "planets") {
    const d = parseDate(p.d);
    if (!d || d[0] > PLANETS_LAST_YEAR) return null;
    return { t: "planets", v: 1, p: { d: p.d as string, ...words } };
  }
  return null;
}

/** The spec as canonical JSON (keys in a fixed order): the same spec is always the same string. */
export const canonical = (spec: CustomSpec) => JSON.stringify(validate(spec));

/** A short stable hash of the spec (bag line keys). FNV-1a, 32 bits, base 36. */
export function specHash(spec: CustomSpec): string {
  let h = 0x811c9dc5;
  for (const ch of canonical(spec)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(36);
}

// UTF-8 inside base64 (words may carry accents): btoa takes one byte per character.
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** The spec for a link (`?make=`): base64url of its canonical JSON. */
export const encodeMake = (spec: CustomSpec) => b64url(canonical(spec));
/** A link's spec, validated; anything malformed is null. */
export function decodeMake(s: unknown, cityById?: (id: number) => City | undefined): CustomSpec | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(s)) return null;
  try {
    return validate(JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))), cityById);
  } catch {
    return null;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The spec's day as the prints write it ("14 March 1991"), or its year. */
export function customDay(spec: CustomSpec): string {
  if (spec.t === "moon") return String(spec.p.y);
  const [y, mo, d] = parseDate(spec.p.d)!;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

/** The products' names (lib/custom/products), by template. */
export const PRODUCT_NAMES: Record<TemplateId, string> = { sky: "Your Night Sky", night: "Your Moon", moon: "Your Year of Moons", planets: "Your Planets" };

/** A made-for-you tee's title, in the bag and the confirmation: the product and its day (or year). */
export const customTitle = (spec: CustomSpec) => `${PRODUCT_NAMES[spec.t]} · ${customDay(spec)}`;
