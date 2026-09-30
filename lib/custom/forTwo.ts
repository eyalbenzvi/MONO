/**
 * For two (/make/two/): one date of a couple's (and what it was, their two
 * names, a place) turned into every print MONO can make from it, each a spec
 * ready for its product page (`?make=`). Pure: the page draws the cards.
 * Only the products the inputs allow are listed (no sky without a place, the
 * planets to 2050, a monogram only with two names, the first messages only
 * between two named people, a signpost "since" only with the place and
 * where they live now, two different cities), and every spec is validated,
 * so one that can't take the inputs drops alone.
 */
import { PLANETS_LAST_YEAR, cleanWords, parseDate, validate, type City, type CustomSpec } from "./spec";
import { WEEKS_YEARS, weeksDateProblem } from "./specs/weeks";
import { SNOWFLAKE_MAX } from "./specs/snowflake";
import { HEAD_MAX, ITEM_MAX } from "./specs/receipt";
import { MESSAGE_MAX } from "./specs/message";
import { packPlaces } from "./specKit";

export type TwoPlace = Pick<City, "id" | "name" | "lat" | "lon">;
export interface TwoInputs {
  /** The day, "YYYY-MM-DD". */
  d: string;
  /** What it was ("The night we met"): the print's first line, already checked. */
  w?: string;
  /** Their two names, already checked. */
  a?: string;
  b?: string;
  /** Where; none means no sky and no globe. */
  place?: TwoPlace | null;
  /** Where they live now (optional): with the place, a signpost between the two. */
  home?: TwoPlace | null;
}
export interface TwoCard {
  /** The product (lib/custom/products slug). */
  slug: string;
  spec: CustomSpec;
  /** What it is for them, in one line. */
  line: string;
}

/** A name on the page: the words' rule, this many characters. */
export const TWO_NAME_MAX = 12;
/** What the page shows before a date is put in: a real date and our example couple. */
export const TWO_EXAMPLE = { d: "2016-08-12", w: "The night we met", a: "Noa", b: "David" } as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayLabel = (d: string) => {
  const [y, mo, dd] = parseDate(d)!;
  return `${dd} ${MONTHS[mo - 1]} ${y}`;
};
/** A name's initial as the monogram draws it (A–Z, accents folded), or null. */
export function initialOf(name: string | undefined): string | null {
  const ch = (name ?? "").trim().charAt(0).normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase();
  return /^[A-Z]$/.test(ch) ? ch : null;
}
/** A typed name as it prints, or null (empty, too long, or a character the print can't set). */
export const cleanName = (s: string) => cleanWords(s, TWO_NAME_MAX);

/** Every print these inputs make, in the page's order. `today` ("YYYY-MM-DD") is what Your Life in Weeks counts to. */
export function forTwo(i: TwoInputs, today: string): TwoCard[] {
  const date = parseDate(i.d);
  if (!date) return [];
  const d = i.d;
  const y = date[0];
  const w = i.w && cleanWords(i.w) === i.w ? { w: i.w } : {};
  const place = i.place ?? null;
  const south = place && place.lat < 0 ? { s: 1 as const } : {};
  const a = i.a && cleanName(i.a) === i.a ? i.a : undefined;
  const b = i.b && cleanName(i.b) === i.b ? i.b : undefined;
  const ia = initialOf(a), ib = initialOf(b);
  const out: { slug: string; spec: unknown; line: string }[] = [];
  if (place) out.push({ slug: "sky", spec: { t: "sky", v: 1, p: { c: place.id, d, ...w } }, line: `The sky over ${place.name} that night` });
  out.push({ slug: "moon", spec: { t: "night", v: 1, p: { d, ...south, ...w } }, line: "The moon that night" });
  if (y <= PLANETS_LAST_YEAR) out.push({ slug: "planets", spec: { t: "planets", v: 1, p: { d, ...w } }, line: "The planets that day" });
  out.push({ slug: "julia", spec: { t: "julia", v: 1, p: { d, ...w } }, line: `${dayLabel(d)} as a fractal` });
  if (ia && ib) out.push({ slug: "monogram", spec: { t: "monogram", v: 1, p: { x: ia + ib, s: "lace", y } }, line: `${ia} and ${ib}, woven` });
  if (place) {
    const r = (v: number) => Math.round(v * 100) / 100;
    out.push({ slug: "place", spec: { t: "place", v: 1, p: { la: r(place.lat), lo: r(place.lon), d, c: place.id, ...w } }, line: `${place.name} at the centre of the globe` });
  }
  out.push({ slug: "year", spec: { t: "moon", v: 1, p: { y, ...south, ...w } }, line: `Every moon of ${y}` });
  // Counted from the date to today: not for a date still to come, nor one past the grid's 90 years.
  const n = WEEKS_YEARS.find((n) => !weeksDateProblem(d, n, today));
  if (n) out.push({ slug: "weeks", spec: { t: "weeks", v: 1, p: { b: d, a: today, n, ...w } }, line: `Every week since ${y}, a dot each` });
  if (a && b && `${a} & ${b}`.length <= SNOWFLAKE_MAX) out.push({ slug: "snowflake", spec: { t: "snowflake", v: 1, p: { n: `${a} & ${b}` } }, line: "A snowflake grown from both names" });
  // The receipt for it: what it was first (when it fits a line), then our items, and the years since when there are some.
  const years = Number(today.slice(0, 4)) - y;
  const items = [i.w && i.w.length <= ITEM_MAX && cleanWords(i.w, ITEM_MAX) === i.w ? i.w : "First date", "Coffee, too strong", "Long walk", "Last train", ...(years >= 2 && years <= 99 ? [`${years} good years`] : [])];
  // The shop's name is theirs: both names, or the two of them.
  const head = a && b && `${a} & ${b}`.length <= HEAD_MAX ? `${a} & ${b}` : "The two of us";
  out.push({ slug: "receipt", spec: { t: "receipt", v: 1, p: { k: "receipt", h: head, x: items, d } }, line: "The receipt for it, itemised" });
  // The first messages, as they might have gone: only between two named people.
  if (a && b) {
    const m = [[0, `Hi ${b}. It was nice to meet you.`, "21:02"], [1, `Hi ${a}. It was. Same time next week?`, "21:05"]];
    if (m.every(([, t]) => String(t).length <= MESSAGE_MAX)) out.push({ slug: "message", spec: { t: "message", v: 1, p: { n: b, d, m } }, line: "The first messages, as they might have gone" });
  }
  // A signpost from where they live now to where it was, and the year it started.
  const home = i.home ?? null;
  if (place && home && home.id !== place.id) out.push({ slug: "signpost", spec: { t: "signpost", v: 1, p: { k: "since", h: home.id, x: packPlaces([{ c: place.id }]), y } }, line: `${home.name} to ${place.name}, since ${y}` });
  return out.flatMap((c) => {
    const spec = validate(c.spec);
    return spec ? [{ slug: c.slug, spec, line: c.line }] : [];
  });
}

/** The page's address: what's typed, each field read alone (a bad one is dropped, the rest kept). `c`: a city id, "none", or absent (the visitor's own); `h`: where they live now, a city id. */
export interface TwoQuery {
  d?: string;
  w?: string;
  a?: string;
  b?: string;
  c?: number | "none";
  h?: number;
}
export function readTwo(q: URLSearchParams): TwoQuery {
  const out: TwoQuery = {};
  const d = q.get("d");
  if (d && parseDate(d)) out.d = d;
  const w = q.get("w");
  if (w && cleanWords(w) === w) out.w = w;
  for (const k of ["a", "b"] as const) {
    const v = q.get(k);
    if (v && cleanName(v) === v) out[k] = v;
  }
  const c = q.get("c");
  if (c === "none") out.c = "none";
  else if (c && /^[1-9]\d{0,9}$/.test(c) && Number(c) <= 0xffffffff) out.c = Number(c);
  const h = q.get("h");
  if (h && /^[1-9]\d{0,9}$/.test(h) && Number(h) <= 0xffffffff) out.h = Number(h);
  return out;
}
export function writeTwo(t: TwoQuery): string {
  const q = new URLSearchParams();
  for (const k of ["d", "w", "a", "b"] as const) if (t[k]) q.set(k, t[k]!);
  if (t.c !== undefined) q.set("c", String(t.c));
  if (t.h !== undefined) q.set("h", String(t.h));
  return q.toString();
}
