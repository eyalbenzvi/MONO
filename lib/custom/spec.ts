/**
 * A personalised print's spec ("Make it yours"): which template, and the
 * customer's inputs. Small, strict and versioned: it travels in a shared link
 * (`?make=`) and in the bag line, and nowhere else. This module is what the
 * bag and the product page need on every load (validation, hashing, links);
 * drawing the print lives in lib/custom (index), loaded when one is shown.
 */
import type { ShirtProduct } from "@/types/shirt";

export type TemplateId = "sky" | "moon" | "night" | "planets" | "taste" | "code" | "line" | "voice" | "house" | "number";
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
/** Your Taste: the taste vector, each axis quantised to 0–10 and written in base 36 (FEATURE_KEYS order), 17 characters. */
export interface TasteParams {
  q: string;
}
export type CodeKind = "card" | "tape" | "morse" | "braille" | "binary";
/** Your Name: the text, its code, and `h: 1` to leave the plain letters out ("Keep it secret"). */
export interface CodeParams {
  x: string;
  k: CodeKind;
  h?: 1;
}
export const LINE_REPEATS = [6, 8, 12, 16, 24] as const;
/** Your Line: the stroke (base64url, see encodeStroke), how many times it goes round, and `m: 1` to mirror it. */
export interface LineParams extends Words {
  s: string;
  n: (typeof LINE_REPEATS)[number];
  m?: 1;
}
/** Your Voice: the numbers taken from three seconds of voice (never the sound): ratio a:b, damping, phase, pitch (Hz). */
export interface VoiceParams extends Words {
  a: number;
  b: number;
  d: number;
  ph: number;
  f: number;
}
export type Roof = "flat" | "pitched" | "stepped" | "dome";
export type Door = "l" | "c" | "r";
/** Your House: floors, windows per floor, roof, door and house number. */
export interface HouseParams extends Words {
  fl: number;
  wn: number;
  r: Roof;
  dr: Door;
  no?: number;
}
export type Face = "dial" | "stopwatch";
/** Your Number: a number, or a time "h:mm:ss"; its unit; a label; the face. */
export interface NumberParams {
  v: number | string;
  u: string;
  l?: string;
  face: Face;
}
export type CustomSpec =
  | { t: "sky"; v: 1; p: SkyParams }
  | { t: "moon"; v: 1; p: MoonParams }
  | { t: "night"; v: 1; p: NightParams }
  | { t: "planets"; v: 1; p: PlanetsParams }
  | { t: "taste"; v: 1; p: TasteParams }
  | { t: "code"; v: 1; p: CodeParams }
  | { t: "line"; v: 1; p: LineParams }
  | { t: "voice"; v: 1; p: VoiceParams }
  | { t: "house"; v: 1; p: HouseParams }
  | { t: "number"; v: 1; p: NumberParams };

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
const TEMPLATES: Record<string, TemplateId> = {
  "make-sky": "sky",
  "make-moon": "night",
  "make-year": "moon",
  "make-planets": "planets",
  "make-taste": "taste",
  "make-code": "code",
  "make-line": "line",
  "make-voice": "voice",
  "make-house": "house",
  "make-number": "number",
};
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
  const int = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
  if (spec.t === "taste") {
    if (typeof p.q !== "string" || !TASTE_Q.test(p.q)) return null;
    return { t: "taste", v: 1, p: { q: p.q } };
  }
  if (spec.t === "code") {
    if (typeof p.k !== "string" || !(p.k in CODE_CHARS) || typeof p.x !== "string") return null;
    const k = p.k as CodeKind;
    const x = codeText(p.x, k);
    if (!x || x !== p.x || codeProblem(x, k)) return null;
    if (p.h !== undefined && p.h !== 1) return null;
    return { t: "code", v: 1, p: { x, k, ...(p.h === 1 ? { h: 1 as const } : {}) } };
  }
  if (spec.t === "line") {
    if (typeof p.s !== "string" || !decodeStroke(p.s)) return null;
    if (!LINE_REPEATS.includes(p.n as never)) return null;
    if (p.m !== undefined && p.m !== 1) return null;
    return { t: "line", v: 1, p: { s: p.s, n: p.n as LineParams["n"], ...(p.m === 1 ? { m: 1 as const } : {}), ...words } };
  }
  if (spec.t === "voice") {
    if (!int(p.a, 1, 7) || !int(p.b, 1, 7) || p.a === p.b || gcd(p.a, p.b) !== 1) return null;
    if (!num(p.d, 0.003, 0.03, 4) || !num(p.ph, 0, 6.29, 2) || !int(p.f, 50, 1000)) return null;
    return { t: "voice", v: 1, p: { a: p.a, b: p.b, d: p.d as number, ph: p.ph as number, f: p.f, ...words } };
  }
  if (spec.t === "house") {
    if (!int(p.fl, 1, 12) || !int(p.wn, 1, 9) || !ROOFS.includes(p.r as Roof) || !DOORS.includes(p.dr as Door)) return null;
    if (p.no !== undefined && !int(p.no, 0, 9999)) return null;
    return { t: "house", v: 1, p: { fl: p.fl, wn: p.wn, r: p.r as Roof, dr: p.dr as Door, ...(p.no !== undefined ? { no: p.no as number } : {}), ...words } };
  }
  if (spec.t === "number") {
    const time = typeof p.v === "string" && parseClock(p.v) !== null;
    const value = typeof p.v === "number" && num(p.v, -99999, 99999, 3);
    if (!time && !value) return null;
    if (typeof p.u !== "string" || !UNIT.test(p.u)) return null;
    if (p.face !== "dial" && p.face !== "stopwatch") return null;
    // A stopwatch shows a time; a plain number only goes on the dial.
    if (p.face === "stopwatch" && !time) return null;
    let l: { l?: string } = {};
    if (p.l !== undefined) {
      const c = cleanWords(p.l);
      if (!c) return null;
      l = { l: c };
    }
    return { t: "number", v: 1, p: { v: p.v as number | string, u: p.u, ...l, face: p.face } };
  }
  return null;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** A finite number in range with at most `dp` decimals. */
const num = (v: unknown, lo: number, hi: number, dp: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi && Math.abs(Math.round(v * 10 ** dp) - v * 10 ** dp) < 1e-6;

/** Your Taste's vector: 17 axes, each 0–10 as one base-36 digit (0–9, a). */
const TASTE_Q = /^[0-9a]{17}$/;

/**
 * What each code can carry (exactly what lib/custom/draw/code punches).
 * Punched card: the IBM 029 keypunch's letters, digits and the punctuation
 * the catalogue's card codes. Paper tape: ITA2's letters and figures. Morse and
 * braille: letters, digits and the space. Binary: printable ASCII (case kept;
 * the others print in capitals).
 */
export const CODE_CHARS: Record<CodeKind, RegExp> = {
  card: /^[A-Z0-9 \-/.,'()+*=]$/,
  tape: /^[A-Z0-9 \-?:().,'/+=]$/,
  morse: /^[A-Z0-9 ]$/,
  braille: /^[A-Z0-9 ]$/,
  binary: /^[\x20-\x7e]$/,
};
export const CODE_NAMES: Record<CodeKind, string> = { card: "Punched card", tape: "Paper tape", morse: "Morse", braille: "Braille", binary: "Binary" };
export const CODE_MAX = 20;
/** The text as the code prints it: spaces collapsed, trimmed, capitals except for binary. */
export const codeText = (x: string, k: CodeKind) => {
  const t = x.replace(/\s+/g, " ").trim();
  return k === "binary" ? t : t.toUpperCase();
};
/** The first character the code can't carry, and what to type instead (its plain letter, when it has one), or null. Over CODE_MAX: ch "". */
export function codeProblem(text: string, k: CodeKind): { ch: string; instead: string | null } | null {
  if ([...text].length > CODE_MAX) return { ch: "", instead: null };
  for (const ch of text) {
    if (CODE_CHARS[k].test(ch)) continue;
    const plain = ch.normalize("NFKD").replace(/\p{M}/gu, "");
    const instead = plain && plain !== ch && [...plain].every((c) => CODE_CHARS[k].test(c)) ? plain : null;
    return { ch, instead };
  }
  return null;
}

/* Your Line's stroke: points on a 256 × 256 grid, the first as two bytes, then each step as a zigzag varint pair (dx, dy), base64url. */
export const STROKE_MAX_POINTS = 256;
export const STROKE_MAX_BYTES = 600;
const zig = (n: number) => (n << 1) ^ (n >> 31);
const unzig = (n: number) => (n >>> 1) ^ -(n & 1);
export function encodeStroke(points: readonly (readonly [number, number])[]): string {
  const bytes: number[] = [];
  const varint = (n: number) => {
    let v = zig(n);
    while (v > 0x7f) bytes.push((v & 0x7f) | 0x80), (v >>>= 7);
    bytes.push(v);
  };
  points.forEach(([x, y], i) => {
    if (i === 0) bytes.push(x, y);
    else varint(x - points[i - 1][0]), varint(y - points[i - 1][1]);
  });
  return b64url(String.fromCharCode(...bytes), true);
}
/** The stroke's points, or null when it's malformed, off the grid, or over the limits (2–256 points, 600 bytes). */
export function decodeStroke(s: string): [number, number][] | null {
  if (!/^[A-Za-z0-9_-]{3,800}$/.test(s)) return null;
  let bin: string;
  try {
    bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
  if (bin.length > STROKE_MAX_BYTES || bin.length < 2) return null;
  const b = [...bin].map((c) => c.charCodeAt(0));
  const pts: [number, number][] = [[b[0], b[1]]];
  let i = 2;
  const varint = () => {
    let v = 0;
    for (let shift = 0; i < b.length && shift < 21; shift += 7) {
      const c = b[i++];
      v |= (c & 0x7f) << shift;
      if (!(c & 0x80)) return unzig(v);
    }
    return null;
  };
  while (i < b.length) {
    const dx = varint();
    const dy = varint();
    if (dx === null || dy === null) return null;
    const [x, y] = pts[pts.length - 1];
    if (x + dx < 0 || x + dx > 255 || y + dy < 0 || y + dy > 255) return null;
    pts.push([x + dx, y + dy]);
    if (pts.length > STROKE_MAX_POINTS) return null;
  }
  return pts.length >= 2 && b64url(bin, true) === s ? pts : null;
}

export const ROOFS: readonly Roof[] = ["flat", "pitched", "stepped", "dome"];
export const DOORS: readonly Door[] = ["l", "c", "r"];

/** A time "h:mm:ss" (up to 99:59:59) in seconds, or null. */
export function parseClock(v: string): number | null {
  const m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(v);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
/** Your Number's units: the list, or up to six characters of the print font's letters and signs. */
export const UNITS = ["", "km", "m", "kg", "g", "cm", "m²", "min", "bpm", "°C", "%"] as const;
const UNIT = /^[\p{Script=Latin}0-9²³°%/. ]{0,6}$/u;

/** The spec as canonical JSON (keys in a fixed order): the same spec is always the same string. */
export const canonical = (spec: CustomSpec) => JSON.stringify(validate(spec));

/** A short stable hash of the spec (bag line keys). FNV-1a, 32 bits, base 36. */
export function specHash(spec: CustomSpec): string {
  let h = 0x811c9dc5;
  for (const ch of canonical(spec)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(36);
}

// UTF-8 inside base64 (words may carry accents): btoa takes one byte per character. `raw`: the string is bytes already.
const b64url = (s: string, raw = false) => btoa(raw ? s : unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** The spec for a link (`?make=`): base64url of its canonical JSON. */
export const encodeMake = (spec: CustomSpec) => b64url(canonical(spec));
/** A link's spec, validated; anything malformed is null. */
export function decodeMake(s: unknown, cityById?: (id: number) => City | undefined): CustomSpec | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,1200}$/.test(s)) return null;
  try {
    return validate(JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))), cityById);
  } catch {
    return null;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The spec's day as the prints write it ("14 March 1991"), or its year ("" for a product that isn't dated). */
export function customDay(spec: CustomSpec): string {
  if (spec.t === "moon") return String(spec.p.y);
  if (spec.t !== "sky" && spec.t !== "night" && spec.t !== "planets") return "";
  const [y, mo, d] = parseDate(spec.p.d)!;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

/** The products' names (lib/custom/products), by template. */
export const PRODUCT_NAMES: Record<TemplateId, string> = {
  sky: "Your Night Sky",
  night: "Your Moon",
  moon: "Your Year of Moons",
  planets: "Your Planets",
  taste: "Your Taste",
  code: "Your Name",
  line: "Your Line",
  voice: "Your Voice",
  house: "Your House",
  number: "Your Number",
};

/** What a product that isn't dated puts after its name in the bag ("Your Name · NOA", "Your Voice · 196 Hz"). */
function customDetail(spec: CustomSpec): string {
  switch (spec.t) {
    case "code":
      return spec.p.x;
    case "line":
      return `${spec.p.n}-fold`;
    case "voice":
      return `${spec.p.f} Hz`;
    case "house":
      return spec.p.no !== undefined ? `No. ${spec.p.no}` : `${spec.p.fl} ${spec.p.fl === 1 ? "floor" : "floors"}`;
    case "number":
      return spec.p.l ?? [spec.p.v, spec.p.u].join(" ").trim();
    default:
      return customDay(spec);
  }
}

/** A made-for-you tee's title, in the bag and the confirmation: the product and its day (or year). */
export const customTitle = (spec: CustomSpec) => [PRODUCT_NAMES[spec.t], customDetail(spec)].filter(Boolean).join(" · ");
