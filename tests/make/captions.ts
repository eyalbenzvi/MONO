/**
 * The caption's shared test helpers (tests/make/captions.test.ts and each
 * product's own test): the visitor's lines at their longest, and the bound a
 * link with them keeps.
 */
import { CAP_MAX, type Cap } from "@/lib/custom/specKit";
import type { CustomSpec } from "@/lib/custom/spec";

/** The 300 characters every product's own inputs keep to, unless its own test justifies more (OWN_LINK_MAX). */
export const LINK_MAX = 300;
/**
 * The products whose own inputs already have a larger, justified bound, from
 * their own tests: a drawn route is its points, a family its fifteen names, a
 * game its moves, a map its stations, a tune its notes.
 */
export const OWN_LINK_MAX: Record<string, number> = { route: 1200, family: 1000, metro: 700, chess: 600, musicbox: 400, orbits: 335, crossword: 310, editions: 560, sayings: 900, label: 440 };
/**
 * What the visitor's three caption lines at their longest (24, 36 and 36
 * characters, about 130 in the link's base64) may add to any link: the caption
 * is the visitor's choice, and ?make= reads up to 1,200 characters (lib/custom/
 * spec decodeMake).
 */
export const CAP_LINK_EXTRA = 160;
/** The longest a product's link may be with the caption at its longest: its own bound and the caption's. */
export const captionedLinkMax = (slug: string) => (OWN_LINK_MAX[slug] ?? LINK_MAX) + CAP_LINK_EXTRA;

/** Each line at its longest, in a wide letter (the words' rule allows "W"). */
export const MAX_CAP: Cap = CAP_MAX.map((n) => "W".repeat(n));
/** Three ordinary lines a visitor might write. */
export const SOME_CAP: Cap = ["Maya and Sam", "Every Sunday since 2010", "Kept in the kitchen drawer"];

export const withCap = (spec: CustomSpec, cap: Cap): CustomSpec => ({ ...spec, p: { ...spec.p, cap } }) as CustomSpec;
