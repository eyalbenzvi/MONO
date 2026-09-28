/**
 * Personalised prints ("Make it yours"): a customer's own inputs for two of
 * the computed templates, the night sky over a city on a date (`sky`, from the
 * Night Sky designs) and the moon's phases for a year (`moon`, from the Moon
 * Phases designs). A spec is small, strict and versioned: it travels in a
 * shared link (`?make=`) and in the bag line, and nowhere else.
 */
import type { BaseColor, ShirtProduct } from "@/types/shirt";
import { longDate } from "./kit";
import { wrap } from "./svg";
import { moonBody } from "./templates/moon";
import { latLon, skyBody, type SkyData } from "./templates/sky";
import { localToUtc } from "./tz";

export type TemplateId = "sky" | "moon";
/** Stable city id, "YYYY-MM-DD", optional "HH:MM" (local). */
export interface SkyParams {
  c: number;
  d: string;
  t?: string;
}
/** Year, and `s: 1` for the view from the south. */
export interface MoonParams {
  y: number;
  s?: 1;
}
export type CustomSpec = { t: "sky"; v: 1; p: SkyParams } | { t: "moon"; v: 1; p: MoonParams };

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

/** The personalised print's premium over the base price lives in lib/store-policy (customPremium). */
const TEMPLATES: Record<string, TemplateId> = { "sky-night": "sky", "moon-year": "moon" };
/** The template a design can be personalised with (by its variant), or null. */
export const templateFor = (shirt: Pick<ShirtProduct, "variant">): TemplateId | null => TEMPLATES[shirt.variant] ?? null;

export const FIRST_YEAR = 1900;
export const LAST_YEAR = 2100;
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
  if (spec.t === "sky") {
    if (typeof p.c !== "number" || !Number.isInteger(p.c) || p.c <= 0 || p.c > 0xffffffff) return null;
    if (cityById && !cityById(p.c)) return null;
    if (!parseDate(p.d)) return null;
    if (p.t !== undefined && !parseTime(p.t)) return null;
    return { t: "sky", v: 1, p: { c: p.c, d: p.d as string, ...(p.t !== undefined ? { t: p.t as string } : {}) } };
  }
  if (spec.t === "moon") {
    if (typeof p.y !== "number" || !Number.isInteger(p.y) || p.y < FIRST_YEAR || p.y > LAST_YEAR) return null;
    if (p.s !== undefined && p.s !== 1) return null;
    return { t: "moon", v: 1, p: { y: p.y, ...(p.s === 1 ? { s: 1 as const } : {}) } };
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

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** The spec for a link (`?make=`): base64url of its canonical JSON. */
export const encodeMake = (spec: CustomSpec) => b64url(canonical(spec));
/** A link's spec, validated; anything malformed is null. */
export function decodeMake(s: unknown, cityById?: (id: number) => City | undefined): CustomSpec | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(s)) return null;
  try {
    return validate(JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/"))), cityById);
  } catch {
    return null;
  }
}

/** The local time used for a sky spec (none given: the evening) and its UTC moment, in the city's zone. */
export function skyMoment(p: SkyParams, city: City) {
  const [y, mo, d] = parseDate(p.d)!;
  const [h, mi] = parseTime(p.t ?? DEFAULT_TIME)!;
  const at = localToUtc(city.tz, y, mo, d, h, mi);
  return { y, mo, d, h: at.h, mi: at.mi, jd: at.utc / 86400000 + 2440587.5 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function customTitle(spec: CustomSpec, city?: City): string {
  if (spec.t === "moon") return `Moon Phases of ${spec.p.y}`;
  const [y, mo, d] = parseDate(spec.p.d)!;
  return `Night Sky over ${city?.name ?? "your city"}, ${longDate(y, mo, d)}`;
}

/** The page's summary line: "Tel Aviv · 14 March 1991", or the year. */
export function customSummary(spec: CustomSpec, city?: City): string {
  if (spec.t === "moon") return String(spec.p.y);
  const [y, mo, d] = parseDate(spec.p.d)!;
  return `${city?.name ?? "Your city"} · ${longDate(y, mo, d)}`;
}

/**
 * The caption's name line: the kit shrinks names over 22 characters; one still
 * wider than the print (bold, spaced: 7 units a character) is cut with "…".
 */
export const TITLE_MAX = 36;
export const fitName = (name: string) => (name.length > TITLE_MAX ? `${name.slice(0, TITLE_MAX - 1).trimEnd()}…` : name);

/** The personalised print's body (white ink, unwrapped). */
export function customBody(spec: CustomSpec, data: { sky?: SkyData; city?: City }): string {
  if (spec.t === "moon") return moonBody({ year: spec.p.y, south: spec.p.s === 1 });
  const city = data.city!;
  const m = skyMoment(spec.p, city);
  const date = longDate(m.y, m.mo, m.d);
  const sub = spec.p.t ? `${date} · ${pad(m.h)}:${pad(m.mi)} local` : date;
  return skyBody({ place: city, jd: m.jd, caption: { title: fitName(city.name), sub, sub2: latLon(city.lat, city.lon) } }, data.sky!);
}

/** The whole print for a tee colour (white ink on black; inks swapped on white). */
export const renderCustomSvg = (spec: CustomSpec, teeColor: BaseColor, data: { sky?: SkyData; city?: City }) => wrap(customBody(spec, data), teeColor);
