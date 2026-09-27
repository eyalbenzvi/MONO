/**
 * Seventh set (content overhaul, Part 3): designs made from real data —
 * the sky computed for real places and dates, measured architecture, data
 * set in type, standard circuits and instrument scales, the machine's
 * character codes. Numbered in this order from SET7_FIRST_N: a design added
 * later goes at the end, so no number ever moves.
 */
import { architectureSet } from "./architecture";
import type { Set7Design } from "./kit";
import { skySet } from "./sky";
import { systemsSet } from "./systems";
import { terminalSet } from "./terminal";
import { typeSet } from "./type";

export type { Set7Design } from "./kit";

export function set7Designs(): Set7Design[] {
  return [...skySet(), ...architectureSet(), ...typeSet(), ...systemsSet(), ...terminalSet()];
}
