/**
 * Make, from ours: our designs adapted for one person, as products of their own. Each is one
 * template with the customer's inputs, drawn like one of the catalogue's
 * computed designs (`base`: its tee photos and its place in the taste). They
 * aren't in the catalogue's list (no grid, no Discover deck); the catalogue
 * resolves their ids (lib/catalog getShirtById) so the bag, the order and the
 * analytics treat them as any tee. Their pages live at /make/<slug>/.
 */
import type { PrintHints } from "./printCheck";
import type { CustomSpec, TemplateId } from "./spec";
import { EXTRA, type ExtraId } from "./specs";

export interface MadeProduct {
  slug: "taste" | "code" | "ascii" | "line" | "voice" | "house" | "number" | "place" | "sky" | "moon" | "year" | "planets" | ExtraId;
  id: string;
  template: TemplateId;
  name: string;
  /** What it is, in one line (the product page). */
  line: string;
  /** What it takes, concretely ("A night and a place"): the Make index's line under the card. */
  from: string;
  /** The Make index's group: what the visitor arrives with (MAKE_GROUPS). */
  group: MakeGroup;
  /** The catalogue design (by variant) it is drawn like. */
  base: string;
  /** What the words (or name) field suggests. */
  wordsHint?: string;
  /** The example the Make index shows (a real print, not the customer's). */
  example: CustomSpec;
  /** What to change when a print fails the gate ("Try fewer repeats."). */
  hints?: PrintHints;
  /** The catalogue designs (by variant; "lsystem-*" a prefix) whose pages lead here ("Make your own →"); `base` when unset. */
  bases?: string[];
}

/** The dated products' hint: another day draws another sky. */
const DATED: PrintHints = { dense: "Try another date.", faint: "Try another date." };

/** London's GeoNames id (data/cities): the example sky's place, and the fallback when the visitor's zone has no city. */
export const FALLBACK_CITY = 2643743;

export type MakeGroup = "date" | "name" | "place" | "travels" | "form" | "people" | "you";
/** The Make index's groups, in order: by what the visitor has (a date, a name, a place, their travels, a form they know, their people, themselves). */
export const MAKE_GROUPS: { id: MakeGroup; label: string }[] = [
  { id: "date", label: "From a date" },
  { id: "name", label: "From a name" },
  { id: "place", label: "From a place" },
  { id: "travels", label: "From your travels" },
  { id: "form", label: "In a form you know" },
  { id: "people", label: "From your people" },
  { id: "you", label: "From you" },
];
/** The order on the index and everywhere products are listed: grouped, then as the groups read. */
const ORDER = ["sky", "moon", "planets", "year", "code", "ascii", "place", "house", "voice", "line", "number", "taste"];
/**
 * The later products that ship, in their place in each group (each is its own
 * template, its entry in its spec module, lib/custom/specs). A product
 * built but not listed here has no page.
 */
const SHIPPED: ExtraId[] = ["family", "musicbox", "elements", "automaton", "weeks", "maze", "rings", "tartan", "journey", "chess", "snowflake", "metro", "crossword", "orbits", "julia", "monogram", "route", "island", "qr", "telegram", "editions", "sayings", "label", "credits", "card"];

const LIST: MadeProduct[] = [
  {
    slug: "taste",
    id: "make-taste",
    template: "taste",
    name: "Your Taste Plant",
    line: "A plant grown from everything you swiped.",
    from: "Your swipes",
    group: "you",
    base: "phyllotaxis",
    bases: ["phyllotaxis", "lsystem-*"],
    // A taste that leans to nature, line and geometry (lib/custom/tasteCode, written out).
    example: { t: "taste", v: 1, p: { q: "83227357236269461" } },
    hints: { dense: "Swipe a few more.", faint: "Swipe a few more." },
  },
  {
    slug: "code",
    id: "make-code",
    template: "code",
    name: "Your Name in Code",
    line: "Your name, punched, tapped or dotted in one of the old codes.",
    from: "A name",
    group: "name",
    base: "terminal-data",
    bases: ["terminal-data", "type-data"],
    wordsHint: "Noa",
    example: { t: "code", v: 1, p: { x: "NOA", k: "card" } },
    hints: { dense: "Try another code.", faint: "Try a longer name, or another code." },
  },
  {
    slug: "ascii",
    id: "make-ascii",
    template: "ascii",
    name: "Your ASCII",
    line: "Your words as big letters, typed out of characters.",
    from: "A word or a picture",
    group: "name",
    base: "ascii-shade",
    bases: ["ascii-*"],
    wordsHint: "For Maya",
    example: { t: "ascii", v: 1, p: { x: ["NOA"], f: "self", s: 1 } },
    hints: { dense: "Try fewer letters.", faint: "Try a longer word." },
  },
  {
    slug: "line",
    id: "make-line",
    template: "line",
    name: "Your Line",
    line: "One line you draw, turned into an ornament.",
    from: "A line you draw",
    group: "you",
    base: "rosette",
    bases: ["rosette", "guilloche"],
    wordsHint: "For Maya",
    // The second of the example lines (lib/custom/stroke exampleStroke(1), a leaf), written out: this list is in every page.
    example: { t: "line", v: 1, p: { s: "AKZYTzQlNhc0CzQGJAwkEjQmWFA", n: 12, w: "For Maya" } },
    hints: { dense: "Try fewer repeats.", faint: "Try a longer line." },
  },
  {
    slug: "voice",
    id: "make-voice",
    template: "voice",
    name: "Your Voice",
    line: "Three seconds of your voice, drawn by two pendulums.",
    from: "Three seconds of humming",
    group: "you",
    base: "harmonograph",
    bases: ["harmonograph", "lissajous"],
    wordsHint: "Maya, humming",
    // G3 hummed: a fifth between its strongest partials, a slow fade.
    example: { t: "voice", v: 1, p: { a: 3, b: 2, d: 0.012, ph: 1.2, f: 196 } },
    hints: { dense: "Try a steadier note.", faint: "Try humming a little longer." },
  },
  {
    slug: "house",
    id: "make-house",
    template: "house",
    name: "Your House",
    line: "Your house as an architect’s elevation, brick by brick.",
    from: "Floors, windows, a door",
    group: "place",
    base: "facade",
    bases: ["facade", "brick-bond", "orders"],
    wordsHint: "The Old Bakery",
    example: { t: "house", v: 1, p: { fl: 3, wn: 3, r: "pitched", dr: "c", no: 14 } },
    hints: { dense: "Try fewer windows.", faint: "Try more windows or floors." },
  },
  {
    slug: "number",
    id: "make-number",
    template: "number",
    name: "Your Number",
    line: "A number that matters, on an instrument’s dial.",
    from: "A number that matters",
    group: "you",
    base: "dial",
    bases: ["dial", "slide-rule"],
    example: { t: "number", v: 1, p: { v: 3.4, u: "kg", l: "Birth weight", face: "dial" } },
    hints: { dense: "Try a shorter label.", faint: "Try a shorter label." },
  },
  {
    slug: "place",
    id: "make-place",
    template: "place",
    name: "Your Place",
    line: "Where you were when it happened, at the centre of the globe.",
    from: "A place and a day",
    group: "place",
    base: "daylight",
    bases: ["daylight", "analemma"],
    wordsHint: "Where I heard the news",
    // Tel Aviv (GeoNames 293397), a spring day.
    example: { t: "place", v: 1, p: { la: 32.08, lo: 34.78, c: 293397, d: "1991-03-14" } },
    hints: { dense: "Try shorter words.", faint: "Try shorter words." },
  },
  {
    slug: "sky",
    id: "make-sky",
    template: "sky",
    name: "Your Night Sky",
    line: "The stars over you, on the night you choose.",
    from: "A night and a place",
    group: "date",
    hints: DATED,
    base: "sky-night",
    wordsHint: "The night we met",
    example: { t: "sky", v: 1, p: { c: FALLBACK_CITY, d: "2016-08-12", t: "23:30", w: "The night we met" } },
  },
  {
    slug: "moon",
    id: "make-moon",
    template: "night",
    name: "Your Moon",
    line: "The moon as it was, the night it mattered.",
    from: "A night",
    group: "date",
    hints: DATED,
    base: "moon-year",
    wordsHint: "Noa, welcome",
    example: { t: "night", v: 1, p: { d: "2021-11-19", w: "Noa, welcome" } },
  },
  {
    slug: "planets",
    id: "make-planets",
    template: "planets",
    name: "Your Planets",
    line: "Where the planets stood on your day.",
    from: "A day",
    group: "date",
    hints: DATED,
    base: "planets-date",
    wordsHint: "Our wedding day",
    example: { t: "planets", v: 1, p: { d: "2012-06-06", w: "Our wedding day" } },
  },
  {
    slug: "year",
    id: "make-year",
    template: "moon",
    name: "Your Year of Moons",
    line: "Every moon of the year you choose.",
    from: "A year",
    group: "date",
    hints: DATED,
    base: "moon-year",
    wordsHint: "The year we moved",
    example: { t: "moon", v: 1, p: { y: 2020, w: "The year we moved" } },
  },
];
for (const t of SHIPPED) {
  const m = EXTRA[t];
  LIST.push({ slug: t, id: `make-${t}`, template: t, name: m.NAME, ...m.PRODUCT, example: { t, v: 1, p: m.PRODUCT.example } as CustomSpec });
}
const rank = (slug: string) => (ORDER.includes(slug) ? ORDER.indexOf(slug) : ORDER.length + SHIPPED.indexOf(slug as ExtraId));
export const MADE: MadeProduct[] = MAKE_GROUPS.flatMap((g) => LIST.filter((m) => m.group === g.id).sort((a, b) => rank(a.slug) - rank(b.slug)));


/** How many products each group holds (an empty group isn't shown, nor offered in the filter). */
export const GROUP_COUNTS = Object.fromEntries(MAKE_GROUPS.map((g) => [g.id, MADE.filter((m) => m.group === g.id).length])) as Record<MakeGroup, number>;
/** The groups the address asks for (`?g=date.name`), known ones only, in their order. */
export function groupsFrom(search: string): MakeGroup[] {
  const want = (new URLSearchParams(search).get("g") ?? "").split(".");
  return MAKE_GROUPS.map((g) => g.id).filter((g) => want.includes(g));
}

export const madeById = (id: string) => MADE.find((m) => m.id === id);
export const madeBySlug = (slug: string) => MADE.find((m) => m.slug === slug);
/** Whether a catalogue variant is one of these ("lsystem-*" matches every L-system plant). */
const matches = (patterns: string[], variant: string) => patterns.some((p) => (p.endsWith("*") ? variant.startsWith(p.slice(0, -1)) : p === variant));
/** The Make product a catalogue design leads to ("Make your own"): the one drawn like it (Your Moon has no catalogue twin; the moon designs lead to the year). */
export const madeFor = (variant: string) => madeAllFor(variant)[0];
/** Every Make product drawn like a catalogue design (a design several products are drawn like leads to each; at most three). */
export const madeAllFor = (variant: string) => MADE.filter((m) => m.slug !== "moon" && matches(m.bases ?? [m.base], variant)).slice(0, 3);
