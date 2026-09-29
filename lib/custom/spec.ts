/**
 * A personalised print's spec ("Make it yours"): which template, and the
 * customer's inputs. Small, strict and versioned: it travels in a shared link
 * (`?make=`) and in the bag line, and nowhere else. This module is what the
 * bag and the product page need on every load (validation, hashing, links);
 * drawing the print lives in lib/custom (index), loaded when one is shown.
 */
import type { ShirtProduct } from "@/types/shirt";
import { FIRST_YEAR, LAST_YEAR, WORDS_MAX, b64url, capOf, cleanWords, int, isObj, num, parseDate, parseTime, titleWords, type Cap, type CapRule } from "./specKit";
import { fnv1aChars } from "@/lib/hash";
import { EXTRA, type ExtraId, type ExtraSpec } from "./specs";

export { FIRST_YEAR, LAST_YEAR, WORDS_MAX, cleanWords, parseDate, parseTime };
export type { ExtraId };

/** The first twelve templates (their params below); the later products each keep theirs in a module of their own (lib/custom/specs). */
type BaseId = "sky" | "moon" | "night" | "planets" | "taste" | "code" | "line" | "voice" | "house" | "number" | "place" | "ascii";
export type TemplateId = BaseId | ExtraId;
/** The visitor's own caption lines (specKit capOf; every product has them). */
interface Captioned {
  cap?: Cap;
}
/** The customer's own words, the print's first line (optional, WORDS_MAX characters of the print font's script): links made before captions; the editor now writes cap[0]. */
interface Words extends Captioned {
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
export interface TasteParams extends Captioned {
  q: string;
}
export type CodeKind = "card" | "tape" | "morse" | "braille" | "binary";
/** Your Name: the text, its code, and `h: 1` to leave the plain letters out ("Keep it secret"). */
export interface CodeParams extends Captioned {
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
export interface NumberParams extends Captioned {
  v: number | string;
  u: string;
  l?: string;
  face: Face;
}
/**
 * Your Place: where you were (latitude and longitude, two decimals: about a
 * kilometre, never finer), when (a day, optional), the city it's named by
 * (optional, data/cities) and the words.
 */
export interface PlaceParams extends Words {
  la: number;
  lo: number;
  d?: string;
  c?: number;
}
export const ASCII_FILLS = ["self", "#", "@", "%", "8", "$", "phrase"] as const;
export type AsciiFill = (typeof ASCII_FILLS)[number];
/**
 * Your ASCII: one or two lines of big letters (the pixel font's characters), what they're typed in, a drop shadow;
 * or a picture: `x: []` (no letters), its width in characters `c` and its tones `g` (asciiPack), and no f/p/s.
 */
export interface AsciiParams extends Words {
  x: string[];
  /** What the letters are typed in (always with letters, never with a picture). */
  f?: AsciiFill;
  /** The phrase the letters are typed in (f: "phrase"). */
  p?: string;
  s?: 1;
  /** A picture's width in characters (ASCII_COLS); its rows are ASCII_ROWS[c]. */
  c?: AsciiCols;
  /** A picture's tones, 0 (darkest) to 7, row by row (asciiPack). */
  g?: string;
}
/** Your ASCII: up to this many characters a line, two lines. */
export const ASCII_MAX = 8;
/** What the big letters can be: the pixel font's characters (lib/custom/draw/pixelFont). */
export const ASCII_CHARS = /^[A-Z0-9?!.:\-+/ ]$/;
/** What a fill phrase can be typed in: printable ASCII, the monospace grid's own characters. */
export const ASCII_PHRASE = /^[\x21-\x7E ]{1,24}$/;
/** The first character the pixel font can't draw, or null. */
export const asciiProblem = (line: string) => [...line.toUpperCase()].find((ch) => !ASCII_CHARS.test(ch)) ?? null;
/** A picture's widths in characters (the Detail choice), and the rows each makes (the print's nearly square area). */
export const ASCII_COLS = [32, 40, 48] as const;
export type AsciiCols = (typeof ASCII_COLS)[number];
export const ASCII_ROWS: Record<AsciiCols, number> = { 32: 18, 40: 22, 48: 27 };
/** A picture's tones: 0 (darkest) to ASCII_LEVELS − 1 (lightest), three bits a cell. */
export const ASCII_LEVELS = 8;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** A picture's tones as base64url, two cells a character (the first in the high three bits); rows × cols is always even. */
export const asciiPack = (levels: readonly number[]) => Array.from({ length: Math.ceil(levels.length / 2) }, (_, i) => B64[(levels[2 * i] << 3) | (levels[2 * i + 1] ?? 0)]).join("");
/** asciiPack read back for a width: the tones, or null when it isn't exactly that grid's one spelling. */
export function asciiUnpack(g: unknown, c: unknown): number[] | null {
  if (!(ASCII_COLS as readonly unknown[]).includes(c) || typeof g !== "string") return null;
  const n = (c as AsciiCols) * ASCII_ROWS[c as AsciiCols];
  if (g.length !== n / 2) return null;
  const out: number[] = [];
  for (const ch of g) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    out.push(v >> 3, v & 7);
  }
  return out;
}
/** The ink a cell of each tone carries on a black tee (the template's ramp " .:*=%#@", measured); a white tee reads it backwards. */
const ASCII_TONE_INK = [0, 0.03, 0.06, 0.11, 0.15, 0.21, 0.28, 0.31];
/**
 * Why a picture's tones won't print, or null (the gate's verdict, foreseen; thresholds from the fuzz in
 * tests/make/ascii.test.ts): nearly one tone (or two neighbouring ones), or too little ink on one of the tees (the ink is the characters:
 * light tones on a black tee, dark ones on a white one), or little ink in big even areas (a flat print).
 */
export function asciiPictureProblem(levels: readonly number[], cols: number): string | null {
  const n = levels.length, top = ASCII_LEVELS - 1;
  const count = Array<number>(ASCII_LEVELS).fill(0);
  let onBlack = 0, onWhite = 0, change = 0;
  levels.forEach((l, i) => {
    count[l]++;
    onBlack += ASCII_TONE_INK[l];
    onWhite += ASCII_TONE_INK[top - l];
    if (i % cols < cols - 1 && l !== levels[i + 1]) change++;
    if (i + cols < n && l !== levels[i + cols]) change++;
  });
  const ink = Math.min(onBlack, onWhite) / n;
  // One tone, or a haze of two neighbouring ones (a fog, a blank wall).
  if (Math.max(...count) > 0.8 * n || count.some((k, l) => k + (count[l + 1] ?? 0) > 0.92 * n)) return "The picture is nearly one tone. Try one with more light and shade.";
  if (ink < 0.06 || (ink < 0.09 && change < 0.16 * n)) return `The picture is nearly all ${onBlack < onWhite ? "dark" : "light"}. Try a closer crop, or another picture.`;
  return null;
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
  | { t: "number"; v: 1; p: NumberParams }
  | { t: "place"; v: 1; p: PlaceParams }
  | { t: "ascii"; v: 1; p: AsciiParams }
  | ExtraSpec;

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
  "make-place": "place",
  "make-ascii": "ascii",
  ...Object.fromEntries(Object.keys(EXTRA).map((t) => [`make-${t}`, t as ExtraId])),
};
/** The template a product is made with (by its variant), or null. */
export const templateFor = (shirt: Pick<ShirtProduct, "variant">): TemplateId | null => TEMPLATES[shirt.variant] ?? null;

/** Each original product's caption rule: which lines may be hidden (tests/make/captions.test.ts checks each against the gate). */
export const BASE_CAP: Partial<Record<BaseId, CapRule>> = Object.fromEntries(
  (["sky", "moon", "night", "planets", "taste", "code", "ascii", "line", "voice", "house", "number", "place"] as const).map((t) => [t, { hide: [true, true, true] }]),
);

/** A product's caption rule (the original twelve here, the later ones in their spec modules). */
export const capRuleFor = (t: TemplateId): CapRule => (t in EXTRA ? ((EXTRA[t as ExtraId] as { CAP?: CapRule }).CAP ?? {}) : (BASE_CAP[t as BaseId] ?? {}));
/**
 * The original products whose words (`w`) were the caption's first line (the
 * later ones say so in their spec modules, WORDS_TITLE): their editors write
 * cap[0] instead, and a link that arrives with `w` opens with it as the
 * visitor's title (the validator still reads `w`, so the link prints as it did).
 */
const BASE_WORDS_TITLE: readonly BaseId[] = ["sky", "moon", "night", "planets", "line", "voice", "place", "ascii"];
export const wordsTitle = (t: TemplateId): boolean => (t in EXTRA ? (EXTRA[t as ExtraId] as { WORDS_TITLE?: boolean }).WORDS_TITLE === true : BASE_WORDS_TITLE.includes(t as BaseId));

/** The planets' orbital elements hold to 2050 (JPL, Standish). */
export const PLANETS_LAST_YEAR = 2050;
/** No time given: the evening of that day. */
export const DEFAULT_TIME = "22:00";

/**
 * A spec, strictly: known template and version, every field's type and range,
 * a real date, and (when the city list is given) a known city. Unknown keys
 * are dropped. Anything else is null.
 */
export function validate(spec: unknown, cityById?: (id: number) => City | undefined): CustomSpec | null {
  if (!isObj(spec) || spec.v !== 1 || !isObj(spec.p)) return null;
  const p = spec.p;
  if (typeof spec.t === "string" && Object.hasOwn(EXTRA, spec.t)) {
    const t = spec.t as ExtraId;
    const q = (EXTRA[t].check as (p: Record<string, unknown>, ctx: { cityById?: typeof cityById }) => Record<string, unknown> | null)(p, { cityById });
    // The caption's lines, by the product's rule (its CAP), for every later product alike.
    const cap = capOf(p, capRuleFor(t));
    return q && cap ? ({ t, v: 1, p: { ...q, ...cap } } as CustomSpec) : null;
  }
  let words: Words = {};
  if (p.w !== undefined) {
    const w = cleanWords(p.w);
    if (!w) return null;
    words = { w };
  }
  const cap = capOf(p, BASE_CAP[spec.t as BaseId] ?? {});
  if (!cap) return null;
  words = { ...words, ...cap };
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
  if (spec.t === "taste") {
    if (typeof p.q !== "string" || !TASTE_Q.test(p.q)) return null;
    return { t: "taste", v: 1, p: { q: p.q, ...cap } };
  }
  if (spec.t === "code") {
    if (typeof p.k !== "string" || !(p.k in CODE_CHARS) || typeof p.x !== "string") return null;
    const k = p.k as CodeKind;
    const x = codeText(p.x, k);
    if (!x || x !== p.x || codeProblem(x, k)) return null;
    if (p.h !== undefined && p.h !== 1) return null;
    return { t: "code", v: 1, p: { x, k, ...(p.h === 1 ? { h: 1 as const } : {}), ...cap } };
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
    return { t: "number", v: 1, p: { v: p.v as number | string, u: p.u, ...l, face: p.face, ...cap } };
  }
  if (spec.t === "place") {
    if (!num(p.la, -90, 90, 2) || !num(p.lo, -180, 180, 2)) return null;
    if (p.d !== undefined && !parseDate(p.d)) return null;
    if (p.c !== undefined && (!int(p.c, 1, 0xffffffff) || (cityById && !cityById(p.c)))) return null;
    return { t: "place", v: 1, p: { la: p.la as number, lo: p.lo as number, ...(p.d !== undefined ? { d: p.d as string } : {}), ...(p.c !== undefined ? { c: p.c as number } : {}), ...words } };
  }
  if (spec.t === "ascii") {
    // A picture: no letters (x: [] exactly), a width and its tones; nothing that belongs to letters.
    if (p.g !== undefined || p.c !== undefined) {
      if (!Array.isArray(p.x) || p.x.length || p.f !== undefined || p.p !== undefined || p.s !== undefined) return null;
      const levels = asciiUnpack(p.g, p.c);
      if (!levels || asciiPictureProblem(levels, p.c as AsciiCols)) return null;
      return { t: "ascii", v: 1, p: { x: [], c: p.c as AsciiCols, g: p.g as string, ...words } };
    }
    if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > 2) return null;
    const lines = p.x.map((l) => (typeof l === "string" ? l.toUpperCase().trim() : ""));
    if (lines.some((l) => !l || l.length > ASCII_MAX || asciiProblem(l)) || !lines.some((l) => /[A-Z0-9]/.test(l))) return null;
    if (!(ASCII_FILLS as readonly unknown[]).includes(p.f)) return null;
    if ((p.f === "phrase") !== (p.p !== undefined)) return null;
    if (p.p !== undefined && (typeof p.p !== "string" || !ASCII_PHRASE.test(p.p) || !p.p.trim())) return null;
    if (p.s !== undefined && p.s !== 1) return null;
    return { t: "ascii", v: 1, p: { x: lines, f: p.f as AsciiFill, ...(p.p !== undefined ? { p: p.p as string } : {}), ...(p.s === 1 ? { s: 1 as const } : {}), ...words } };
  }
  return null;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

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
  return fnv1aChars(canonical(spec)).toString(36);
}

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
  taste: "Your Taste Plant",
  code: "Your Name in Code",
  line: "Your Line",
  voice: "Your Voice",
  house: "Your House",
  number: "Your Number",
  place: "Your Place",
  ascii: "Your ASCII",
  ...(Object.fromEntries(Object.entries(EXTRA).map(([t, m]) => [t, m.NAME])) as Record<ExtraId, string>),
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
    case "place":
      return spec.p.w ?? coords(spec.p.la, spec.p.lo);
    case "ascii":
      return spec.p.g ? (spec.p.w ?? "A picture") : spec.p.x.join(" ");
    case "sky":
    case "moon":
    case "night":
    case "planets":
    case "taste":
      return customDay(spec);
    default:
      return (EXTRA[spec.t].detail as (p: unknown) => string)(spec.p);
  }
}

/** Words longer than this are cut (with an ellipsis) where a title adds them. */
const NOTE_MAX = 22;
const cut = (s: string) => (s.length > NOTE_MAX ? `${s.slice(0, NOTE_MAX - 1).trimEnd()}…` : s);
/**
 * A made-for-you tee's title, in the bag and the confirmation: the product,
 * its day (or year, or what sets it apart), and the visitor's title line (or
 * its words) when it has one and it isn't already said (so two night skies of
 * one date tell apart).
 */
export function customTitle(spec: CustomSpec): string {
  // The visitor's title line (cap[0]) when set, else a link's words from before captions; the products whose words were the title show it as their words.
  const w = titleWords(spec.p as { w?: string; cap?: Cap });
  const detail = customDetail(wordsTitle(spec.t) ? ({ ...spec, p: { ...spec.p, w } } as CustomSpec) : spec);
  const note = typeof w === "string" && w && !detail.includes(w) ? cut(w) : "";
  return [PRODUCT_NAMES[spec.t], detail && cut(detail), note].filter(Boolean).join(" · ");
}

/** Degrees and minutes, hemispheres named: "32°05′N 34°47′E". */
export function coords(la: number, lo: number): string {
  const dm = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    let d = Math.floor(a), m = Math.round((a - d) * 60);
    if (m === 60) (d += 1), (m = 0);
    return `${d}°${String(m).padStart(2, "0")}′${v >= 0 ? pos : neg}`;
  };
  return `${dm(la, "N", "S")} ${dm(lo, "E", "W")}`;
}
