/**
 * What every spec's validation is made of (lib/custom/spec and each
 * product's own module in lib/custom/specs): the checks for a field's type
 * and range, the words, a real date, and the compact byte encoding a spec
 * uses when its input is long (a melody, a route, a game): zigzag varints in
 * base64url, the way Your Line's stroke travels.
 */

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** A whole number in range. */
export const int = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
/** A finite number in range with at most `dp` decimals. */
export const num = (v: unknown, lo: number, hi: number, dp: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi && Math.abs(Math.round(v * 10 ** dp) - v * 10 ** dp) < 1e-6;
/** `1` or absent: an on/off setting, as `{ k: 1 }` or `{}`; null when it's anything else. */
export function flag<K extends string>(p: Record<string, unknown>, k: K): { [P in K]?: 1 } | null {
  if (p[k] === undefined) return {};
  return p[k] === 1 ? ({ [k]: 1 } as { [P in K]?: 1 }) : null;
}

export const FIRST_YEAR = 1900;
export const LAST_YEAR = 2100;
export const WORDS_MAX = 28;
/** Letters of the print font's script, digits, and a few marks. */
export const WORDS = /^[\p{Script=Latin}0-9 .,'’&:!?·()-]+$/u;
/** The words as they print: spaces collapsed, trimmed; null when there's nothing, too much, or a character the print can't set. */
export function cleanWords(s: unknown, max = WORDS_MAX): string | null {
  if (typeof s !== "string") return null;
  const w = s.replace(/\s+/g, " ").trim();
  return w && w.length <= max && WORDS.test(w) ? w : null;
}
/** A short printed label (a name on a tree, a station, a milestone): the words' rule, `max` characters, exactly as tidied. */
export const label = (s: unknown, max: number): s is string => typeof s === "string" && cleanWords(s, max) === s;
/** The optional words (`w`): `{}` when absent, `{ w }` when printable, null otherwise. */
export function wordsOf(p: Record<string, unknown>): { w?: string } | null {
  if (p.w === undefined) return {};
  const w = cleanWords(p.w);
  return w && w === p.w ? { w } : null;
}

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
/** Days since 1970-01-01 of a valid date string. */
export const dayNumber = (s: string) => {
  const [y, mo, d] = parseDate(s)!;
  return Date.UTC(y, mo - 1, d) / 86_400_000;
};

// UTF-8 inside base64 (words may carry accents): btoa takes one byte per character. `raw`: the string is bytes already.
export const b64url = (s: string, raw = false) => btoa(raw ? s : unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const zig = (n: number) => (n << 1) ^ (n >> 31);
const unzig = (n: number) => (n >>> 1) ^ -(n & 1);

/** Signed whole numbers as zigzag varints, base64url (the compact form a long input takes in a spec). */
export function packInts(values: readonly number[]): string {
  const bytes: number[] = [];
  for (const n of values) {
    let v = zig(n) >>> 0;
    while (v > 0x7f) bytes.push((v & 0x7f) | 0x80), (v >>>= 7);
    bytes.push(v);
  }
  return b64url(String.fromCharCode(...bytes), true);
}
/** packInts read back: the numbers, or null when malformed, over `maxBytes`, or not in its one canonical spelling. */
export function unpackInts(s: unknown, maxBytes: number): number[] | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,4000}$/.test(s)) return null;
  let bin: string;
  try {
    bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
  if (bin.length > maxBytes || b64url(bin, true) !== s) return null;
  const out: number[] = [];
  let i = 0;
  while (i < bin.length) {
    let v = 0;
    let done = false;
    for (let shift = 0; i < bin.length && shift < 28; shift += 7) {
      const c = bin.charCodeAt(i++);
      v |= (c & 0x7f) << shift;
      if (!(c & 0x80)) {
        done = true;
        break;
      }
    }
    if (!done) return null;
    out.push(unzig(v >>> 0));
  }
  // One spelling per list (no over-long varints), so the same input is always the same spec.
  return packInts(out) === s ? out : null;
}

/**
 * A list of places with an optional year each (Your World Tour, Your
 * Signpost, and every product built on the places-and-years editor): cities
 * of the place list by GeoNames id, in order. Packed as varints (packInts:
 * each row its id, then its year counted from FIRST_YEAR, 0 for none), so 24
 * rows stay a short link.
 */
export interface PlaceRow {
  /** GeoNames id (data/cities). */
  c: number;
  y?: number;
}
export const packPlaces = (rows: readonly PlaceRow[]) => packInts(rows.flatMap((r) => [r.c, r.y === undefined ? 0 : r.y - FIRST_YEAR + 1]));
/**
 * packPlaces read back: the rows, or null when malformed, outside `min`–`max`
 * rows, a year out of range (or any year when `years` is false), or (with the
 * place list) a city it doesn't know.
 */
export function unpackPlaces(s: unknown, opts: { min: number; max: number; years?: boolean }, cityById?: (id: number) => unknown): PlaceRow[] | null {
  const n = unpackInts(s, opts.max * 10);
  if (!n || n.length % 2 || n.length / 2 < opts.min || n.length / 2 > opts.max) return null;
  const rows: PlaceRow[] = [];
  for (let i = 0; i < n.length; i += 2) {
    const [c, y] = [n[i], n[i + 1]];
    if (!int(c, 1, 0xffffffff) || (cityById && !cityById(c))) return null;
    if (y === 0) rows.push({ c });
    else if (opts.years !== false && int(y, 1, LAST_YEAR - FIRST_YEAR + 1)) rows.push({ c, y: y + FIRST_YEAR - 1 });
    else return null;
  }
  return rows;
}

/**
 * The visitor's own caption (every Make product's optional `cap`): up to
 * three lines, one per caption line in order (0 the title, 1 the line under
 * it, 2 the one under that; lib/custom/kit captionLines). Each is null (our
 * line, the default) or the visitor's line (the words' rule, the line's own
 * length); "" hides the line where the product allows it. A trailing run of
 * nulls is dropped, and no `cap` at all is every line ours: links, bag lines
 * and orders made before captions stay as they were.
 */
export type Cap = (string | null)[];
export const CAP_LINES = 3;
/** Each line's longest: the title (bold, spaced, shrunk past 22) and the two smaller lines. */
export const CAP_MAX = [24, 36, 36] as const;
export interface CapRule {
  /** Each line's longest (CAP_MAX unless a product's print holds less). */
  max?: readonly number[];
  /** Which lines may be hidden (""), each checked against the gate with the example (tests/make). */
  hide?: readonly boolean[];
}
/** The `cap` of a spec's params: `{}` when absent or all ours, `{ cap }` when valid (trailing nulls dropped), null otherwise. */
export function capOf(p: Record<string, unknown>, rule: CapRule = {}): { cap?: Cap } | null {
  if (p.cap === undefined) return {};
  if (!Array.isArray(p.cap) || p.cap.length > CAP_LINES) return null;
  const max = rule.max ?? CAP_MAX;
  const out: Cap = [];
  for (let i = 0; i < p.cap.length; i++) {
    const v: unknown = p.cap[i];
    if (v === null) out.push(null);
    else if (v === "" && rule.hide?.[i]) out.push("");
    else if (typeof v === "string" && v !== "" && cleanWords(v, max[i]) === v) out.push(v);
    else return null;
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out.length ? { cap: out } : {};
}
/** The words a print's first line carries: the visitor's title (cap[0]) when set, else the words of a link made before captions (`w`). */
export const titleWords = (p: { w?: string; cap?: Cap }): string | undefined => (typeof p.cap?.[0] === "string" && p.cap[0] ? p.cap[0] : p.w);
