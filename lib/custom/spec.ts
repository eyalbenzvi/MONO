/**
 * A personalised print's spec ("Make it yours"): which template, and the
 * customer's inputs. Small, strict and versioned: it travels in a shared link
 * (`?make=`) and in the bag line, and nowhere else. This module is what the
 * bag and the product page need on every load (validation, hashing, links);
 * drawing the print lives in lib/custom (index), loaded when one is shown.
 */
import type { ShirtProduct } from "@/types/shirt";

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
