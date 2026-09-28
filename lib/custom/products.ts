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

export interface MadeProduct {
  slug: "taste" | "code" | "line" | "voice" | "house" | "number" | "sky" | "moon" | "year" | "planets";
  id: string;
  template: TemplateId;
  name: string;
  /** What it is, in one line (the product page). */
  line: string;
  /** What it is made from ("From a night"): the Make index's line, so the grid says what each one takes. */
  from: string;
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

export const MADE: MadeProduct[] = [
  {
    slug: "taste",
    id: "make-taste",
    template: "taste",
    name: "Your Taste",
    line: "A plant grown from everything you swiped.",
    from: "From your swipes",
    base: "phyllotaxis",
    bases: ["phyllotaxis", "lsystem-*"],
    // A taste that leans to nature, line and geometry (lib/custom/tasteCode, written out).
    example: { t: "taste", v: 1, p: { q: "83227357236269461" } },
    hints: { dense: "Swipe a few more; the plant changes with your taste.", faint: "Swipe a few more; the plant changes with your taste." },
  },
  {
    slug: "code",
    id: "make-code",
    template: "code",
    name: "Your Name",
    line: "Your name, punched, tapped or dotted in one of the old codes.",
    from: "From your name",
    base: "terminal-data",
    bases: ["terminal-data", "type-data"],
    wordsHint: "Noa",
    example: { t: "code", v: 1, p: { x: "NOA", k: "card" } },
    hints: { dense: "Try another code.", faint: "Try a longer name, or another code." },
  },
  {
    slug: "line",
    id: "make-line",
    template: "line",
    name: "Your Line",
    line: "One line you draw, turned into an ornament.",
    from: "From a line you draw",
    base: "rosette",
    bases: ["rosette", "guilloche"],
    wordsHint: "For Maya",
    // The second of the example lines (lib/custom/stroke exampleStroke(1), a leaf), written out: this list is in every page.
    example: { t: "line", v: 1, p: { s: "AKZYTzQlNhc0CzQGJAwkEjQmWFA", n: 12, w: "For Maya" } },
    hints: { dense: "Too many repeats for this line. Try fewer repeats.", faint: "Try a longer line." },
  },
  {
    slug: "voice",
    id: "make-voice",
    template: "voice",
    name: "Your Voice",
    line: "Three seconds of your voice, drawn by two pendulums.",
    from: "From your voice",
    base: "harmonograph",
    bases: ["harmonograph", "lissajous"],
    wordsHint: "Maya, humming",
    // G3 hummed: a fifth between its strongest partials, a slow fade.
    example: { t: "voice", v: 1, p: { a: 3, b: 2, d: 0.012, ph: 1.2, f: 196 } },
    hints: { dense: "Hum a steadier note.", faint: "Hum a little longer." },
  },
  {
    slug: "house",
    id: "make-house",
    template: "house",
    name: "Your House",
    line: "Your house as an architect's elevation, brick by brick.",
    from: "From your house",
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
    line: "A number that matters, on an instrument's dial.",
    from: "From a number",
    base: "dial",
    bases: ["dial", "slide-rule"],
    example: { t: "number", v: 1, p: { v: 3.4, u: "kg", l: "Birth weight", face: "dial" } },
    hints: { dense: "Try a shorter label.", faint: "Try a shorter label." },
  },
  {
    slug: "sky",
    id: "make-sky",
    template: "sky",
    name: "Your Night Sky",
    line: "The stars over you, on the night you choose.",
    from: "From a night",
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
    from: "From a moon",
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
    from: "From a day",
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
    from: "From a year",
    hints: DATED,
    base: "moon-year",
    wordsHint: "The year we moved",
    example: { t: "moon", v: 1, p: { y: 2020, w: "The year we moved" } },
  },
];

export const madeById = (id: string) => MADE.find((m) => m.id === id);
export const madeBySlug = (slug: string) => MADE.find((m) => m.slug === slug);
/** Whether a catalogue variant is one of these ("lsystem-*" matches every L-system plant). */
const matches = (patterns: string[], variant: string) => patterns.some((p) => (p.endsWith("*") ? variant.startsWith(p.slice(0, -1)) : p === variant));
/** The Make product a catalogue design leads to ("Make your own"): the one drawn like it (Your Moon has no catalogue twin; the moon designs lead to the year). */
export const madeFor = (variant: string) => MADE.find((m) => m.slug !== "moon" && matches(m.bases ?? [m.base], variant));
