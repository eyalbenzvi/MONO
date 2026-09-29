/**
 * The caption's shared test helpers (tests/make/captions.test.ts and each
 * product's own test): the visitor's lines at their longest, and the bound a
 * link with them keeps.
 */
import { CAP_MAX, type Cap } from "@/lib/custom/specKit";
import type { CustomSpec } from "@/lib/custom/spec";

/**
 * A link that carries the visitor's three caption lines at their longest (24,
 * 36 and 36 characters, about 130 more in the link's base64) is allowed past
 * the 300 every product's own inputs keep to: the caption is the visitor's
 * choice, and ?make= reads up to 1,200 characters (lib/custom/spec decodeMake).
 */
export const CAPTIONED_LINK_MAX = 460;

/** Each line at its longest, in a wide letter (the words' rule allows "W"). */
export const MAX_CAP: Cap = CAP_MAX.map((n) => "W".repeat(n));
/** Three ordinary lines a visitor might write. */
export const SOME_CAP: Cap = ["Maya and Sam", "Every Sunday since 2010", "Kept in the kitchen drawer"];

export const withCap = (spec: CustomSpec, cap: Cap): CustomSpec => ({ ...spec, p: { ...spec.p, cap } }) as CustomSpec;
